# Issue tracker：本地 markdown

本仓库的 issue 与 spec 以 markdown 文件形式存放在 `.scratch/` 下。该目录被 Git 忽略，仅作为本地工程记录。

不要把 secret、token、密钥写进 `.scratch/`。Git 忽略不等于安全存储。

## 约定

- 一个 feature 一个目录：`.scratch/<feature-slug>/`
- spec 固定为 `.scratch/<feature-slug>/spec.md`
- 实现类 issue 一个 ticket 一个文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 起，按依赖顺序（blocker 在前）—— 不要把多个 ticket 合并进一个文件
- 评论追加到文件末尾的 `## Comments` 标题下，每条以 `— <作者>，YYYY-MM-DD` 结尾

## 元数据字段

平台 label 在本地由文件头的粗体字段承载。issue / spec 文件头：

```markdown
# <NN> — <标题>

**What to build:** 这个 ticket 让什么端到端行为可用（从用户视角，不是分层实现清单）
**Blocked by:** 门禁 ticket，写成 `NN — [标题](NN-slug.md)`；无则写 `None — can start immediately`
**Category:** bug | enhancement
**Status:** needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix
**State:** open | closed
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
```

- `Category` 与 `Status` 各恰好一个值，取值见 `triage-labels.md`
- `State` 是生命周期，与 `Status` 正交。`wontfix` 表示“决定不做”，`State: closed` 表示“已归档”，两者要分别写
- `Created` / `Updated` 由 skill 显式维护，不要依赖文件 mtime —— triage 的“oldest first”排序和“`needs-info` 后是否有新活动”都读这两个字段
- `spec.md` 用同一套字段。`/to-spec` 发布后置 `Status: ready-for-agent`

## 当 skill 说 "publish to the issue tracker"

在 `.scratch/<feature-slug>/` 下新建文件，目录不存在就创建。

## 当 skill 说 "fetch the relevant ticket"

读取被引用路径的文件。通常用户会直接给出路径或编号。

## 当 skill 说 "apply a triage label"

改文件头的 `Category:` 或 `Status:` 字段，并更新 `Updated:`。

## 当 skill 说 "close the issue"

置 `State: closed`，更新 `Updated:`，把理由作为一条 comment 追加。不要删文件。

## Wayfinding 操作

`/wayfinder` 使用。**map** 是一个文件，每个 decision ticket 一个 **child** 文件。

wayfinder ticket 与 triage issue 是两种形状：decision ticket **不带** `Category:` / `Status:`，它走下面这套字段。

- **Map**：`.scratch/<effort>/map.md`，文件头写 `**Wayfinder:** map`。正文用这五个精确标题，顺序不变：`## Destination`、`## Notes`、`## Decisions so far`、`## Not yet specified`、`## Out of scope`。map 是索引不是仓库 —— `Decisions so far` 每条只写一行 gist 加链接，细节留在 ticket 里。
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，编号从 `01` 起，正文是 `## Question`。文件头：

  ```markdown
  **Type:** research | prototype | grilling | task
  **Blocked by:** `NN — [标题](NN-slug.md)`，无则 None
  **Claimed by:** <驱动这张 map 的人>，未认领时留空
  **State:** open | closed
  ```

- **Blocking**：`Blocked by:` 列出的文件全部 `State: closed` 后才解锁。
- **Frontier**：扫描 `.scratch/<effort>/issues/`，取 `State: open`、未被 block、`Claimed by:` 为空的文件，编号最小者优先。
- **Claim**：动手前先填 `Claimed by:` 并保存 —— 这是本次 session 的第一次写入，并发的 session 靠它跳过。
- **Resolve**：在 `## Answer` 标题下追加答案，置 `State: closed`，再把 context 指针（gist + 链接）追加到 `map.md` 的 `## Decisions so far`。
