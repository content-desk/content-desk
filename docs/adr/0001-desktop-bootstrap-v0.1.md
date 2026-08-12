# ADR-0001：Desktop Bootstrap v0.1

- 状态：Accepted
- 日期：2026-08-11

## 决策

1. Desktop 使用 Electron 43.3.0、electron-vite 5.0.0 和 Vite 7.3.1。Main、Preload、Renderer 严格分层，Renderer 不接触 Node、SQLite 或 Secret。
2. 本地数据使用 Electron 内置 Node 24.17 的 `node:sqlite`，直接实现有限的 migration runner 与 Repository，不引入 Drizzle RC 或 native addon。
3. Secret 使用 Electron `safeStorage` async API。密文文件原子写入、权限为 `0600`；数据库只保存引用、是否已配置和 Header 名称。
4. 文本模型统一通过 AI SDK。v0.1 只启用 OpenAI Compatible 与 Anthropic Compatible；Azure、Vertex、Bedrock 不提供伪实现或 fallback。
5. ContentDesk Native 是唯一 Chat Runtime。Codex 与 Claude Code 是独立的 Agent Runtime Profile，只允许受控发现和固定版本探测。
6. Typed IPC 是唯一 Renderer 到 Main 边界。Preload 不暴露 `ipcRenderer`，流事件绑定 `runId` 与发送窗口，Stop 和窗口销毁通过 `AbortController` 回收。

## 选择理由

该设计以最小范围贯通真实的本地对话路径，同时避免把远期 Project 模型、CLI Agent 协议或多云认证提前塞入 Bootstrap。`node:sqlite` 在 Electron 43 对应的 Node 24.17 中可用，但 Node 24 文档仍将其标注为 release candidate；因此迁移保持简单、可测试，并避免额外 ABI 风险。

## 安全约束

- BrowserWindow：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- CSP 禁止 Renderer 网络连接；所有 Provider 请求由 Main 发起。
- Provider 远程 Base URL 强制 HTTPS，HTTP 仅允许 loopback；类型或 Endpoint 变化时不继承旧 Secret。
- Navigation、`window.open` 与权限请求默认拒绝；外链只允许 Main 打开 HTTPS。
- Runtime 自动发现直接遍历 PATH，不调用 shell 或 `which`；手工选择由 native dialog 进入并验证 realpath、普通文件与可执行权限。
- Runtime 启动固定为 `codex --version` 或 `claude --version`，`shell: false`，5 秒超时，输出上限 16 KiB。
- 不修改 Codex、Claude Code 或其他工具的认证与全局配置。
- Chat Run 绑定 `runId`、Conversation 与 WebContents；删除 Conversation 或退出前先 Abort 并等待 Run 收尾。

## 官方依据

- [Electron 43.0 发布说明](https://www.electronjs.org/blog/electron-43-0)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [electron-vite Guide](https://electron-vite.org/guide/)
- [electron-vite Isolated Build](https://electron-vite.org/guide/isolated-build)
- [electron-builder Configuration](https://www.electron.build/docs/configuration/)
- [Node.js 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [AI SDK OpenAI-compatible Providers](https://ai-sdk.dev/providers/openai-compatible-providers)
- [AI SDK streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Playwright Electron](https://playwright.dev/docs/api/class-electron)

## 后果

当前数据模型是 Desktop 专用 Bootstrap 数据面，不与 Server 的 PostgreSQL Better Auth Schema 共用。未来 Project 成为事实中心时需要新 ADR；本 ADR 不预设迁移或兼容层。
