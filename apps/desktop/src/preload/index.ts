import { contextBridge, ipcRenderer } from "electron";
import {
  channels,
  chatEventSchema,
  type DesktopApi,
} from "../shared/contracts";

const invoke = <T>(channel: string, input?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, input);

const api: DesktopApi = {
  chat: {
    onEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
        const parsed = chatEventSchema.safeParse(value);
        if (parsed.success) {
          listener(parsed.data);
        }
      };
      ipcRenderer.on(channels.chatEvent, handler);
      return () => ipcRenderer.removeListener(channels.chatEvent, handler);
    },
    retry: (input) => invoke(channels.chatRetry, input),
    start: (input) => invoke(channels.chatStart, input),
    stop: (runId) => invoke(channels.chatStop, runId),
  },
  conversations: {
    create: (input) => invoke(channels.conversationsCreate, input),
    delete: (id) => invoke(channels.conversationsDelete, id),
    get: (id) => invoke(channels.conversationsGet, id),
    list: () => invoke(channels.conversationsList),
  },
  openExternal: (url) => invoke(channels.externalOpen, url),
  providers: {
    delete: (id) => invoke(channels.providersDelete, id),
    list: () => invoke(channels.providersList),
    save: (input) => invoke(channels.providersSave, input),
    test: (id) => invoke(channels.providersTest, id),
  },
  runtimes: {
    chooseExecutable: (kind) => invoke(channels.runtimesChooseExecutable, kind),
    chooseWorkingDirectory: (kind) =>
      invoke(channels.runtimesChooseWorkingDirectory, kind),
    list: () => invoke(channels.runtimesList),
    probe: (kind) => invoke(channels.runtimesProbe, kind),
  },
};

contextBridge.exposeInMainWorld("contentDesk", api);
