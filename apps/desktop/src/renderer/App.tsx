import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import type {
  ChatMessage,
  Conversation,
  ConversationDetail,
  ProviderInput,
  ProviderKind,
  ProviderView,
  RuntimeProfile,
} from "../shared/contracts";

type Screen = "chat" | "settings";
const kinds: { value: ProviderKind; label: string }[] = [
  { label: "OpenAI Compatible", value: "openai-compatible" },
  { label: "Anthropic Compatible", value: "anthropic-compatible" },
  { label: "Azure OpenAI（暂不支持）", value: "azure-openai" },
  { label: "Vertex AI（暂不支持）", value: "vertex-ai" },
  { label: "Amazon Bedrock（暂不支持）", value: "amazon-bedrock" },
];

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
  const [error, setError] = useState<string | null>(null);
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
  }, []);

  const refreshConversation = useCallback(async (conversationId: string) => {
    const result = await window.contentDesk.conversations.get(conversationId);
    if (result.ok) {
      setActive((current) =>
        current?.id === conversationId ? result.data : current
      );
    }
    const list = await window.contentDesk.conversations.list();
    if (list.ok) {
      setConversations(list.data);
    }
  }, []);

  useEffect(() => {
    reload().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "加载失败。")
    );
  }, [reload]);
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
    [refreshConversation]
  );

  const newConversation = async () => {
    const result = await window.contentDesk.conversations.create({
      model: model || undefined,
      providerId: selectedProvider || undefined,
    });
    if (result.ok) {
      setActive(result.data);
      await reload();
    } else {
      setError(result.error.message);
    }
  };

  const openConversation = async (id: string) => {
    const result = await window.contentDesk.conversations.get(id);
    if (result.ok) {
      setActive(result.data);
      if (result.data.providerId) {
        setSelectedProvider(result.data.providerId);
      }
      if (result.data.model) {
        setModel(result.data.model);
      }
    } else {
      setError(result.error.message);
    }
  };

  const deleteConversation = async (id: string) => {
    const result = await window.contentDesk.conversations.delete(id);
    if (!result.ok) {
      setError(result.error.message);
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
      const created = await window.contentDesk.conversations.create({
        model,
        providerId: selectedProvider,
      });
      if (!created.ok) {
        return setError(created.error.message);
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
    const result = await window.contentDesk.chat.start({
      content,
      conversationId: conversation.id,
      model,
      providerId: selectedProvider,
      runId: id,
      runtimeKind: "contentdesk-native",
    });
    if (!result.ok) {
      runRef.current = null;
      setRunId(null);
      setError(result.error.message);
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
    const result = await window.contentDesk.chat.retry({
      conversationId: active.id,
      model,
      providerId: selectedProvider,
      runId: id,
      runtimeKind: "contentdesk-native",
    });
    if (!result.ok) {
      runRef.current = null;
      setRunId(null);
      setError(result.error.message);
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
          <Chat
            active={active}
            error={error}
            input={input}
            model={model}
            onInput={setInput}
            onModel={setModel}
            onOpenExternal={(url) => window.contentDesk.openExternal(url)}
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
                window.contentDesk.chat.stop(runId);
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
          <Settings
            error={error}
            providers={providers}
            reload={reload}
            runtimes={runtimes}
            setError={setError}
          />
        )}
      </main>
    </div>
  );
}

function Chat(props: {
  active: ConversationDetail | null;
  providers: ProviderView[];
  selectedProvider: string;
  model: string;
  input: string;
  streamed: string;
  runId: string | null;
  runConversationId: string | null;
  error: string | null;
  onProvider: (id: string) => void;
  onModel: (value: string) => void;
  onInput: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onStop: () => void;
  onRetry: () => void;
  onOpenExternal: (url: string) => void;
}) {
  return (
    <section className="chat-screen">
      <header>
        <div>
          <h1>{props.active?.title ?? "开始创作"}</h1>
          <p>ContentDesk Native Chat</p>
        </div>
        <div className="controls">
          <select
            onChange={(event) => props.onProvider(event.target.value)}
            value={props.selectedProvider}
          >
            <option value="">选择 Provider</option>
            {props.providers
              .filter((provider) => provider.supported)
              .map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
          </select>
          <input
            aria-label="模型"
            onChange={(event) => props.onModel(event.target.value)}
            placeholder="Model"
            value={props.model}
          />
        </div>
      </header>
      <div className="messages">
        {!props.active?.messages.length && (
          <div className="empty">
            <h2>想从哪里开始？</h2>
            <p>配置一个 Provider，然后在本地保存的对话中开始写作。</p>
          </div>
        )}
        {props.active?.messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onOpenExternal={props.onOpenExternal}
          />
        ))}
        {props.runId && props.active?.id === props.runConversationId ? (
          <Message
            message={{
              ...optimisticMessage(props.active.id, props.streamed),
              role: "assistant",
              status: "streaming",
            }}
            onOpenExternal={props.onOpenExternal}
          />
        ) : null}
      </div>
      <form className="composer" onSubmit={props.onSubmit}>
        {props.error ? <p className="error">{props.error}</p> : null}
        <textarea
          onChange={(event) => props.onInput(event.target.value)}
          placeholder="输入消息…"
          rows={3}
          value={props.input}
        />
        <div>
          <span>消息和 Provider 配置保存在本机</span>
          {props.runId ? (
            <button onClick={props.onStop} type="button">
              停止
            </button>
          ) : (
            <div className="composer-actions">
              {canRetry(props.active) ? (
                <button onClick={props.onRetry} type="button">
                  重试
                </button>
              ) : null}
              <button
                className="primary"
                disabled={
                  !(props.selectedProvider && props.model && props.input.trim())
                }
                type="submit"
              >
                发送
              </button>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

function canRetry(conversation: ConversationDetail | null): boolean {
  const last = conversation?.messages.at(-1);
  return (
    last?.role === "assistant" &&
    (last.status === "error" || last.status === "stopped")
  );
}

function Message({
  message,
  onOpenExternal,
}: {
  message: ChatMessage;
  onOpenExternal: (url: string) => void;
}) {
  return (
    <article className={`message ${message.role}`}>
      <div className="avatar">{message.role === "user" ? "你" : "C"}</div>
      <div>
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  if (href) {
                    onOpenExternal(href);
                  }
                }}
              >
                {children}
              </a>
            ),
          }}
        >
          {message.content || "…"}
        </ReactMarkdown>
        {message.status === "error" && (
          <small className="error">{message.error}</small>
        )}
      </div>
    </article>
  );
}

function Settings({
  providers,
  error,
  runtimes,
  reload,
  setError,
}: {
  providers: ProviderView[];
  error: string | null;
  runtimes: RuntimeProfile[];
  reload: () => Promise<void>;
  setError: (value: string | null) => void;
}) {
  const [tab, setTab] = useState<"providers" | "runtimes">("providers");
  const empty: ProviderInput = {
    apiKey: "",
    baseUrl: "",
    clearHeaders: false,
    headers: {},
    kind: "openai-compatible",
    model: "",
    name: "",
  };
  const [form, setForm] = useState<ProviderInput>(empty);
  const [headers, setHeaders] = useState("{}");
  const [notice, setNotice] = useState<string | null>(null);
  const edit = (provider: ProviderView) => {
    setForm({
      baseUrl: provider.baseUrl ?? "",
      clearHeaders: false,
      headers: {},
      id: provider.id,
      kind: provider.kind,
      model: provider.model,
      name: provider.name,
    });
    setHeaders("{}");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await window.contentDesk.providers.save({
        ...form,
        baseUrl: form.baseUrl || undefined,
        headers: JSON.parse(headers) as Record<string, string>,
      });
      if (result.ok) {
        setNotice("Provider 已保存。");
        setError(null);
        setForm(empty);
        setHeaders("{}");
        await reload();
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("Custom Headers 必须是 JSON 对象。");
    }
  };
  const testProvider = async () => {
    if (!form.id) {
      return;
    }
    const result = await window.contentDesk.providers.test(form.id);
    if (result.ok) {
      setNotice(`连接成功，耗时 ${result.data.latencyMs} ms。`);
      setError(null);
    } else {
      setNotice(null);
      setError(result.error.message);
    }
  };
  const deleteProvider = async () => {
    if (!form.id) {
      return;
    }
    const result = await window.contentDesk.providers.delete(form.id);
    if (result.ok) {
      setForm(empty);
      setNotice("Provider 已删除。");
      await reload();
    } else {
      setError(result.error.message);
    }
  };
  return (
    <section className="settings">
      <header>
        <h1>设置</h1>
        <p>管理模型连接和只读 Agent Runtime 探测。</p>
      </header>
      {error ? <p className="settings-error error">{error}</p> : null}
      <div className="tabs">
        <button
          className={tab === "providers" ? "active" : ""}
          onClick={() => setTab("providers")}
          type="button"
        >
          Providers
        </button>
        <button
          className={tab === "runtimes" ? "active" : ""}
          onClick={() => setTab("runtimes")}
          type="button"
        >
          Agent Runtimes
        </button>
      </div>
      {tab === "providers" ? (
        <div className="settings-grid">
          <div className="cards">
            <h2>已配置</h2>
            {providers.map((provider) => (
              <button
                className="card"
                key={provider.id}
                onClick={() => edit(provider)}
                type="button"
              >
                <strong>{provider.name}</strong>
                <span>
                  {provider.kind} · {provider.model}
                </span>
                <small>
                  {provider.supported
                    ? "可用于 Native Chat"
                    : "当前版本暂不支持"}
                </small>
              </button>
            ))}
          </div>
          <form className="panel" onSubmit={save}>
            <h2>{form.id ? "编辑 Provider" : "新增 Provider"}</h2>
            <label>
              名称
              <input
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                value={form.name}
              />
            </label>
            <label>
              类型
              <select
                onChange={(event) =>
                  setForm({ ...form, kind: event.target.value as ProviderKind })
                }
                value={form.kind}
              >
                {kinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Base URL
              <input
                onChange={(event) =>
                  setForm({ ...form, baseUrl: event.target.value })
                }
                placeholder="https://api.example.com/v1"
                value={form.baseUrl}
              />
            </label>
            <label>
              Model
              <input
                onChange={(event) =>
                  setForm({ ...form, model: event.target.value })
                }
                required
                value={form.model}
              />
            </label>
            <label>
              API Key
              <input
                onChange={(event) =>
                  setForm({ ...form, apiKey: event.target.value })
                }
                placeholder={form.id ? "留空以保留已有值" : "仅加密保存在本机"}
                type="password"
                value={form.apiKey ?? ""}
              />
            </label>
            <label>
              Custom Headers（JSON）
              <textarea
                onChange={(event) => setHeaders(event.target.value)}
                rows={4}
                value={headers}
              />
            </label>
            {form.id &&
            providers.find((provider) => provider.id === form.id)?.headerNames
              .length ? (
              <label>
                <input
                  checked={form.clearHeaders ?? false}
                  onChange={(event) =>
                    setForm({ ...form, clearHeaders: event.target.checked })
                  }
                  type="checkbox"
                />
                清除已有 Custom Headers
              </label>
            ) : null}
            <button className="primary" type="submit">
              保存
            </button>
            {form.id ? (
              <div className="form-actions">
                <button onClick={testProvider} type="button">
                  测试连接
                </button>
                <button onClick={deleteProvider} type="button">
                  删除
                </button>
              </div>
            ) : null}
            {notice ? <p className="success">{notice}</p> : null}
          </form>
        </div>
      ) : (
        <div className="cards runtime-list">
          {runtimes.map((runtime) => (
            <div className="card" key={runtime.kind}>
              <strong>{runtime.name}</strong>
              <span>{runtime.capabilities.join(" · ")}</span>
              <small>
                {runtime.available
                  ? (runtime.version ?? "可用")
                  : (runtime.lastError ?? "未探测")}
              </small>
              {runtime.kind !== "contentdesk-native" && (
                <div>
                  <button
                    onClick={async () => {
                      const result = await window.contentDesk.runtimes.probe(
                        runtime.kind
                      );
                      if (!result.ok) {
                        setError(result.error.message);
                        return;
                      }
                      setError(null);
                      await reload();
                    }}
                    type="button"
                  >
                    探测
                  </button>
                  <button
                    onClick={async () => {
                      const result =
                        await window.contentDesk.runtimes.chooseExecutable(
                          runtime.kind as "codex" | "claude-code"
                        );
                      if (!result.ok) {
                        setError(result.error.message);
                        return;
                      }
                      setError(null);
                      await reload();
                    }}
                    type="button"
                  >
                    选择程序
                  </button>
                </div>
              )}
              <div>
                <button
                  onClick={async () => {
                    const result =
                      await window.contentDesk.runtimes.chooseWorkingDirectory(
                        runtime.kind
                      );
                    if (!result.ok) {
                      setError(result.error.message);
                      return;
                    }
                    setError(null);
                    await reload();
                  }}
                  type="button"
                >
                  选择工作目录
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function optimisticMessage(
  conversationId: string,
  content: string
): ChatMessage {
  return {
    content,
    conversationId,
    createdAt: new Date().toISOString(),
    error: null,
    id: crypto.randomUUID(),
    role: "user",
    status: "complete",
  };
}
