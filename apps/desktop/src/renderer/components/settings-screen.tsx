import { ProviderSettings } from "@desktop/renderer/components/provider-settings";
import { RuntimeSettings } from "@desktop/renderer/components/runtime-settings";
import type { DesktopAction } from "@desktop/renderer/use-desktop-action";
import type { ProviderView, RuntimeProfile } from "@desktop/shared/contracts";
import { useState } from "react";

interface SettingsScreenProps {
  error: string | null;
  execute: DesktopAction;
  onReload: () => Promise<void>;
  providers: ProviderView[];
  runtimes: RuntimeProfile[];
  setError: (value: string | null) => void;
}

export function SettingsScreen({
  error,
  execute,
  onReload,
  providers,
  runtimes,
  setError,
}: SettingsScreenProps) {
  const [tab, setTab] = useState<"providers" | "runtimes">("providers");
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
        <ProviderSettings
          execute={execute}
          onReload={onReload}
          providers={providers}
          setError={setError}
        />
      ) : (
        <RuntimeSettings
          execute={execute}
          onReload={onReload}
          runtimes={runtimes}
        />
      )}
    </section>
  );
}
