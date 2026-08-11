# ContentDesk

**简体中文** | [English](README.en.md)

目标成为面向个人创作者、一人公司和小型内容团队的本地优先 AI 内容创作工作台。

> **当前状态：基础架构阶段，不能用于生产环境。** 仓库目前可运行的主链路是 Web 和 Server，包括 API 连通检查、邮箱密码认证和受保护路由；另有一个尚未通过独立类型检查的 Native 原型。ContentDesk 的项目管理、内容创作、本地存储、Desktop 和 AI 能力尚未实现。参见[快速开始](#快速开始)。

## 项目简介

ContentDesk 计划把项目文件、素材、文档、脚本、分镜和生成资产组织在同一个内容工作区中，服务于需要持续收集、创作、制作和复用内容的个人与小团队。它要解决的不是单次对话，而是聊天记录、素材文件夹和多个创作工具彼此割裂后，内容上下文难以沉淀和复用的问题。

项目的目标是让项目及其文件成为内容事实中心，Chat 只是操作项目的入口之一。以上是产品方向，并非当前功能声明；当前仓库仍主要保留 Better-T-Stack 初始化后的应用骨架。

## 当前状态

| 状态 | 能力 | 说明 |
| --- | --- | --- |
| 可运行的基础能力 | Web 和 Server 基础工程 | Web 可检查 API 状态；Server 提供 Hono、oRPC 和 OpenAPI 入口 |
| 可运行的基础能力 | 邮箱密码认证 | Better Auth、PostgreSQL 认证表、Web 登录和注册界面、Web 受保护路由 |
| 原型 | Native 基础工程 | 包含 API 状态、认证界面和主题切换代码，但当前独立 TypeScript 检查失败 |
| 开发中 | ContentDesk 产品体验 | 仓库已有通用消息类 UI 组件，但尚未接入 Chat、项目或内容数据 |
| 计划 | Desktop 与本地优先数据层 | 当前没有 Electron 应用、SQLite、Workspace Files 或本地项目模型 |
| 计划 | 内容工作流与 AI | Project、Document、Script、Storyboard、Asset、发布复盘和 AI Provider 均未实现 |
| 模板/占位 | 浏览器扩展与文档站 | WXT 扩展只有占位弹窗和示例 content script；Fumadocs 内容仍是模板示例 |

当前仓库没有可用的 Electron Desktop 应用，也没有任何 LLM、图片、音频或视频生成 Provider 集成。依赖或 UI 组件的存在不代表对应产品能力已经完成。

## 产品方向

以下原则描述 ContentDesk 要演进的方向：

- **本地优先**：内容和项目文件应优先由用户控制；当前实现尚未达到这一目标，认证数据仍存储在 Server 使用的 PostgreSQL 中。
- **项目是事实中心**：内容上下文应归属于项目和文件，而不是只存在于聊天记录中。
- **Chat 是入口之一**：结构化编辑、整理和制作界面不会被通用聊天界面取代。
- **AI 可替换、基础工作不依赖 AI**：未来应允许选择 Provider；没有 AI 时，项目与内容管理仍应工作。

## 目标工作流

目标生命周期是：

```text
收集素材 → 分析整理 → 生成内容 → 制作资产 → 发布复用 → 数据复盘
```

这条工作流目前尚未在源码中形成端到端闭环。近期范围会先聚焦 `Project → Document/Script → Storyboard → Asset`，再逐步连接素材收集、生成、发布和复盘。

## 当前架构与数据边界

当前主链路是一个客户端/服务器脚手架，而不是本地优先 Desktop 架构：

```text
Web (React) ─────┐
                 ├─ HTTP / oRPC / Better Auth ─ Hono Server ─ PostgreSQL
Native (Expo) ───┘
```

- **Web** 是当前最直接的浏览器入口，默认运行在 `http://localhost:3001`。
- **Server** 默认运行在 `http://localhost:3000`，提供健康检查、认证、受保护的示例接口和 OpenAPI reference handler。
- **Native** 是复用同一套认证和 oRPC Server 的 Expo/React Native 原型；它尚不是内容采集或移动创作产品，并且当前存在 Better Auth 客户端类型不兼容问题。
- **Extension** 与 **Fumadocs** 位于 workspace 中，但当前不属于可用产品主流程。
- **Desktop** 目录和 Electron 配置均不存在。

当前数据库只定义 Better Auth 所需的 `user`、`session`、`account` 和 `verification` 表。这里的 `account.providerId` 是认证账号字段，不表示 AI Provider 支持。仓库没有 Project、Document、Script、Storyboard、Asset 或 Conversation 数据模型，也没有数据库迁移文件。

### 数据、网络与隐私

- 认证数据和会话由 Server 写入 PostgreSQL；当前没有 SQLite、IndexedDB 内容库或工作区文件存储。
- Web 通过 Cookie 访问认证和 API；Native 使用 Expo SecureStore 保存 Better Auth 客户端会话信息。
- 开发环境中的 Server 使用 evlog 写入本地 `.evlog/` 日志目录。
- 当前 Web 和 Native 的认证/API 功能都需要 Server；没有账号同步、本地内容备份、导出、迁移或卸载清理流程。
- 当前没有 AI 请求。未来接入第三方 AI Provider 后，发送给 Provider 的数据边界需要按实际实现重新说明。

因此，本仓库目前不能被描述为完全离线或“数据绝不离开设备”。

## 仓库结构

```text
apps/
├── web/          React + TanStack Router Web/PWA 基础工程
├── server/       Hono Server、oRPC/OpenAPI 和认证入口
├── native/       Expo + React Native 原型
├── extension/    WXT 浏览器扩展占位工程
└── fumadocs/     Fumadocs 模板文档站
packages/
├── api/          共享 oRPC context、procedure 和示例 router
├── auth/         Better Auth 配置
├── db/           Drizzle/PostgreSQL 连接和认证 schema
├── env/          Server、Web、Native 环境变量校验
├── ui/           共享 React UI 组件和样式
└── config/       共享 TypeScript 配置
```

根目录使用 pnpm workspace 和 Turborepo 编排任务。`docker-compose.yml` 提供 Web、Server 和 PostgreSQL 服务。

## 快速开始

### 环境要求

- Node.js：仓库没有 `.nvmrc`、`.node-version` 或 `engines` 约束；Docker 构建使用 Node.js 24。
- pnpm `11.21.0`：版本由根 `package.json` 的 `packageManager` 固定。
- Docker 与 Docker Compose：使用仓库自带 PostgreSQL 或运行完整容器栈时需要。

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

仓库目前没有 `.env.example`。请创建或编辑以下被 Git 忽略的文件，不要提交密钥：

`apps/server/.env`

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/content-desk
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

`apps/web/.env`

```dotenv
VITE_SERVER_URL=http://localhost:3000
```

只有运行 Native 时才需要 `apps/native/.env`：

```dotenv
EXPO_PUBLIC_SERVER_URL=http://YOUR-LAN-IP:3000
```

真机必须使用能从设备访问的 Server 地址，不能使用设备自身的 `localhost`。

### 3. 准备数据库

```bash
pnpm run db:start
pnpm run db:push
```

`db:start` 会通过 Docker Compose 启动 PostgreSQL；`db:push` 会把当前认证 schema 写入该数据库。

### 4. 启动 Server 和 Web

分别在两个终端运行：

```bash
pnpm run dev:server
```

```bash
pnpm run dev:web
```

打开 `http://localhost:3001`。Server 健康检查位于 `http://localhost:3000/`。

根命令 `pnpm run dev` 会启动所有 workspace 的 `dev` 任务，目前不适合作为主启动方式：Server 和 Fumadocs 都默认占用 `3000` 端口。

### 5. 可选：启动 Native

在 Server 和数据库已经运行、Native 环境变量已配置后执行：

```bash
pnpm run dev:native
```

## 配置与 AI Provider

| 变量 | 使用位置 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | Server / Drizzle | PostgreSQL 连接字符串 |
| `BETTER_AUTH_SECRET` | Server | Better Auth 密钥，至少 32 个字符 |
| `BETTER_AUTH_URL` | Server | Better Auth 的 Server 基础地址 |
| `CORS_ORIGIN` | Server | 允许携带认证信息访问 Server 的 Web origin |
| `VITE_SERVER_URL` | Web | oRPC 和认证 Server 地址 |
| `EXPO_PUBLIC_SERVER_URL` | Native | Native 使用的 oRPC 和认证 Server 地址 |

当前没有 AI Provider、API Key 配置、可自定义 AI Base URL 或 Provider 设置页；也没有 OpenAI Compatible API、Anthropic/Claude、AWS Bedrock、Azure OpenAI 或 Google Vertex AI 集成。认证 Provider 字段与 AI Provider 无关。

## 开发命令

以下命令均从仓库根目录执行：

| 命令 | 作用 |
| --- | --- |
| `pnpm run dev:web` | 启动 Web 开发服务器 |
| `pnpm run dev:server` | 启动 Server 开发进程 |
| `pnpm run dev:native` | 启动 Expo 开发服务器 |
| `pnpm --filter extension dev` | 启动 WXT 扩展开发模式 |
| `pnpm --filter fumadocs dev` | 启动模板文档站；默认端口与 Server 冲突 |
| `pnpm run check` | 使用 Ultracite/Biome 执行静态检查 |
| `pnpm run check-types` | 对定义了 `check-types` 的 workspace 执行类型检查 |
| `pnpm run build` | 构建 Web、Server、Extension 和 Fumadocs；Native 没有 `build` script |
| `pnpm --filter extension build` | 构建 Chromium 扩展 |
| `pnpm --filter extension build:firefox` | 构建 Firefox 扩展 |
| `pnpm --filter fumadocs build` | 构建模板文档站 |
| `pnpm run db:generate` | 生成 Drizzle migration 文件 |
| `pnpm run db:migrate` | 执行已有 Drizzle migration |
| `pnpm run db:push` | 将 schema 直接推送到数据库 |
| `pnpm run db:studio` | 启动 Drizzle Studio |
| `pnpm run docker:build` | 构建 Web 和 Server 容器镜像 |
| `pnpm run docker:up` | 构建并启动 Web、Server、PostgreSQL |
| `pnpm run docker:down` | 停止并移除 Compose 服务 |

仓库目前没有 `test`、单元测试、集成测试或 E2E 配置。根类型检查也不会覆盖 Native 和 Extension：Extension 另有 `pnpm --filter extension compile`；Native 没有项目级类型检查 script，且运行 `pnpm --filter native exec tsc --noEmit` 会因 Better Auth 客户端类型不兼容而失败。

## 路线图

路线图不是当前功能列表。近期方向按依赖顺序为：

1. 建立可运行的 Desktop 外壳、本地项目模型和用户可控的文件存储。
2. 打通无需 AI 的 `Project → Document/Script → Storyboard → Asset` 基础闭环。
3. 增加 Desktop Chat、设置入口和可替换的 AI Provider。
4. 将浏览器扩展和移动端从模板升级为素材收集与确认入口。
5. 在基础内容模型稳定后，再扩展图片、音频、视频制作以及发布、复用和数据复盘。

## 当前不做什么

现阶段不会把 ContentDesk 建设为通用聊天客户端、通用 Agent Runtime、面向开发者的工作流编排平台、完整视频剪辑器、企业级数字资产管理系统，或已经成熟的一体化内容发布平台。当前优先级是让一个小而完整的内容工作闭环真实可用。

## License

ContentDesk 采用仓库中的 [ContentDesk License](LICENSE)，并附有 [NOTICE](NOTICE)。这是包含额外条件及完整 Apache License 2.0 文本的自定义 source-available 许可证，不是标准 Apache-2.0，也不是 OSI 批准的开源许可证。使用、修改或分发前请阅读完整条款。
