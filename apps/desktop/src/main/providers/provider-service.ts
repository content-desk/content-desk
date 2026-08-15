import { randomUUID } from "node:crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Repositories } from "@desktop/main/database/repositories";
import type {
  ProviderSecrets,
  SecretRepository,
} from "@desktop/main/secrets/secret-store";
import {
  isSupportedProviderKind,
  type ProviderInput,
  type ProviderView,
} from "@desktop/shared/contracts";
import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  streamText,
} from "ai";

export class UnsupportedProviderError extends Error {}
export class ProviderRequestError extends Error {}

export class ProviderService {
  public constructor(
    private readonly repositories: Repositories,
    private readonly secrets: SecretRepository,
    private readonly requestTimeoutMs = 60_000
  ) {}

  public list(): ProviderView[] {
    return this.repositories.listProviders();
  }

  public async save(input: ProviderInput): Promise<ProviderView> {
    const existing = input.id
      ? this.repositories.getProviderRow(input.id)
      : undefined;
    let previous: ProviderSecrets = { headers: {} };
    if (existing?.secret_ref) {
      previous = await this.secrets.read(existing.secret_ref);
    }
    const endpointChanged = Boolean(
      existing &&
        (existing.kind !== input.kind ||
          (existing.base_url ?? undefined) !== input.baseUrl)
    );
    if (
      endpointChanged &&
      !input.apiKey &&
      Object.keys(input.headers).length === 0
    ) {
      throw new Error(
        "Re-enter Provider credentials after changing its type or Base URL."
      );
    }
    let { headers } = input;
    if (endpointChanged || input.clearHeaders) {
      headers = input.clearHeaders ? {} : input.headers;
    } else if (Object.keys(input.headers).length === 0) {
      ({ headers } = previous);
    }
    const next: ProviderSecrets = {
      apiKey:
        !endpointChanged && (input.apiKey === undefined || input.apiKey === "")
          ? previous.apiKey
          : input.apiKey || undefined,
      headers,
    };
    const reference = existing?.secret_ref ?? randomUUID();
    await this.secrets.write(reference, next);
    return this.repositories.saveProvider(input, reference, {
      hasApiKey: Boolean(next.apiKey),
      headerNames: Object.keys(next.headers).sort(),
    });
  }

  public async delete(id: string): Promise<void> {
    await this.secrets.delete(this.repositories.deleteProvider(id));
  }

  public async test(id: string): Promise<{ latencyMs: number }> {
    const startedAt = Date.now();
    try {
      const { model } = await this.model(id);
      await generateText({
        abortSignal: AbortSignal.timeout(20_000),
        maxOutputTokens: 8,
        model,
        prompt: "Reply with OK.",
      });
      return { latencyMs: Date.now() - startedAt };
    } catch (error) {
      throw new ProviderRequestError(
        "Provider connection failed. Check its endpoint and credentials.",
        { cause: error }
      );
    }
  }

  public async stream(
    id: string,
    modelName: string,
    messages: ModelMessage[],
    signal: AbortSignal
  ): Promise<AsyncIterable<string>> {
    const { model } = await this.model(id, modelName);
    const combinedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(this.requestTimeoutMs),
    ]);
    const result = streamText({
      abortSignal: combinedSignal,
      messages,
      model,
      onError: () => undefined,
    });
    return (async function* () {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            yield part.text;
          } else if (part.type === "error") {
            throw part.error;
          } else if (part.type === "abort") {
            throw (
              combinedSignal.reason ?? new Error("Provider request aborted.")
            );
          }
        }
      } catch (error) {
        throw new ProviderRequestError(
          "Provider request failed. Check its endpoint and credentials.",
          { cause: error }
        );
      }
    })();
  }

  private async model(
    id: string,
    modelOverride?: string
  ): Promise<{ model: LanguageModel }> {
    const provider = this.repositories.getProviderRow(id);
    if (!provider) {
      throw new Error("Provider not found.");
    }
    if (!isSupportedProviderKind(provider.kind)) {
      throw new UnsupportedProviderError(
        `${provider.kind} is defined for future support but is not available in v0.1.`
      );
    }
    if (!provider.secret_ref) {
      throw new Error("Provider credentials are not configured.");
    }
    const secret = await this.secrets.read(provider.secret_ref);
    const modelName = modelOverride ?? provider.model;
    if (provider.kind === "openai-compatible") {
      const factory = createOpenAICompatible({
        apiKey: secret.apiKey,
        baseURL: provider.base_url ?? "https://api.openai.com/v1",
        headers: secret.headers,
        name: provider.name,
      });
      return { model: factory(modelName) };
    }
    if (provider.kind === "anthropic-compatible") {
      const factory = createAnthropic({
        apiKey: secret.apiKey,
        baseURL: provider.base_url ?? "https://api.anthropic.com/v1",
        headers: secret.headers,
      });
      return { model: factory(modelName) };
    }
    const unsupportedKind: never = provider.kind;
    throw new UnsupportedProviderError(
      `No model factory is registered for ${unsupportedKind}.`
    );
  }
}
