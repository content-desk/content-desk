# Triage 标签

skills 用固定的 triage 角色说话。本文件把这些角色映射到本仓库实际使用的字符串。

本仓库的 issue 是本地 markdown 文件，没有平台 label —— 角色写在文件头的 `**Category:**` 与 `**Status:**` 字段里（格式见 `issue-tracker.md`）。

两个 **category** 角色，写入 `Category:`：

| mattpocock/skills 中的角色 | 本仓库使用的值 | 含义 |
| --- | --- | --- |
| `bug` | `bug` | 有东西坏了 |
| `enhancement` | `enhancement` | 新功能或改进 |

五个 **state** 角色，写入 `Status:`：

| mattpocock/skills 中的角色 | 本仓库使用的值 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 需要维护者评估 |
| `needs-info` | `needs-info` | 等报告者补充信息 |
| `ready-for-agent` | `ready-for-agent` | 已完整描述，可交给 AFK agent |
| `ready-for-human` | `ready-for-human` | 需要人来实现 |
| `wontfix` | `wontfix` | 不会处理 |

每个已 triage 的 issue **恰好带一个 category 和一个 state**。skill 提到某个角色时（例如 "apply the AFK-ready triage label"），用表格中列对应的值。

要换命名，改中列即可。
