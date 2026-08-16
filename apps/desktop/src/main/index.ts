import { join } from "node:path";
import { ChatService } from "@desktop/main/chat-service";
import { openDatabase } from "@desktop/main/database/database";
import { Repositories } from "@desktop/main/database/repositories";
import { registerIpc } from "@desktop/main/ipc/register-ipc";
import { ProviderService } from "@desktop/main/providers/provider-service";
import { RuntimeService } from "@desktop/main/runtimes/runtime-service";
import {
  ElectronSecretCrypto,
  SecretStore,
} from "@desktop/main/secrets/secret-store";
import { app, BrowserWindow, dialog, safeStorage, session } from "electron";

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    height: 820,
    minHeight: 620,
    minWidth: 900,
    title: "ContentDesk",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      sandbox: true,
    },
    width: 1240,
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
  return window;
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.contentdesk.desktop");
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false)
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  let database: ReturnType<typeof openDatabase>;
  try {
    database = openDatabase(
      join(app.getPath("userData"), "contentdesk.sqlite")
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    dialog.showErrorBox(
      "ContentDesk 无法启动",
      `数据库初始化失败。原数据库未被删除。\n\n${message}`
    );
    app.quit();
    return;
  }
  const repositories = new Repositories(database);
  const secrets = new SecretStore(
    app.getPath("userData"),
    new ElectronSecretCrypto(safeStorage)
  );
  const providers = new ProviderService(repositories, secrets);
  const runtimes = new RuntimeService(repositories);
  const chat = new ChatService(repositories, providers);
  let readyToQuit = false;
  let shutdownStarted = false;
  const shutdown = async () => {
    try {
      await chat.shutdown();
    } finally {
      database.close();
      readyToQuit = true;
      app.quit();
    }
  };
  registerIpc({ chat, providers, repositories, runtimes });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  app.on("before-quit", (event) => {
    if (readyToQuit) {
      return;
    }
    event.preventDefault();
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    shutdown();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
