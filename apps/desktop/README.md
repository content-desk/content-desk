# ContentDesk Desktop

ContentDesk Desktop v0.1 是本地优先 AI 创作工作台的首个可运行桌面基础。当前只包含 Native Chat、LLM Provider 设置和 Agent Runtime 只读探测；它不是完整的 Project 内容工作流。

## 开发

要求 Node.js 24、pnpm 11.21.0 和 macOS。首次安装依赖后运行：

```bash
pnpm run dev:desktop
```

Desktop 独立验证：

```bash
pnpm --filter @content-desk/desktop check
pnpm --filter @content-desk/desktop check-types
pnpm --filter @content-desk/desktop test
pnpm --filter @content-desk/desktop test:e2e
pnpm --filter @content-desk/desktop package
```

`package` 生成 unsigned macOS directory artifact，不签名、不公证、不发布。

本地手工验收建议按以下顺序进行：

1. 运行 `pnpm run dev:desktop`，确认 Chat、Providers、Agent Runtimes 三个主要界面无白屏。
2. 配置本地 Mock 或测试 Provider，创建对话并验证流式输出、停止、重试。
3. 完全退出后重新启动，确认 Conversation、Message 与非敏感 Provider 配置仍在。
4. 运行上方五条独立验证命令；E2E 使用本地 Mock，不需要真实云凭据。

## 当前能力

- OpenAI Compatible 和 Anthropic Compatible 文本聊天，支持流式输出、停止、重试和本地持久化。
- Azure OpenAI、Vertex AI 和 Amazon Bedrock 仅有配置 Schema，并明确显示为暂不支持。
- SQLite 保存 Provider 非敏感配置、对话、消息和 Runtime 状态。
- SQLite schema 由独立、连续编号的 SQL migrations 管理；SQL 在构建时内联到 Main bundle，打包应用不需要外部 migration 目录。
- API Key 与自定义 Header 值通过 Electron `safeStorage` 加密后写入 `userData/secrets`；SQLite 和 Renderer 不读取明文。
- Provider 远程 Endpoint 必须使用 HTTPS；HTTP 只允许 loopback。修改 Provider 类型或 Base URL 时必须重新输入凭据，避免旧 Secret 被转发到新 Endpoint。
- Codex 与 Claude Code 只执行固定的 `--version` 探测，不接管登录、不读取全局认证配置，也不能用于当前 Chat。

## 安全边界

Renderer 启用 `contextIsolation` 和 sandbox，禁用 Node integration；权限请求、窗口打开和页面跳转默认拒绝。Renderer 只能通过 Preload 暴露的业务 API 使用 Main 能力。所有 Main IPC 输入都经过 Zod 校验，返回错误不包含堆栈。

Linux 上 `safeStorage` 不可用或落入不安全后端时应视为不可用，本版本不明文降级。当前打包和真机验证目标仅为 macOS。

## 已知限制

- 没有 Project、Source、Document、Storyboard、Asset、Publication、Metric 或 Insight 工作流。
- 没有云同步、账号系统、图片/视频生成、发布、MCP 或后台 Agent daemon。
- 自动化测试使用本地 Mock Provider；没有真实验证任何云 Provider。
- Playwright 的 Electron 自动化 API 仍为 experimental。
- `user_version = 1` 且没有 `_migrations` 的早期 pre-migrator 数据库会被拒绝，应用不会修改或删除它。遇到启动错误时先备份 Electron `userData` 下的 `contentdesk.sqlite`，再由开发者自行决定是否重建；本版本不做静默兼容接管。

架构和验收证据见 [ADR-0001](../../docs/adr/0001-desktop-bootstrap-v0.1.md)、[Migration 与引用规范](../../docs/engineering/desktop-migrations-and-imports.md)与[验收报告](../../docs/engineering/desktop-bootstrap-v0.1-acceptance.md)。
