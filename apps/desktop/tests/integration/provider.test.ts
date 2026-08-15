import { once } from "node:events";
import { createServer, type RequestListener } from "node:http";
import { openDatabase } from "@desktop/main/database/database";
import { Repositories } from "@desktop/main/database/repositories";
import {
  ProviderService,
  UnsupportedProviderError,
} from "@desktop/main/providers/provider-service";
import type { ProviderSecrets } from "@desktop/main/secrets/secret-store";
import {
  isSupportedProviderKind,
  providerKindSchema,
} from "@desktop/shared/contracts";
import { describe, expect, it } from "vitest";

describe("OpenAI-compatible provider", () => {
  it("streams from a local mock server without cloud credentials", async () => {
    const server = createServer((request, response) => {
      if (request.url !== "/v1/chat/completions") {
        return response.writeHead(404).end();
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"mock","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'
      );
      response.end(
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"mock","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Mock server did not bind.");
    }
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    const memory = new Map<string, ProviderSecrets>();
    const secrets = {
      delete: async (reference: string | null) => {
        if (reference) {
          memory.delete(reference);
        }
      },
      read: async (reference: string) => requireSecret(memory, reference),
      write: async (reference: string, value: ProviderSecrets) => {
        memory.set(reference, value);
      },
    };
    const service = new ProviderService(repositories, secrets);
    const provider = await service.save({
      apiKey: "test-only",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      headers: {},
      kind: "openai-compatible",
      model: "mock",
      name: "Mock",
    });
    let output = "";
    for await (const delta of await service.stream(
      provider.id,
      "mock",
      [{ content: "Hi", role: "user" }],
      new AbortController().signal
    )) {
      output += delta;
    }
    expect(output).toBe("Hello");
    database.close();
    server.close();
  });

  it.each([401, 429])(
    "surfaces HTTP %s without exposing credentials",
    async (status) => {
      const fixture = await createFixture((_request, response) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(
          JSON.stringify({ error: { message: "provider rejected request" } })
        );
      });
      try {
        const error = await collect(
          fixture.service.stream(
            fixture.providerId,
            "mock",
            [{ content: "Hi", role: "user" }],
            new AbortController().signal
          )
        ).catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(Error);
        expect(String(error)).not.toContain("test-only");
        expect(String(error)).not.toContain("provider rejected request");
      } finally {
        fixture.close();
      }
    }
  );

  it("rejects an invalid streaming response", async () => {
    const fixture = await createFixture((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end("data: this-is-not-json\n\n");
    });
    try {
      await expect(
        collect(
          fixture.service.stream(
            fixture.providerId,
            "mock",
            [{ content: "Hi", role: "user" }],
            new AbortController().signal
          )
        )
      ).rejects.toThrow();
    } finally {
      fixture.close();
    }
  });

  it("aborts a request that exceeds the configured timeout", async () => {
    const fixture = await createFixture(() => undefined, 30);
    try {
      await expect(
        collect(
          fixture.service.stream(
            fixture.providerId,
            "mock",
            [{ content: "Hi", role: "user" }],
            new AbortController().signal
          )
        )
      ).rejects.toThrow();
    } finally {
      fixture.close();
    }
  });

  it("requires fresh credentials when the endpoint changes", async () => {
    const fixture = await createFixture((_request, response) => {
      response.writeHead(200).end();
    });
    try {
      await expect(
        fixture.service.save({
          apiKey: "",
          baseUrl: "http://127.0.0.1:9/v1",
          headers: {},
          id: fixture.providerId,
          kind: "openai-compatible",
          model: "mock",
          name: "Mock",
        })
      ).rejects.toThrow("Re-enter Provider credentials");
    } finally {
      fixture.close();
    }
  });
});

describe("Provider support boundary", () => {
  it("keeps Repository status and model factory gates aligned", async () => {
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    const memory = new Map<string, ProviderSecrets>();
    const service = new ProviderService(repositories, {
      delete: async () => undefined,
      read: async (reference) => requireSecret(memory, reference),
      write: async (reference, value) => {
        memory.set(reference, value);
      },
    });

    const providers = await Promise.all(
      providerKindSchema.options.map((kind) =>
        service.save({
          apiKey: "test-only",
          baseUrl: "http://127.0.0.1:9/v1",
          headers: {},
          kind,
          model: "mock",
          name: kind,
        })
      )
    );
    await Promise.all(
      providers.map(async (provider) => {
        expect(provider.supported).toBe(isSupportedProviderKind(provider.kind));
        const model = service.stream(
          provider.id,
          "mock",
          [{ content: "Hi", role: "user" }],
          new AbortController().signal
        );
        if (isSupportedProviderKind(provider.kind)) {
          await expect(model).resolves.toBeDefined();
        } else {
          await expect(model).rejects.toBeInstanceOf(UnsupportedProviderError);
        }
      })
    );
    database.close();
  });
});

async function createFixture(listener: RequestListener, timeoutMs = 1000) {
  const server = createServer(listener);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock server did not bind.");
  }
  const database = openDatabase(":memory:");
  const repositories = new Repositories(database);
  const memory = new Map<string, ProviderSecrets>();
  const service = new ProviderService(
    repositories,
    {
      delete: async (reference) => {
        if (reference) {
          memory.delete(reference);
        }
      },
      read: async (reference) => requireSecret(memory, reference),
      write: async (reference, value) => {
        memory.set(reference, value);
      },
    },
    timeoutMs
  );
  const provider = await service.save({
    apiKey: "test-only",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    headers: {},
    kind: "openai-compatible",
    model: "mock",
    name: "Mock",
  });
  return {
    close: () => {
      server.closeAllConnections();
      server.close();
      database.close();
    },
    providerId: provider.id,
    service,
  };
}

async function collect(
  streamPromise: Promise<AsyncIterable<string>>
): Promise<string> {
  let output = "";
  for await (const delta of await streamPromise) {
    output += delta;
  }
  return output;
}

function requireSecret(
  memory: Map<string, ProviderSecrets>,
  reference: string
): ProviderSecrets {
  const value = memory.get(reference);
  if (!value) {
    throw new Error("Test secret not found.");
  }
  return value;
}
