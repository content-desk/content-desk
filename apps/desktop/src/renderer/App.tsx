import { ChatScreen } from "@desktop/renderer/components/chat-screen";
import { SettingsScreen } from "@desktop/renderer/components/settings-screen";
import { optimisticMessage } from "@desktop/renderer/optimistic-message";
import {
  unwrapIpcResult,
  useDesktopAction,
} from "@desktop/renderer/use-desktop-action";
import type {
  Conversation,
  ConversationDetail,
  ProviderView,
  RuntimeProfile,
} from "@desktop/shared/contracts";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Screen = "chat" | "settings";

export function App() {
  const [screen, setScreen] = useState<Screen>("chat");
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<ConversationDetail | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [streamed, setStreamed] = useState("");
  const { error, execute, setError } = useDesktopAction();
  const runRef = useRef<{ conversationId: string; id: string } | null>(null);

  const reload = useCallback(async () => {
    const [providerResult, runtimeResult, conversationResult] =
      await Promise.all([
        window.contentDesk.providers.list(),
        window.contentDesk.runtimes.list(),
        window.contentDesk.conversations.list(),
      ]);
    if (providerResult.ok) {
      setProviders(providerResult.data);
    }
    if (runtimeResult.ok) {
      setRuntimes(runtimeResult.data);
    }
    if (conversationResult.ok) {
      setConversations(conversationResult.data);
    }
    const failed = [providerResult, runtimeResult, conversationResult].find(
      (result) => !result.ok
    );
    setError(failed && !failed.ok ? failed.error.message : null);
    const first = providerResult.ok
      ? providerResult.data.find((provider) => provider.supported)
      : undefined;
    if (first) {
      setSelectedProvider((current) => {
        if (current) {
          return current;
        }
        setModel(first.model);
        return first.id;
      });
    }
  }, [setError]);

  const refreshConversation = useCallback(
    async (conversationId: string) => {
      let detail: ConversationDetail;
      try {
        detail = unwrapIpcResult(
          await window.contentDesk.conversations.get(conversationId)
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "刷新失败。");
        return;
      }
      setActive((current) =>
        current?.id === conversationId ? detail : current
      );
      try {
        setConversations(
          unwrapIpcResult(await window.contentDesk.conversations.list())
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "刷新失败。");
      }
    },
    [setError]
  );

  useEffect(() => {
    reload().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "加载失败。")
    );
  }, [reload, setError]);
  useEffect(
    () =>
      window.contentDesk.chat.onEvent((event) => {
        const currentRun = runRef.current;
        if (event.runId !== currentRun?.id) {
          return;
        }
        if (event.type === "delta") {
          setStreamed((value) => value + event.text);
        }
        if (event.type === "error") {
          setError(event.message);
          runRef.current = null;
          setRunId(null);
          refreshConversation(currentRun.conversationId).catch(() =>
            setError(event.message)
          );
        }
        if (event.type === "done" || event.type === "stopped") {
          runRef.current = null;
          setRunId(null);
          setStreamed("");
          refreshConversation(currentRun.conversationId).catch(
            (reason: unknown) =>
              setError(reason instanceof Error ? reason.message : "刷新失败。")
          );
        }
      }),
    [refreshConversation, setError]
  );

  const newConversation = async () => {
    const result = await execute(() =>
      window.contentDesk.conversations.create({
        model: model || undefined,
        providerId: selectedProvider || undefined,
      })
    );
    if (result.ok) {
      setActive(result.data);
      await reload();
    }
  };

  const openConversation = async (id: string) => {
    const result = await execute(() =>
      window.contentDesk.conversations.get(id)
    );
    if (!result.ok) {
      return;
    }
    setActive(result.data);
    if (result.data.providerId) {
      setSelectedProvider(result.data.providerId);
    }
    if (result.data.model) {
      setModel(result.data.model);
    }
  };

  const deleteConversation = async (id: string) => {
    const result = await execute(() =>
      window.contentDesk.conversations.delete(id)
    );
    if (!result.ok) {
      return;
    }
    if (active?.id === id) {
      setActive(null);
    }
    await reload();
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!(input.trim() && selectedProvider) || runId) {
      return;
    }
    let conversation = active;
    if (!conversation) {
      const created = await execute(() =>
        window.contentDesk.conversations.create({
          model,
          providerId: selectedProvider,
        })
      );
      if (!created.ok) {
        return;
      }
      conversation = created.data;
      setActive(conversation);
    }
    const id = crypto.randomUUID();
    const content = input.trim();
    setInput("");
    setStreamed("");
    runRef.current = { conversationId: conversation.id, id };
    setRunId(id);
    setError(null);
    setActive({
      ...conversation,
      messages: [
        ...conversation.messages,
        optimisticMessage(conversation.id, content),
      ],
    });
    const result = await execute(() =>
      window.contentDesk.chat.start({
        content,
        conversationId: conversation.id,
        model,
        providerId: selectedProvider,
        runId: id,
        runtimeKind: "contentdesk-native",
      })
    );
    if (!result.ok) {
      runRef.current = null;
      setRunId(null);
      await refreshConversation(conversation.id);
    }
  };

  const retry = async () => {
    if (!(active && selectedProvider && model) || runId) {
      return;
    }
    const id = crypto.randomUUID();
    runRef.current = { conversationId: active.id, id };
    setRunId(id);
    setStreamed("");
    setError(null);
    const result = await execute(() =>
      window.contentDesk.chat.retry({
        conversationId: active.id,
        model,
        providerId: selectedProvider,
        runId: id,
        runtimeKind: "contentdesk-native",
      })
    );
    if (!result.ok) {
      runRef.current = null;
      setRunId(null);
    }
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span className="brand-mark">C</span>
          <strong>ContentDesk</strong>
        </div>
        <nav>
          <button
            className={screen === "chat" ? "active" : ""}
            onClick={() => setScreen("chat")}
            type="button"
          >
            对话
          </button>
          <button
            className={screen === "settings" ? "active" : ""}
            onClick={() => setScreen("settings")}
            type="button"
          >
            设置
          </button>
        </nav>
        {screen === "chat" && (
          <div className="history">
            <button className="primary" onClick={newConversation} type="button">
              ＋ 新对话
            </button>
            {conversations.map((conversation) => (
              <div className="history-row" key={conversation.id}>
                <button
                  className={active?.id === conversation.id ? "selected" : ""}
                  onClick={() => openConversation(conversation.id)}
                  type="button"
                >
                  {conversation.title}
                </button>
                <button
                  aria-label={`删除 ${conversation.title}`}
                  onClick={() => deleteConversation(conversation.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <small>本地优先 · Desktop v0.1</small>
      </aside>
      <main>
        {screen === "chat" ? (
          <ChatScreen
            active={active}
            error={error}
            input={input}
            model={model}
            onInput={setInput}
            onModel={setModel}
            onOpenExternal={(url) => {
              execute(() => window.contentDesk.openExternal(url));
            }}
            onProvider={(id) => {
              const provider = providers.find((item) => item.id === id);
              setSelectedProvider(id);
              if (provider) {
                setModel(provider.model);
              }
            }}
            onRetry={retry}
            onStop={() => {
              if (runId) {
                execute(() => window.contentDesk.chat.stop(runId));
              }
            }}
            onSubmit={send}
            providers={providers}
            runConversationId={runRef.current?.conversationId ?? null}
            runId={runId}
            selectedProvider={selectedProvider}
            streamed={streamed}
          />
        ) : (
          <SettingsScreen
            error={error}
            execute={execute}
            onReload={reload}
            providers={providers}
            runtimes={runtimes}
            setError={setError}
          />
        )}
      </main>
    </div>
  );
}
