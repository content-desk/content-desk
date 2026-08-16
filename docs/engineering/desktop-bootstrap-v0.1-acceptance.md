# Desktop Bootstrap v0.1 验收报告

- 初次验收日期：2026-08-11
- Code Review 全量修正复验日期：2026-08-13
- 任务开始时 commit：`b42e446d7626cb28518121d039c3b99d43f9ac80`
- 本轮复验基线 HEAD：`826b705e61a0278af739497c4ca5ee1395a59067`
- 本轮复验对象：基于上述 HEAD 的未提交工作区改动；这些改动随后于 2026-08-15 进入 commit `fb335b85ae7bed79dcea9e79c4e5c147354cd4c6`
- 实际工作分支：`feat/bilingual-readme`（任务进行期间由用户工作区切换；本任务没有切分支）
- 状态：实施方复验通过。本文件中的命令结果以 2026-08-13 本机最终复验的实际输出为准；未使用真实云凭据，本报告不等同于独立第三方认证。

## 基线

修改前日志保存在本机 `/tmp/content-desk-desktop-v01-baseline.trXyUx`：

- `pnpm run check`：通过，130 files，0 errors。任务输入所述脚手架错误已不再复现。
- `pnpm turbo run check-types --force`：通过；仅现有 Server、Web、UI 定义该任务。
- `pnpm turbo run build --force`：通过；保留现有 tsdown/Fumadocs/Turbo output warning。
- Workspace 当时没有 `test` task。

本轮 Code Review 修改前另行复验：

- `pnpm run check`：通过，159 files，0 diagnostics。
- `pnpm turbo run check-types --force`：4 tasks 通过。
- `pnpm turbo run test --force`：Desktop 7 files / 26 tests 通过。
- `git diff --check`：通过。
- 工作区已有未提交的 `.gitignore` 与 `docs/agents/issue-tracker.md` 修改；本轮未覆盖、重置或提交它们。

## Desktop 验收矩阵

| 检查 | 覆盖范围 | 最终结果 |
| --- | --- | --- |
| Desktop check | Ultracite/Biome，37 files | 通过，0 diagnostics |
| Desktop typecheck | Main/Preload/Renderer/Tests | 通过 |
| Vitest | Migration、Database、IPC、Secret、Contract、Runtime、Provider、Chat、Renderer | 9 files / 45 tests 全部通过 |
| Mock Provider | Streaming、401、429、invalid response、timeout | 通过；仅本地 HTTP |
| Electron E2E | 启动、Preload API、macOS safeStorage、Settings 错误、Mock 流式 Chat、重启恢复 | 1 test 通过 |
| electron-vite build | Main/Preload/Renderer production bundles | 通过 |
| electron-builder | unsigned macOS arm64 directory artifact | 通过，约 301 MiB |
| 全仓 check/typecheck/build | 与基线比较 | 全部通过；既有 Fumadocs chunk 与 Turbo output warning 保持不变 |

2026-08-13 最终命令结果：

- `git diff --check`：通过。
- `pnpm run check`：168 files，0 diagnostics；相对本轮基线新增 9 个被检查文件，未新增失败。
- `pnpm turbo run check-types --force`：4/4 tasks 通过。
- `pnpm turbo run test --force`：1/1 task 通过，Desktop 9 files / 45 tests。
- `pnpm turbo run build --force`：5/5 tasks 通过；既有 Fumadocs chunk warning 与 Extension/Fumadocs Turbo output warning 保持不变。
- `pnpm --filter @content-desk/desktop test:e2e`：1/1 通过。
- `pnpm --filter @content-desk/desktop package`：通过，生成 unsigned macOS arm64 directory artifact。

## Code Review 全量修正

- Schema 与 Runtime seed 已从 TypeScript 内嵌字符串迁到独立 `0001_initial.sql`；Main bundle 通过 Vite raw glob 内联 SQL，不依赖外部 migration 目录。
- Migration loader 校验命名、连续编号、非空内容和规范化 SHA-256；runner 校验 `_migrations`、`user_version`、name 与 checksum，并按版本独立事务提交。
- 已覆盖从 0 初始化、幂等、多版本顺序、首版本/后续版本失败回滚、历史篡改、未来版本、旧 pre-migrator 数据库拒绝、新 schema 无 `working_directory` 与真实文件重开。
- Desktop 源码和测试对源码的引用统一为 `@desktop/*`；Biome 阻止相对模块 import 及 Main/Preload/Renderer/Shared 之间的非法跨层引用。
- `workingDirectory` 已从 Contract、IPC、Preload、Service、Repository、Schema、UI、Mock 与测试中移除。
- IPC dialog 使用外层已验证的同一个 `BrowserWindow owner`；单元测试验证非法 sender 返回 `FORBIDDEN` 且 action 不执行。
- Provider 支持状态统一由 `isSupportedProviderKind()` 决定；五种 kind 的 Repository 状态与模型工厂门禁一致。
- Renderer 拆为 Chat、Provider Settings、Runtime Settings 和 Settings shell；`unwrapIpcResult()` 与 `useDesktopAction()` 统一错误通道，Chat 启动失败的 Run 回滚仍由 Chat 编排负责。
- 双语根 README、ADR、Desktop README、Provider/Runtime 边界和 Migration/Import 工程规范已与实际实现同步。

## 打包产物审计

- Desktop `src` + `tests`：33 个文件。
- `release/mac-arm64/ContentDesk.app`：260 个文件，目录约 301 MiB。
- `app.asar`：26,683,908 bytes。
- `app.asar` SHA-256：`17f688a7d60122cf1c5475a4d7d8a1b9aa7cbc336a53097392dc10c64b0f8b15`。
- `app.asar` 内能检出 `CREATE TABLE _migrations` 与完整 `0001_initial.sql` 执行文本；应用资源目录不存在外部 migration 文件夹。
- 打包 App 使用全新临时 `userData` 实际启动后生成 `contentdesk.sqlite`：`user_version = 1`；`_migrations` 记录为 `version = 1`、`name = initial`，对应源文件 `0001_initial.sql`；三条 Runtime seed 存在。
- E2E 截图已人工查看：Chat、侧栏、Provider/Model 控件、历史与 Composer 可见，无白屏、状态丢失、文字截断或明显布局回归。

## 外部审查修正

ChatGPT Pro 最终审查未发现 P0，并指出 Provider Secret/HTTP 边界、Renderer 流事件竞争、Retry 历史、运行中删除与退出、Settings 错误可见性及测试覆盖六组 P1。经本机独立复核后均确认并完成最小修正：

- 远程 Provider 强制 HTTPS；HTTP 仅允许 loopback；类型或 Base URL 变化时不继承旧 Secret；Provider 原始错误不进入 Renderer。
- Renderer 使用同步更新的 Run Ref 过滤事件，并绑定 Conversation；Retry 只发送 User 与 complete Assistant 历史。
- 删除 Conversation 与退出应用前先 Abort 并等待 Active Run；完成后清理 WebContents listener。
- Settings 显示 Provider/Runtime IPC 错误，并检查 Runtime 操作结果。
- 新增远程 HTTP 拒绝、Endpoint Secret 重入、Provider 错误脱敏、Retry 历史、listener 清理、Active Run 删除/退出协调、真实文件 SQLite 重开、Renderer 快速事件/会话切换及 Provider/Runtime Settings 错误可见性覆盖。
- ChatGPT Pro 增量复核确认前五组实现 P1 关闭，并将 Renderer 竞态、`shutdown()` 与 Runtime Settings 自动化缺口列为唯一残余测试级 P1；本机随后补齐相应组件/集成测试，并独立补齐原验收要求的 Electron Mock Chat 重启恢复 E2E。
- ChatGPT Pro 最终静态复核确认上述残余测试级 P1 已关闭，最终结论为 P0 0 项、P1 0 项；其明确声明未亲自运行本机命令，因此构建与测试结论仍以本报告记录的 Codex 本机执行证据为准。

## 声明边界

- Migration ADR 修订、实现代码与本报告更新在同一轮工作中完成，并在同一 commit `fb335b8` 中落地；相关 ADR 是实现同期形成的决策记录，不是先于实现存在的独立验收契约。
- E2E 的 `safeStorage` 使用本机 Electron/macOS 实现；单元测试中的可注入 Crypto 仅验证业务边界。
- Provider 集成测试只连接本地 HTTP Mock Server。
- 没有 Azure、Vertex、Bedrock、OpenAI、Anthropic 或其他真实云连通声明。
- 没有签名、公证、发布、部署、commit、push 或 PR。
- 打包产物使用 Electron 默认图标，并缺少 package author；这是 v0.1 的已知品牌元数据缺口。
- `user_version = 1` 且没有 `_migrations` 的早期数据库会拒绝启动并保持原文件不变；需要先备份再由开发者自行决定是否重建。
- 当前没有 Project 或 Workspace Files；SQLite 只覆盖 Chat、Provider 非敏感配置与 Runtime Profile。
