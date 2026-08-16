# ContentDesk

**简体中文** | [English](README.en.md)

ContentDesk 是面向个人创作者、一人公司和小型内容团队的本地优先 AI 创作工作台。

> **当前状态：Desktop v0.1 已可运行，但尚不能用于生产环境。** Electron Desktop 已贯通本地对话、Provider 配置、SQLite 持久化和 Agent Runtime 只读探测；Project 与 Workspace Files 内容工作流仍未实现。

## 当前能力

| 状态 | 能力 | 说明 |
| --- | --- | --- |
| 可运行 | Electron Desktop v0.1 | Native Chat、对话持久化、Provider 设置、Runtime discovery 与固定 `--version` 探测 |
| 可运行 | OpenAI Compatible | 文本流式对话、停止、重试和连接测试 |
| 可运行 | Anthropic Compatible | 文本流式对话、停止、重试和连接测试 |
| Schema only | Azure OpenAI、Vertex AI、Amazon Bedrock | 可保存非敏感配置，但不能进入 Chat，不提供伪实现或 fallback |
| 可运行的基础能力 | Web 与 Server | Hono、oRPC、OpenAPI、Better Auth 与 PostgreSQL 认证数据面 |
| 原型/模板 | Native、Extension、Fumadocs | 尚未进入 ContentDesk 的可用内容工作流 |
| 计划 | Project 内容事实中心 | Project、Source、Document、Storyboard、Asset、Publication、Metric、Insight 尚未实现 |

自动化 Provider 测试连接本地 Mock Server，不代表 OpenAI、Anthropic、Azure、Vertex、Bedrock 或其他真实云服务已连通。

## 产品方向

- **本地优先**：Desktop 内容数据和配置优先留在用户设备。
- **Project 是事实中心**：长期由 Project 及其文件承载内容上下文，Chat 只是入口之一。
- **AI 可替换**：Provider 与 Runtime 都有明确边界；基础内容管理不应依赖单一 AI 服务。
- **逐层形成闭环**：先保证一个小范围端到端可用，再扩展内容模型与制作能力。

目标生命周期是：

```text
Signal → Source → Document → Storyboard → Shot → Asset
                                           ↓
                       Publication → Metric → Insight
```

这仍是产品方向，不是当前功能声明。Desktop v0.1 当前只实现本地 Chat 基础。

## 架构与数据边界

Desktop 与 Server 使用彼此独立的数据面：

```text
Electron Renderer
      │ typed IPC
Electron Preload
      │
Electron Main ── node:sqlite ── Desktop SQLite
      │
      ├── safeStorage ── encrypted Provider secrets
      └── AI SDK ── configured third-party Provider

Web / Native ── HTTP / oRPC / Better Auth ── Hono Server ── PostgreSQL
```

- Desktop SQLite 保存 Conversation、Message、Provider 非敏感配置和 Runtime Profile。
- API Key 与 Custom Header 值由 Electron `safeStorage` 加密，数据库只保存引用和非敏感元数据。
- Desktop 目前没有 Project、Workspace Files、云同步、导出或备份机制。
- Provider 请求由 Main 发出；Renderer 没有 Node、SQLite、Secret 或网络 Provider 权限。
- Server PostgreSQL 当前保存 Better Auth 认证数据，不与 Desktop SQLite 共用 schema。
- 远程 Provider Base URL 必须使用 HTTPS；HTTP 只允许 loopback。

因此，“本地优先”不等于“所有数据永不离开设备”：发送 Chat 时，用户输入和必要上下文会发送给用户配置的第三方 Provider。

## 仓库结构

```text
apps/
├── desktop/      Electron Main、Preload、Renderer、SQLite 与测试
├── web/          React + TanStack Router Web/PWA 基础工程
├── server/       Hono、oRPC/OpenAPI 与 Better Auth
├── native/       Expo / React Native 原型
├── extension/    WXT 浏览器扩展占位工程
└── fumadocs/     Fumadocs 模板文档站
packages/
├── api/          共享 oRPC context、procedure 和 router
├── auth/         Better Auth 配置
├── db/           Drizzle/PostgreSQL 认证数据面
├── env/          环境变量校验
├── ui/           共享 React UI 与样式
└── config/       共享 TypeScript 配置
```

根目录使用 pnpm workspace 与 Turborepo 编排任务。Desktop SQLite 与 Server PostgreSQL 的边界记录在 [ADR-0001](docs/adr/0001-desktop-bootstrap-v0.1.md)。

## 快速开始

### 环境要求

- Node.js 24；Electron 43 内置 Node 24.17 并使用 `node:sqlite`。
- pnpm `11.21.0`，由根 `package.json` 固定。
- macOS 是 Desktop v0.1 已验收的平台。

### 启动 Desktop

```bash
pnpm install
pnpm run dev:desktop
```

Desktop 不依赖 Server 或 PostgreSQL即可启动。首次启动会在 Electron `userData` 中创建 SQLite 数据库；Provider Secret 也只写入该应用目录下的加密存储。

如需使用 Chat，在设置页配置 OpenAI Compatible 或 Anthropic Compatible Provider。不要提交 API Key、`.env`、SQLite 或运行状态文件。

### 可选：启动 Web 与 Server

Web/Server 认证链路需要 PostgreSQL 与本地环境变量。准备 `apps/server/.env` 和 `apps/web/.env` 后执行：

```bash
pnpm run db:start
pnpm run db:push
pnpm run dev:server
pnpm run dev:web
```

Web 默认是 `http://localhost:3001`，Server 默认是 `http://localhost:3000`。

## AI Provider 与 Runtime

| 类型 | v0.1 状态 | Secret | 可进入 Native Chat |
| --- | --- | --- | --- |
| OpenAI Compatible | 已实现 | `safeStorage` | 是 |
| Anthropic Compatible | 已实现 | `safeStorage` | 是 |
| Azure OpenAI | Schema only | 可保存 | 否 |
| Vertex AI | Schema only | 可保存 | 否 |
| Amazon Bedrock | Schema only | 可保存 | 否 |

ContentDesk Native 是当前唯一 Chat Runtime。Codex 与 Claude Code Profile 只做可执行文件 discovery、手工选择与固定 `--version` 探测；不会接管登录、读取全局认证配置或执行任意命令。

## 开发与验收命令

从仓库根目录运行：

| 命令 | 作用 |
| --- | --- |
| `pnpm run dev:desktop` | 启动 Electron Desktop 开发模式 |
| `pnpm --filter @content-desk/desktop check` | 检查 Desktop 源码与测试 |
| `pnpm --filter @content-desk/desktop check-types` | Desktop TypeScript 检查 |
| `pnpm --filter @content-desk/desktop test` | Desktop 单元、集成和 Renderer 测试 |
| `pnpm --filter @content-desk/desktop test:e2e` | 构建并运行 Electron E2E；使用本地 Mock Provider |
| `pnpm --filter @content-desk/desktop package` | 生成 unsigned macOS directory artifact |
| `pnpm run check` | 全仓 Ultracite/Biome 检查 |
| `pnpm run check-types` | Turborepo workspace 类型检查 |
| `pnpm turbo run test --force` | 运行定义了 `test` 的 workspace |
| `pnpm run build` | 构建所有定义了 `build` 的 workspace |

Desktop 的本地验收步骤、旧数据库策略与已知限制见 [Desktop README](apps/desktop/README.md) 和 [验收报告](docs/engineering/desktop-bootstrap-v0.1-acceptance.md)。

## 路线图

1. 以 Project 为事实中心建立本地项目模型与用户可控的 Workspace Files。
2. 打通无需 AI 的 `Project → Document/Script → Storyboard → Asset` 基础闭环。
3. 将 Desktop Chat 变成操作 Project 的入口，而不是孤立对话产品。
4. 把 Extension 与 Native 从模板升级为素材收集与确认入口。
5. 在内容模型稳定后扩展生成、发布、复用与数据复盘。

## License

ContentDesk 采用仓库中的 [ContentDesk License](LICENSE)，并附有 [NOTICE](NOTICE)。这是包含额外条件及完整 Apache License 2.0 文本的自定义 source-available 许可证，不是标准 Apache-2.0，也不是 OSI 批准的开源许可证。使用、修改或分发前请阅读完整条款。
