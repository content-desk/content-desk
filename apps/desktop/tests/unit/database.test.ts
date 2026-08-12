import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/database/database";
import { Repositories } from "../../src/main/database/repositories";

describe("desktop database", () => {
  it("migrates, seeds runtimes, and persists conversations", () => {
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    expect(repositories.listRuntimes().map((runtime) => runtime.kind)).toEqual([
      "contentdesk-native",
      "codex",
      "claude-code",
    ]);
    const conversation = repositories.createConversation();
    repositories.addMessage(
      conversation.id,
      "user",
      "A durable message",
      "complete"
    );
    expect(
      repositories.getConversation(conversation.id)?.messages[0]?.content
    ).toBe("A durable message");
    database.close();
  });

  it("marks interrupted streaming messages as stopped on startup", () => {
    const database = openDatabase(":memory:");
    const repositories = new Repositories(database);
    const conversation = repositories.createConversation();
    const message = repositories.addMessage(
      conversation.id,
      "assistant",
      "partial",
      "streaming"
    );
    database
      .prepare("UPDATE messages SET status='stopped' WHERE status='streaming'")
      .run();
    expect(
      repositories
        .getConversation(conversation.id)
        ?.messages.find((item) => item.id === message.id)?.status
    ).toBe("stopped");
    database.close();
  });

  it("persists data across a real file close and reopen", async () => {
    const root = await mkdtemp(join(tmpdir(), "contentdesk-database-"));
    const path = join(root, "contentdesk.sqlite");
    const first = openDatabase(path);
    const conversation = new Repositories(first).createConversation();
    first.close();
    const reopened = openDatabase(path);
    expect(
      new Repositories(reopened).getConversation(conversation.id)?.id
    ).toBe(conversation.id);
    reopened.close();
    await rm(root, { force: true, recursive: true });
  });
});
