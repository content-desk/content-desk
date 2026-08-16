# Desktop Migration 与模块引用规范

本文记录 Desktop v0.1 的 SQLite migration 和 `@desktop/*` 模块边界。它是实现约束，不是远期 Project 数据模型设计。

## 1. Migration 文件

源码位于：

```text
apps/desktop/src/main/database/
├── migrations/
│   └── 0001_initial.sql
├── migration-loader.ts
├── migrator.ts
├── database.ts
└── repositories.ts
```

SQL 必须保留在独立文件中，不能改回 TypeScript template string。Loader 使用 Vite 的 `import.meta.glob(..., { query: "?raw", import: "default", eager: true })` 在构建时把 SQL 收入 Electron Main bundle，因此开发、build 与 package 都不依赖外部 migration 目录。

### 命名与不可变规则

1. 文件名必须匹配 `NNNN_snake_case.sql`。
2. 编号从 `0001` 开始，按数字连续，不能重复或留空档。
3. 文件不能为空；Loader 会去除开头 BOM，并把 CRLF/CR 规范化为 LF。
4. SHA-256 针对规范化后的实际执行文本计算。
5. 已发布 migration 永不修改；schema 修正必须新增下一编号。
6. Migration SQL 不写 `PRAGMA user_version`，版本号只由 runner 根据文件名设置。

### 执行与校验

`_migrations` 是详细历史真源，`PRAGMA user_version` 是快速指针。启动时 runner 会验证：

- 当前版本不高于 bundle 的最新版本；
- 当前版本大于 0 时 `_migrations` 必须存在；
- 历史数量等于 `user_version`；
- 每个已应用版本的 `version`、`name`、`checksum` 与 bundle 一致。

每个新版本分别执行：

```text
BEGIN IMMEDIATE
→ exec(sql)
→ INSERT _migrations
→ PRAGMA user_version = N
→ COMMIT
```

任一步骤失败会立即 `ROLLBACK` 并终止 Desktop 启动。已经提交的更早版本保留，失败版本的 schema、history 和 `user_version` 一并回滚。

### 旧数据库策略

早期 Bootstrap 数据库可能是 `user_version = 1` 但没有 `_migrations`。本版本明确拒绝自动接管：

- 不静默补历史；
- 不伪造 checksum；
- 不删除或覆盖原数据库；
- 启动错误会提示先备份，再由开发者决定是否重建。

这是有意的非兼容边界。当前没有可靠信息可以证明旧 schema 与已发布 SQL 完全一致，自动登记会破坏 migration 审计价值。

## 2. `@desktop/*` 引用规范

Desktop 内部模块统一从 `apps/desktop/src` 解析：

```ts
import { Repositories } from "@desktop/main/database/repositories";
import type { DesktopApi } from "@desktop/shared/contracts";
```

TypeScript `paths` 只帮助类型检查和 IDE，不会改写运行时代码。因此以下位置必须同步配置绝对 alias：

- `apps/desktop/tsconfig.json`
- `apps/desktop/electron.vite.config.ts` 的 Main、Preload、Renderer
- `apps/desktop/vitest.config.ts`

Biome 的 `noRestrictedImports` 负责阻止回归：

| 来源 | 允许的 Desktop 目标 | 禁止目标 |
| --- | --- | --- |
| Main | Main、Shared | Preload、Renderer |
| Preload | Preload、Shared | Main、Renderer |
| Renderer | Renderer、Shared | Main、Preload |
| Shared | Shared | Main、Preload、Renderer |
| Tests | 任意 `@desktop/*` 被测模块 | 相对源码引用 |

Desktop TS/TSX 不使用 `./` 或 `../` 模块引用。唯一有意保留的相对字面量是 `import.meta.glob("./migrations/*.sql")`，它是 Vite 静态资源发现模式，不是模块 import。

## 3. 官方资料

- [Vite Glob Import](https://vite.dev/guide/features.html#glob-import)
- [SQLite user_version](https://www.sqlite.org/pragma.html#pragma_user_version)
- [SQLite Transactions](https://www.sqlite.org/lang_transaction.html)
- [Node.js DatabaseSync.exec](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html#databaseexecsql)
- [TypeScript paths](https://www.typescriptlang.org/tsconfig/paths.html)
- [Vite resolve.alias](https://vite.dev/config/shared-options.html#resolve-alias)
- [Biome noRestrictedImports](https://biomejs.dev/linter/rules/no-restricted-imports/)
