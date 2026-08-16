# Desktop Provider 与 Runtime 边界

## Provider

Provider 表示 LLM 网络连接。Main 持有模型工厂、Secret 和请求生命周期，Renderer 只能看到非敏感视图。

| 类型 | v0.1 状态 | 可进入 Chat |
| --- | --- | --- |
| OpenAI Compatible | 可用 | 是 |
| Anthropic Compatible | 可用 | 是 |
| Azure OpenAI | Schema only | 否 |
| Vertex AI | Schema only | 否 |
| Amazon Bedrock | Schema only | 否 |

测试连接会发出真实最小模型请求；本地 Mock 测试不等价于真实云连通。
远程 Base URL 必须为 HTTPS；HTTP 仅限 `localhost`、`127.0.0.1` 和 `::1`。修改类型或 Base URL 后必须重新输入 Secret，Provider 的原始错误正文不会传给 Renderer。

## Runtime

Runtime 表示本机执行能力，与 Provider 完全独立。

| Runtime | v0.1 能力 | 可进入 Chat |
| --- | --- | --- |
| ContentDesk Native | stream、stop、retry、persist | 是 |
| Codex | discovery、version probe | 否 |
| Claude Code | discovery、version probe | 否 |

Runtime Probe 不能接收 Renderer 提供的参数；Main 内部按 kind 固定命令参数。v0.1 不集成 Codex app-server、Claude SDK、ACP、MCP 或任何认证代理。

## 后续工作

1. 在 Project 数据模型冻结后，将 Conversation 显式关联到 Project，而不是为当前表增加猜测字段。
2. 为真实支持的云 Provider 分别新增 ADR、认证边界和凭据最小化测试。
3. 只有产品确认 CLI Agent 能修改哪些 Workspace Files 后，才设计可写 Agent Runtime 协议。
