# Desktop Bootstrap v0.1 验收报告

- 验收日期：2026-08-11
- 任务开始时 commit：`b42e446d7626cb28518121d039c3b99d43f9ac80`
- 最终复验时用户工作区 HEAD：`96b3406b96037a537efa0c2adc91dc8455603a59`
- 实际工作分支：`feat/bilingual-readme`（任务进行期间由用户工作区切换；本任务没有切分支）
- 状态：本文件中的命令结果以最终验收时实际输出为准；未使用真实云凭据。

## 基线

修改前日志保存在本机 `/tmp/content-desk-desktop-v01-baseline.trXyUx`：

- `pnpm run check`：通过，130 files，0 errors。任务输入所述脚手架错误已不再复现。
- `pnpm turbo run check-types --force`：通过；仅现有 Server、Web、UI 定义该任务。
- `pnpm turbo run build --force`：通过；保留现有 tsdown/Fumadocs/Turbo output warning。
- Workspace 当时没有 `test` task。

## Desktop 验收矩阵

| 检查 | 覆盖范围 | 最终结果 |
| --- | --- | --- |
| Desktop check | Ultracite/Biome，28 files | 通过，0 diagnostics |
| Desktop typecheck | Main/Preload/Renderer/Tests | 通过 |
| Vitest | Database、Secret、Contract、Runtime、Provider、Chat、Renderer | 7 files / 26 tests 全部通过 |
| Mock Provider | Streaming、401、429、invalid response、timeout | 通过；仅本地 HTTP |
| Electron E2E | 启动、Preload API、macOS safeStorage、Settings 错误、Mock 流式 Chat、重启恢复 | 1 test 通过 |
| electron-vite build | Main/Preload/Renderer production bundles | 通过 |
| electron-builder | unsigned macOS arm64 directory artifact | 通过，约 301 MiB |
| 全仓 check/typecheck/build | 与基线比较 | 全部通过；既有 Fumadocs chunk 与 Turbo output warning 保持不变 |

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

- E2E 的 `safeStorage` 使用本机 Electron/macOS 实现；单元测试中的可注入 Crypto 仅验证业务边界。
- Provider 集成测试只连接本地 HTTP Mock Server。
- 没有 Azure、Vertex、Bedrock、OpenAI、Anthropic 或其他真实云连通声明。
- 没有签名、公证、发布、部署、commit、push 或 PR。
- 打包产物使用 Electron 默认图标，并缺少 package author；这是 v0.1 的已知品牌元数据缺口。
