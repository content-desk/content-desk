import { registerIpc } from "@desktop/main/ipc/register-ipc";
import { channels, type IpcResult } from "@desktop/shared/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (
  event: { sender: object },
  input: unknown
) => Promise<IpcResult<unknown>>;

const electron = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();
  return {
    fromWebContents: vi.fn(),
    handlers,
    openExternal: vi.fn(),
    showOpenDialog: vi.fn(),
  };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: electron.fromWebContents },
  dialog: { showOpenDialog: electron.showOpenDialog },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      electron.handlers.set(channel, handler);
    },
  },
  shell: { openExternal: electron.openExternal },
}));

beforeEach(() => {
  electron.handlers.clear();
  electron.fromWebContents.mockReset();
  electron.showOpenDialog.mockReset();
});

describe("Desktop IPC registration", () => {
  it("returns FORBIDDEN before invoking an action for an invalid sender", async () => {
    const services = createServices();
    electron.fromWebContents.mockReturnValue(null);
    registerIpc(services.value);

    const result = await requireHandler(channels.providersList)(
      { sender: {} },
      undefined
    );

    expect(result).toEqual({
      error: { code: "FORBIDDEN", message: "Invalid IPC sender." },
      ok: false,
    });
    expect(services.providersList).not.toHaveBeenCalled();
  });

  it("passes the already-validated owner to the executable dialog", async () => {
    const services = createServices();
    const owner = { id: "owner" };
    electron.fromWebContents.mockReturnValue(owner);
    electron.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/usr/local/bin/codex"],
    });
    registerIpc(services.value);

    const result = await requireHandler(channels.runtimesChooseExecutable)(
      { sender: {} },
      "codex"
    );

    expect(result).toEqual({ data: { kind: "codex" }, ok: true });
    expect(electron.fromWebContents).toHaveBeenCalledTimes(1);
    expect(electron.showOpenDialog).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ properties: ["openFile"] })
    );
    expect(services.setExecutable).toHaveBeenCalledWith(
      "codex",
      "/usr/local/bin/codex"
    );
  });
});

function requireHandler(channel: string): Handler {
  const handler = electron.handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing IPC handler for ${channel}.`);
  }
  return handler;
}

function createServices() {
  const providersList = vi.fn(() => []);
  const setExecutable = vi.fn((kind: string) => ({ kind }));
  return {
    providersList,
    setExecutable,
    value: {
      chat: {
        abortConversation: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      },
      providers: {
        delete: vi.fn(),
        list: providersList,
        save: vi.fn(),
        test: vi.fn(),
      },
      repositories: {
        createConversation: vi.fn(),
        deleteConversation: vi.fn(),
        getConversation: vi.fn(),
        listConversations: vi.fn(),
      },
      runtimes: {
        list: vi.fn(),
        probe: vi.fn(),
        setExecutable,
      },
    } as unknown as Parameters<typeof registerIpc>[0],
  };
}
