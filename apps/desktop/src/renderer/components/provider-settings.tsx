import type { DesktopAction } from "@desktop/renderer/use-desktop-action";
import {
  isSupportedProviderKind,
  type ProviderInput,
  type ProviderKind,
  type ProviderView,
  providerKindSchema,
} from "@desktop/shared/contracts";
import { type FormEvent, useState } from "react";

const providerNames: Record<ProviderKind, string> = {
  "amazon-bedrock": "Amazon Bedrock",
  "anthropic-compatible": "Anthropic Compatible",
  "azure-openai": "Azure OpenAI",
  "openai-compatible": "OpenAI Compatible",
  "vertex-ai": "Vertex AI",
};

const emptyProvider: ProviderInput = {
  apiKey: "",
  baseUrl: "",
  clearHeaders: false,
  headers: {},
  kind: "openai-compatible",
  model: "",
  name: "",
};

interface ProviderSettingsProps {
  execute: DesktopAction;
  onReload: () => Promise<void>;
  providers: ProviderView[];
  setError: (value: string | null) => void;
}

export function ProviderSettings({
  execute,
  onReload,
  providers,
  setError,
}: ProviderSettingsProps) {
  const [form, setForm] = useState<ProviderInput>(emptyProvider);
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
    let parsedHeaders: Record<string, string>;
    try {
      parsedHeaders = JSON.parse(headers) as Record<string, string>;
    } catch {
      setError("Custom Headers 必须是 JSON 对象。");
      return;
    }
    const result = await execute(() =>
      window.contentDesk.providers.save({
        ...form,
        baseUrl: form.baseUrl || undefined,
        headers: parsedHeaders,
      })
    );
    if (!result.ok) {
      return;
    }
    setNotice("Provider 已保存。");
    setForm(emptyProvider);
    setHeaders("{}");
    await onReload();
  };

  const testProvider = async () => {
    const { id } = form;
    if (!id) {
      return;
    }
    const result = await execute(() => window.contentDesk.providers.test(id));
    if (result.ok) {
      setNotice(`连接成功，耗时 ${result.data.latencyMs} ms。`);
    } else {
      setNotice(null);
    }
  };

  const deleteProvider = async () => {
    const { id } = form;
    if (!id) {
      return;
    }
    const result = await execute(() => window.contentDesk.providers.delete(id));
    if (!result.ok) {
      return;
    }
    setForm(emptyProvider);
    setNotice("Provider 已删除。");
    await onReload();
  };

  return (
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
              {provider.supported ? "可用于 Native Chat" : "当前版本暂不支持"}
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
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            required
            value={form.name}
          />
        </label>
        <label>
          类型
          <select
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                kind: event.target.value as ProviderKind,
              }))
            }
            value={form.kind}
          >
            {providerKindSchema.options.map((kind) => (
              <option key={kind} value={kind}>
                {providerNames[kind]}
                {isSupportedProviderKind(kind) ? "" : "（暂不支持）"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Base URL
          <input
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                baseUrl: event.target.value,
              }))
            }
            placeholder="https://api.example.com/v1"
            value={form.baseUrl}
          />
        </label>
        <label>
          Model
          <input
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                model: event.target.value,
              }))
            }
            required
            value={form.model}
          />
        </label>
        <label>
          API Key
          <input
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                apiKey: event.target.value,
              }))
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
                setForm((current) => ({
                  ...current,
                  clearHeaders: event.target.checked,
                }))
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
  );
}
