import type { DesktopAction } from "@desktop/renderer/use-desktop-action";
import type { RuntimeProfile } from "@desktop/shared/contracts";

interface RuntimeSettingsProps {
  execute: DesktopAction;
  onReload: () => Promise<void>;
  runtimes: RuntimeProfile[];
}

export function RuntimeSettings({
  execute,
  onReload,
  runtimes,
}: RuntimeSettingsProps) {
  const probe = async (runtime: RuntimeProfile) => {
    const result = await execute(() =>
      window.contentDesk.runtimes.probe(runtime.kind)
    );
    if (result.ok) {
      await onReload();
    }
  };

  const chooseExecutable = async (
    kind: Exclude<RuntimeProfile["kind"], "contentdesk-native">
  ) => {
    const result = await execute(() =>
      window.contentDesk.runtimes.chooseExecutable(kind)
    );
    if (result.ok) {
      await onReload();
    }
  };

  return (
    <div className="cards runtime-list">
      {runtimes.map((runtime) => {
        const externalKind =
          runtime.kind === "contentdesk-native" ? null : runtime.kind;
        return (
          <div className="card" key={runtime.kind}>
            <strong>{runtime.name}</strong>
            <span>{runtime.capabilities.join(" · ")}</span>
            <small>
              {runtime.available
                ? (runtime.version ?? "可用")
                : (runtime.lastError ?? "未探测")}
            </small>
            {externalKind ? (
              <div>
                <button onClick={() => probe(runtime)} type="button">
                  探测
                </button>
                <button
                  onClick={() => chooseExecutable(externalKind)}
                  type="button"
                >
                  选择程序
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
