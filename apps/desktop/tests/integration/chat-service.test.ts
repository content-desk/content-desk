import { EventEmitter } from "node:events";
import { ChatService } from "@desktop/main/chat-service";
import { openDatabase } from "@desktop/main/database/database";
import { Repositories } from "@desktop/main/database/repositories";
import type { ChatEvent } from "@desktop/shared/contracts";
import type { ModelMessage } from "ai";
import type { WebContents } from "electron";
import { describe, expect, it } from "vitest";

describe("ChatService", () => {
  it("persists partial output when the owner stops a stream", async () => {
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    const conversation = repositories.createConversation();
    const providerId = crypto.randomUUID();
    const events: ChatEvent[] = [];
    const sender = {
      id: 7,
      isDestroyed: () => false,
      once: () => undefined,
      removeListener: () => undefined,
      send: (_channel: string, event: ChatEvent) => events.push(event),
    } as unknown as WebContents;
    const provider = {
      stream: async (
        _id: string,
        _model: string,
        _messages: unknown[],
        signal: AbortSignal
      ) =>
        (async function* () {
          yield "partial";
          await new Promise<void>((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            })
          );
        })(),
    };
    const service = new ChatService(repositories, provider);
    const runId = crypto.randomUUID();
    service.start(
      {
        content: "hello",
        conversationId: conversation.id,
        model: "mock",
        providerId,
        runId,
        runtimeKind: "contentdesk-native",
      },
      sender
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    service.stop(runId, sender);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const assistant = repositories
      .getConversation(conversation.id)
      ?.messages.at(-1);
    expect(assistant).toMatchObject({
      content: "partial",
      role: "assistant",
      status: "stopped",
    });
    expect(events.at(-1)?.type).toBe("stopped");
    database.close();
  });

  it.each(["error", "stopped"] as const)(
    "excludes %s assistant output from retry history and cleans listeners",
    async (status) => {
      const database = openDatabase(":memory:");
      const repositories = new Repositories(database);
      const conversation = repositories.createConversation();
      repositories.addMessage(conversation.id, "user", "retry me", "complete");
      repositories.addMessage(
        conversation.id,
        "assistant",
        "untrusted partial",
        status
      );
      const captured: ModelMessage[][] = [];
      let complete: () => void = () => undefined;
      const completed = new Promise<void>((resolve) => {
        complete = resolve;
      });
      const sender = Object.assign(new EventEmitter(), {
        id: 8,
        isDestroyed: () => false,
        send: (_channel: string, event: ChatEvent) => {
          if (event.type === "done") {
            complete();
          }
        },
      }) as unknown as WebContents;
      const service = new ChatService(repositories, {
        stream: async (
          _id: string,
          _model: string,
          messages: ModelMessage[]
        ) => {
          captured.push(messages);
          return (async function* () {
            yield "complete";
          })();
        },
      });
      service.start(
        {
          content: "retry",
          conversationId: conversation.id,
          model: "mock",
          providerId: crypto.randomUUID(),
          runId: crypto.randomUUID(),
          runtimeKind: "contentdesk-native",
        },
        sender,
        true
      );
      await completed;
      expect(captured).toEqual([[{ content: "retry me", role: "user" }]]);
      expect(
        (sender as unknown as EventEmitter).listenerCount("destroyed")
      ).toBe(0);
      database.close();
    }
  );

  it("settles an active run before its conversation is deleted", async () => {
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    const conversation = repositories.createConversation();
    let started: () => void = () => undefined;
    const streaming = new Promise<void>((resolve) => {
      started = resolve;
    });
    const sender = Object.assign(new EventEmitter(), {
      id: 9,
      isDestroyed: () => false,
      send: (_channel: string, event: ChatEvent) => {
        if (event.type === "delta") {
          started();
        }
      },
    }) as unknown as WebContents;
    const service = new ChatService(repositories, {
      stream: async (
        _id: string,
        _model: string,
        _messages: ModelMessage[],
        signal: AbortSignal
      ) =>
        (async function* () {
          yield "partial";
          await new Promise<void>((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            })
          );
        })(),
    });
    service.start(
      {
        content: "delete while streaming",
        conversationId: conversation.id,
        model: "mock",
        providerId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        runtimeKind: "contentdesk-native",
      },
      sender
    );
    await streaming;
    await service.abortConversation(conversation.id);
    repositories.deleteConversation(conversation.id);
    expect(repositories.getConversation(conversation.id)).toBeUndefined();
    database.close();
  });

  it("waits for active run cleanup during shutdown", async () => {
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    const conversation = repositories.createConversation();
    let reportAborted: () => void = () => undefined;
    const aborted = new Promise<void>((resolve) => {
      reportAborted = resolve;
    });
    let releaseCleanup: () => void = () => undefined;
    const cleanup = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const sender = Object.assign(new EventEmitter(), {
      id: 10,
      isDestroyed: () => false,
      send: () => undefined,
    }) as unknown as WebContents;
    const service = new ChatService(repositories, {
      stream: async (
        _id: string,
        _model: string,
        _messages: ModelMessage[],
        signal: AbortSignal
      ) =>
        (async function* () {
          try {
            yield "partial";
            await new Promise<void>((_resolve, reject) =>
              signal.addEventListener(
                "abort",
                () => {
                  reportAborted();
                  reject(signal.reason);
                },
                { once: true }
              )
            );
          } finally {
            await cleanup;
          }
        })(),
    });
    service.start(
      {
        content: "shutdown while streaming",
        conversationId: conversation.id,
        model: "mock",
        providerId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        runtimeKind: "contentdesk-native",
      },
      sender
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    let shutdownResolved = false;
    const shutdown = service.shutdown().then(() => {
      shutdownResolved = true;
    });
    await aborted;
    await Promise.resolve();
    expect(shutdownResolved).toBe(false);
    releaseCleanup();
    await shutdown;
    expect(shutdownResolved).toBe(true);
    expect(
      repositories.getConversation(conversation.id)?.messages.at(-1)
    ).toMatchObject({
      content: "partial",
      status: "stopped",
    });
    database.close();
  });
});
