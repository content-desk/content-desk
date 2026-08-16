import { optimisticMessage } from "@desktop/renderer/optimistic-message";
import type {
  ChatMessage,
  ConversationDetail,
  ProviderView,
} from "@desktop/shared/contracts";
import type { FormEventHandler } from "react";
import ReactMarkdown from "react-markdown";

interface ChatScreenProps {
  active: ConversationDetail | null;
  error: string | null;
  input: string;
  model: string;
  onInput: (value: string) => void;
  onModel: (value: string) => void;
  onOpenExternal: (url: string) => void;
  onProvider: (id: string) => void;
  onRetry: () => void;
  onStop: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  providers: ProviderView[];
  runConversationId: string | null;
  runId: string | null;
  selectedProvider: string;
  streamed: string;
}

export function ChatScreen(props: ChatScreenProps) {
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
