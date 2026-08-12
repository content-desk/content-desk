import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  shell,
} from "electron";
import { z } from "zod";
import {
  channels,
  chatStartSchema,
  type IpcResult,
  providerInputSchema,
  runtimeKindSchema,
} from "../../shared/contracts";
import type { ChatService } from "../chat-service";
import { safeError } from "../chat-service";
import type { Repositories } from "../database/repositories";
import type { ProviderService } from "../providers/provider-service";
import type { RuntimeService } from "../runtimes/runtime-service";

interface Services {
  chat: ChatService;
  providers: ProviderService;
  repositories: Repositories;
  runtimes: RuntimeService;
}

export function registerIpc(services: Services): void {
  const handle = <T>(
    channel: string,
    action: (event: IpcMainInvokeEvent, input: unknown) => Promise<T> | T
  ) => {
    ipcMain.handle(channel, async (event, input): Promise<IpcResult<T>> => {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner) {
        return failure("FORBIDDEN", "Invalid IPC sender.");
      }
      try {
        return { data: await action(event, input), ok: true };
      } catch (error) {
        return failure(
          error instanceof z.ZodError ? "INVALID_INPUT" : "OPERATION_FAILED",
          safeError(error)
        );
      }
    });
  };

  handle(channels.providersList, () => services.providers.list());
  handle(channels.providersSave, (_event, input) =>
    services.providers.save(providerInputSchema.parse(input))
  );
  handle(channels.providersDelete, async (_event, input) => {
    await services.providers.delete(z.string().uuid().parse(input));
    return null;
  });
  handle(channels.providersTest, (_event, input) =>
    services.providers.test(z.string().uuid().parse(input))
  );

  handle(channels.runtimesList, () => services.runtimes.list());
  handle(channels.runtimesProbe, (_event, input) =>
    services.runtimes.probe(runtimeKindSchema.parse(input))
  );
  handle(channels.runtimesChooseExecutable, async (_event, input) => {
    const kind = runtimeKindSchema.exclude(["contentdesk-native"]).parse(input);
    const owner = BrowserWindow.fromWebContents(_event.sender);
    if (!owner) {
      throw new Error("Invalid IPC sender.");
    }
    const result = await dialog.showOpenDialog(owner, {
      properties: ["openFile"],
      title: `选择 ${kind} 可执行文件`,
    });
    const [path] = result.filePaths;
    return result.canceled || !path
      ? null
      : services.runtimes.setExecutable(kind, path);
  });
  handle(channels.runtimesChooseWorkingDirectory, async (_event, input) => {
    const kind = runtimeKindSchema.parse(input);
    const owner = BrowserWindow.fromWebContents(_event.sender);
    if (!owner) {
      throw new Error("Invalid IPC sender.");
    }
    const result = await dialog.showOpenDialog(owner, {
      properties: ["openDirectory"],
      title: "选择工作目录",
    });
    const [path] = result.filePaths;
    return result.canceled || !path
      ? null
      : services.runtimes.setWorkingDirectory(kind, path);
  });

  handle(channels.conversationsList, () =>
    services.repositories.listConversations()
  );
  handle(channels.conversationsGet, (_event, input) => {
    const conversation = services.repositories.getConversation(
      z.string().uuid().parse(input)
    );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    return conversation;
  });
  handle(channels.conversationsCreate, (_event, input) => {
    const value = z
      .object({
        model: z.string().max(160).optional(),
        providerId: z.string().uuid().optional(),
      })
      .parse(input);
    return services.repositories.createConversation(
      value.providerId,
      value.model
    );
  });
  handle(channels.conversationsDelete, async (_event, input) => {
    const id = z.string().uuid().parse(input);
    await services.chat.abortConversation(id);
    services.repositories.deleteConversation(id);
    return null;
  });

  handle(channels.chatStart, (event, input) => {
    services.chat.start(chatStartSchema.parse(input), event.sender);
    return { accepted: true as const };
  });
  handle(channels.chatStop, (event, input) => {
    services.chat.stop(z.string().uuid().parse(input), event.sender);
    return null;
  });
  handle(channels.chatRetry, (event, input) => {
    const value = chatStartSchema.omit({ content: true }).parse(input);
    services.chat.start({ ...value, content: "retry" }, event.sender, true);
    return { accepted: true as const };
  });
  handle(channels.externalOpen, async (_event, input) => {
    const url = z.string().url().parse(input);
    if (!url.startsWith("https://")) {
      throw new Error("Only HTTPS links can be opened.");
    }
    await shell.openExternal(url);
    return null;
  });
}

function failure<T>(code: string, message: string): IpcResult<T> {
  return { error: { code, message }, ok: false };
}
