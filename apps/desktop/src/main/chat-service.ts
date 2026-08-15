import type { Repositories } from "@desktop/main/database/repositories";
import {
  type ChatEvent,
  type ChatStartInput,
  channels,
} from "@desktop/shared/contracts";
import type { ModelMessage } from "ai";
import type { WebContents } from "electron";

interface ActiveRun {
  controller: AbortController;
  conversationId: string;
  finished: Promise<void>;
  sender: WebContents;
}
interface StreamProvider {
  stream: (
    id: string,
    modelName: string,
    messages: ModelMessage[],
    signal: AbortSignal
  ) => Promise<AsyncIterable<string>>;
}

export class ChatService {
  private readonly runs = new Map<string, ActiveRun>();

  public constructor(
    private readonly repositories: Repositories,
    private readonly providers: StreamProvider
  ) {}

  public start(
    input: ChatStartInput,
    sender: WebContents,
    retry = false
  ): void {
    if (input.runtimeKind !== "contentdesk-native") {
      throw new Error("Only ContentDesk Native can run chat in v0.1.");
    }
    if (this.runs.has(input.runId)) {
      throw new Error("Run already exists.");
    }
    const conversation = this.repositories.getConversation(
      input.conversationId
    );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const content = retry
      ? this.repositories.getLastUserMessage(input.conversationId)?.content
      : input.content;
    if (!content) {
      throw new Error("No user message is available to retry.");
    }
    if (!retry) {
      this.repositories.addMessage(
        input.conversationId,
        "user",
        content,
        "complete"
      );
    }
    const assistant = this.repositories.addMessage(
      input.conversationId,
      "assistant",
      "",
      "streaming"
    );
    const controller = new AbortController();
    const onDestroyed = () => controller.abort();
    sender.once("destroyed", onDestroyed);

    const history = this.repositories.getConversation(input.conversationId);
    if (!history) {
      throw new Error("Conversation disappeared before chat could start.");
    }
    const messages = history.messages
      .filter((message) => message.id !== assistant.id)
      .filter(
        (message) => message.role === "user" || message.status === "complete"
      )
      .map(({ role, content: text }) => ({
        content: text,
        role,
      })) as ModelMessage[];
    const finished = this.consume(
      input,
      messages,
      assistant.id,
      sender,
      controller,
      onDestroyed
    );
    this.runs.set(input.runId, {
      controller,
      conversationId: input.conversationId,
      finished,
      sender,
    });
    finished.catch(() => undefined);
  }

  public stop(runId: string, sender: WebContents): void {
    const run = this.runs.get(runId);
    if (run?.sender.id === sender.id) {
      run.controller.abort();
    }
  }

  public async abortConversation(conversationId: string): Promise<void> {
    const runs = [...this.runs.values()].filter(
      (run) => run.conversationId === conversationId
    );
    for (const run of runs) {
      run.controller.abort();
    }
    await Promise.allSettled(runs.map((run) => run.finished));
  }

  public async shutdown(): Promise<void> {
    const runs = [...this.runs.values()];
    for (const run of runs) {
      run.controller.abort();
    }
    await Promise.allSettled(runs.map((run) => run.finished));
  }

  private async consume(
    input: ChatStartInput,
    messages: ModelMessage[],
    assistantId: string,
    sender: WebContents,
    controller: AbortController,
    onDestroyed: () => void
  ): Promise<void> {
    let content = "";
    try {
      const stream = await this.providers.stream(
        input.providerId,
        input.model,
        messages,
        controller.signal
      );
      for await (const delta of stream) {
        content += delta;
        this.send(sender, { runId: input.runId, text: delta, type: "delta" });
      }
      const message = this.repositories.updateMessage(
        assistantId,
        content,
        "complete"
      );
      this.send(sender, { message, runId: input.runId, type: "done" });
    } catch (error) {
      if (controller.signal.aborted) {
        this.repositories.updateMessage(assistantId, content, "stopped");
        this.send(sender, { runId: input.runId, type: "stopped" });
      } else {
        const message = safeError(error);
        this.repositories.updateMessage(assistantId, content, "error", message);
        this.send(sender, { message, runId: input.runId, type: "error" });
      }
    } finally {
      sender.removeListener("destroyed", onDestroyed);
      this.runs.delete(input.runId);
    }
  }

  private send(sender: WebContents, event: ChatEvent): void {
    if (!sender.isDestroyed()) {
      sender.send(channels.chatEvent, event);
    }
  }
}

export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return message
    .replace(
      /(api[_-]?key|authorization|token)\s*[:=]\s*\S+/gi,
      "$1=[redacted]"
    )
    .slice(0, 500);
}
