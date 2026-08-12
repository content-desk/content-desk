import { join } from "node:path";
import { app, BrowserWindow, safeStorage, session } from "electron";
import { ChatService } from "./chat-service";
import { openDatabase } from "./database/database";
import { Repositories } from "./database/repositories";
import { registerIpc } from "./ipc/register-ipc";
import { ProviderService } from "./providers/provider-service";
import { RuntimeService } from "./runtimes/runtime-service";
import { ElectronSecretCrypto, SecretStore } from "./secrets/secret-store";

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
  const database = openDatabase(
    join(app.getPath("userData"), "contentdesk.sqlite")
  );
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
