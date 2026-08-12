import { describe, expect, it } from "vitest";
import {
  chatStartSchema,
  providerInputSchema,
} from "../../src/shared/contracts";

describe("IPC contracts", () => {
  it("rejects malformed providers and chat runtimes", () => {
    expect(
      providerInputSchema.safeParse({
        headers: {},
        kind: "openai-compatible",
        model: "x",
        name: "",
      }).success
    ).toBe(false);
    expect(
      chatStartSchema.safeParse({
        content: "hello",
        conversationId: crypto.randomUUID(),
        model: "x",
        providerId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        runtimeKind: "arbitrary-command",
      }).success
    ).toBe(false);
  });

  it("allows plaintext HTTP only for loopback Provider endpoints", () => {
    const input = {
      headers: {},
      kind: "openai-compatible" as const,
      model: "x",
      name: "Provider",
    };
    expect(
      providerInputSchema.safeParse({
        ...input,
        baseUrl: "http://127.0.0.1:3000/v1",
      }).success
    ).toBe(true);
    expect(
      providerInputSchema.safeParse({
        ...input,
        baseUrl: "http://provider.example/v1",
      }).success
    ).toBe(false);
  });

  it("keeps secret mutation controls out of provider views", () => {
    const parsed = providerInputSchema.parse({
      clearHeaders: true,
      headers: {},
      kind: "openai-compatible",
      model: "x",
      name: "Provider",
    });
    expect(parsed.clearHeaders).toBe(true);
  });
});
