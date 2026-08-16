# 领域文档

engineering skills 在探索本仓库代码前，应该怎么读领域文档。

## 探索前先读

- 根目录 **`CONTEXT.md`**
- **`docs/adr/`** —— 读与即将改动区域相关的 ADR

这些文件不存在就**静默继续**：不要提示缺失，也不要一上来就建议创建。`/domain-modeling` 会在术语或决策真正定下来时按需创建。

## 文件结构

本仓库选用单 context 布局。目标布局如下（`CONTEXT.md` 尚未创建）：

```
/
├── CONTEXT.md          ← 尚不存在，由 /domain-modeling 按需创建
├── docs/adr/
│   └── 0001-desktop-bootstrap-v0.1.md
├── apps/               ← desktop / web / server / native / extension / fumadocs
└── packages/           ← api / auth / db / env / ui / config
```

术语表与 ADR 目前统一放根目录，`apps/*` 与 `packages/*` 不各自持有。这是当前选择，不是永久约束：某个部分一旦形成与根术语表**冲突**的领域语言，或需要独立的决策所有权，就该引入 `CONTEXT-MAP.md` 拆成多 context。Desktop 的本地数据面与 Server 的 PostgreSQL Better Auth Schema 已经不共用（见 ADR-0001「后果」），是最有可能先分化的一条缝。

## 使用术语表里的词

输出里出现领域概念时（issue 标题、重构提案、假设、测试名），用 `CONTEXT.md` 里定义的那个词，不要漂移到术语表明确避免的同义词。

需要的概念术语表里还没有，这本身是个信号：要么你在造项目并不使用的语言（重新考虑），要么确实有真实缺口（记下来交给 `/domain-modeling`）。

## ADR 冲突要说出来

输出与既有 ADR 矛盾时，明确指出，不要默默覆盖：

> _与 ADR-0001（Desktop Bootstrap v0.1）冲突 —— 但值得重开，因为……_
