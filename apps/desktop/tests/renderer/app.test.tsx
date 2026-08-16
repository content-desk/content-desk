// @vitest-environment jsdom

import { App } from "@desktop/renderer/App";
import type {
  ChatEvent,
  ConversationDetail,
  DesktopApi,
  IpcResult,
  ProviderView,
  RuntimeProfile,
} from "@desktop/shared/contracts";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const providerId = "10000000-0000-4000-8000-000000000001";
const conversationAId = "20000000-0000-4000-8000-000000000001";
const conversationBId = "20000000-0000-4000-8000-000000000002";
const now = "2026-08-11T00:00:00.000Z";
const mockProviderName = /Mock Provider/;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Desktop renderer", () => {
  it("settles a run when delta and done arrive before chat.start resolves", async () => {
    const state = createDesktopMock();
    state.api.chat.start = vi.fn((input) => {
      const userMessage = message(input.conversationId, "user", input.content);
      const assistant = message(
        input.conversationId,
        "assistant",
        "fast answer"
      );
      state.details.set(input.conversationId, {
        ...requiredDetail(state.details, input.conversationId),
        messages: [userMessage, assistant],
      });
      state.emit({ runId: input.runId, text: "fast ", type: "delta" });
      state.emit({ message: assistant, runId: input.runId, type: "done" });
      return Promise.resolve(ok({ accepted: true as const }));
    });
    installDesktopApi(state.api);
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Conversation A" })
    );
    await user.type(screen.getByPlaceholderText("输入消息…"), "hello");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "停止" })).toBeNull()
    );
    expect(await screen.findByText("fast answer")).toBeTruthy();
  });

  it("keeps an active run bound to its original conversation", async () => {
    const state = createDesktopMock();
    let acceptStart: (value: IpcResult<{ accepted: true }>) => void = () =>
      undefined;
    const startResult = new Promise<IpcResult<{ accepted: true }>>(
      (resolve) => {
        acceptStart = resolve;
      }
    );
    let runId = "";
    state.api.chat.start = vi.fn((input) => {
      ({ runId } = input);
      return startResult;
    });
    installDesktopApi(state.api);
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Conversation A" })
    );
    await user.type(screen.getByPlaceholderText("输入消息…"), "hello");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(runId).not.toBe(""));
    await user.click(screen.getByRole("button", { name: "Conversation B" }));

    act(() => {
      state.emit({ runId, text: "only for A", type: "delta" });
    });
    expect(
      screen.getByRole("heading", { name: "Conversation B" })
    ).toBeTruthy();
    expect(screen.queryByText("only for A")).toBeNull();

    const assistant = message(conversationAId, "assistant", "A completed");
    state.details.set(conversationAId, {
      ...requiredDetail(state.details, conversationAId),
      messages: [assistant],
    });
    act(() => {
      state.emit({ message: assistant, runId, type: "done" });
      acceptStart(ok({ accepted: true }));
    });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "停止" })).toBeNull()
    );
    expect(
      screen.getByRole("heading", { name: "Conversation B" })
    ).toBeTruthy();
    expect(screen.queryByText("A completed")).toBeNull();
  });

  it("shows Conversation failures in the Chat interface", async () => {
    const state = createDesktopMock();
    state.api.conversations.get = vi.fn(async () => failure("对话加载失败。"));
    installDesktopApi(state.api);
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Conversation A" })
    );

    expect(await screen.findByText("对话加载失败。")).toBeTruthy();
  });

  it("shows Chat start failures and rolls back the active run", async () => {
    const state = createDesktopMock();
    state.api.chat.start = vi.fn(async () => failure("对话运行失败。"));
    installDesktopApi(state.api);
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Conversation A" })
    );
    await user.type(screen.getByPlaceholderText("输入消息…"), "hello");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("对话运行失败。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "停止" })).toBeNull();
  });

  it("shows Provider failures in Settings", async () => {
    const state = createDesktopMock();
    state.api.providers.save = vi.fn(async () =>
      failure("Provider 保存失败。")
    );
    installDesktopApi(state.api);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: mockProviderName }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("Provider 保存失败。")).toBeTruthy();
  });

  it.each([
    ["探测", "probe"],
    ["选择程序", "chooseExecutable"],
  ] as const)(
    "shows Runtime %s failures in Settings",
    async (label, method) => {
      const state = createDesktopMock();
      const runtimeFailure = async () => ({
        error: { code: "RUNTIME_TEST", message: `${label}失败。` },
        ok: false as const,
      });
      if (method === "probe") {
        state.api.runtimes.probe = vi.fn(runtimeFailure);
      } else {
        state.api.runtimes.chooseExecutable = vi.fn(runtimeFailure);
      }
      installDesktopApi(state.api);
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole("button", { name: "设置" }));
      await user.click(screen.getByRole("button", { name: "Agent Runtimes" }));
      const codexCard = screen.getByText("Codex").closest(".card");
      expect(codexCard).not.toBeNull();
      await user.click(
        within(codexCard as HTMLElement).getByRole("button", { name: label })
      );

      expect(await screen.findByText(`${label}失败。`)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "选择工作目录" })).toBeNull();
    }
  );
});

function createDesktopMock() {
  let listener: ((event: ChatEvent) => void) | undefined;
  const details = new Map<string, ConversationDetail>([
    [conversationAId, conversation("Conversation A", conversationAId)],
    [conversationBId, conversation("Conversation B", conversationBId)],
  ]);
  const provider: ProviderView = {
    createdAt: now,
    hasApiKey: true,
    headerNames: [],
    id: providerId,
    kind: "openai-compatible",
    model: "mock-model",
    name: "Mock Provider",
    supported: true,
    updatedAt: now,
  };
  const codexRuntime = runtime("codex", "Codex");
  const runtimes: RuntimeProfile[] = [
    runtime("contentdesk-native", "ContentDesk Native"),
    codexRuntime,
  ];
  const api: DesktopApi = {
    chat: {
      onEvent: (next) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      retry: vi.fn(async () => ok({ accepted: true as const })),
      start: vi.fn(async () => ok({ accepted: true as const })),
      stop: vi.fn(async () => ok(null)),
    },
    conversations: {
      create: vi.fn(async () => ok(requiredDetail(details, conversationAId))),
      delete: vi.fn(async () => ok(null)),
      get: vi.fn(async (id) => ok(requiredDetail(details, id))),
      list: vi.fn(async () =>
        ok(
          [...details.values()].map(({ messages: _messages, ...item }) => item)
        )
      ),
    },
    openExternal: vi.fn(async () => ok(null)),
    providers: {
      delete: vi.fn(async () => ok(null)),
      list: vi.fn(async () => ok([provider])),
      save: vi.fn(async () => ok(provider)),
      test: vi.fn(async () => ok({ latencyMs: 1 })),
    },
    runtimes: {
      chooseExecutable: vi.fn(async () => ok(runtimes[1] ?? null)),
      list: vi.fn(async () => ok(runtimes)),
      probe: vi.fn(async () => ok(codexRuntime)),
    },
  };
  return {
    api,
    details,
    emit: (event: ChatEvent) => listener?.(event),
  };
}

function installDesktopApi(api: DesktopApi): void {
  Object.defineProperty(window, "contentDesk", {
    configurable: true,
    value: api,
  });
}

function requiredDetail(
  details: Map<string, ConversationDetail>,
  id: string
): ConversationDetail {
  const detail = details.get(id);
  if (!detail) {
    throw new Error(`Missing test conversation: ${id}`);
  }
  return detail;
}

function ok<T>(data: T): IpcResult<T> {
  return { data, ok: true };
}

function failure(errorMessage: string): IpcResult<never> {
  return {
    error: { code: "TEST_FAILURE", message: errorMessage },
    ok: false,
  };
}

function conversation(title: string, id: string): ConversationDetail {
  return {
    createdAt: now,
    id,
    messages: [],
    model: "mock-model",
    providerId,
    runtimeKind: "contentdesk-native",
    title,
    updatedAt: now,
  };
}

function message(
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  return {
    content,
    conversationId,
    createdAt: now,
    error: null,
    id: crypto.randomUUID(),
    role,
    status: "complete" as const,
  };
}

function runtime(kind: RuntimeProfile["kind"], name: string): RuntimeProfile {
  return {
    available: kind === "contentdesk-native",
    capabilities: kind === "contentdesk-native" ? ["chat"] : ["probe"],
    enabled: true,
    executablePath: null,
    kind,
    lastError: null,
    lastProbedAt: null,
    name,
    version: null,
  };
}
