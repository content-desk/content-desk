import type { IpcResult } from "@desktop/shared/contracts";
import { useCallback, useState } from "react";

export type DesktopActionResult<T> = { data: T; ok: true } | { ok: false };

export type DesktopAction = <T>(
  request: () => Promise<IpcResult<T>>
) => Promise<DesktopActionResult<T>>;

export function unwrapIpcResult<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
}

export function useDesktopAction(): {
  error: string | null;
  execute: DesktopAction;
  setError: (error: string | null) => void;
} {
  const [error, setError] = useState<string | null>(null);
  const execute = useCallback<DesktopAction>(async (request) => {
    try {
      const data = unwrapIpcResult(await request());
      setError(null);
      return { data, ok: true };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败。");
      return { ok: false };
    }
  }, []);
  return { error, execute, setError };
}
