import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "@desktop/main/database/database";
import { loadMigrations } from "@desktop/main/database/migration-loader";
import { migrateDatabase } from "@desktop/main/database/migrator";
import { describe, expect, it } from "vitest";

const historyTable = `
CREATE TABLE _migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);`;

describe("migration loader", () => {
  it("normalizes SQL before computing its checksum", () => {
    const [migration] = loadMigrations({
      "./migrations/0001_initial.sql":
        "\uFEFFCREATE TABLE value (id INTEGER);\r\n",
    });
    const normalized = "CREATE TABLE value (id INTEGER);\n";
    expect(migration).toMatchObject({
      checksum: createHash("sha256").update(normalized).digest("hex"),
      name: "initial",
      sql: normalized,
      version: 1,
    });
  });

  it.each([
    [{ "./migrations/1_initial.sql": "SELECT 1;" }, "filename"],
    [
      {
        "./migrations/0001_initial.sql": "SELECT 1;",
        "./migrations/0001_second.sql": "SELECT 2;",
      },
      "duplicate",
    ],
    [
      {
        "./migrations/0001_initial.sql": "SELECT 1;",
        "./migrations/0003_third.sql": "SELECT 3;",
      },
      "missing",
    ],
    [{ "./migrations/0001_initial.sql": " \r\n" }, "empty"],
  ])("rejects an invalid migration set", (modules, message) => {
    expect(() => loadMigrations(modules)).toThrow(message);
  });
});

describe("database migrator", () => {
  it("migrates from zero and does not reapply completed migrations", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = loadMigrations({
      "./migrations/0001_initial.sql": `${historyTable}\nCREATE TABLE items (id INTEGER PRIMARY KEY);`,
    });
    migrateDatabase(database, migrations);
    const appliedAt = database
      .prepare("SELECT applied_at FROM _migrations WHERE version = 1")
      .get();

    migrateDatabase(database, migrations);

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });
    expect(
      database
        .prepare("SELECT applied_at FROM _migrations WHERE version = 1")
        .get()
    ).toEqual(appliedAt);
    database.close();
  });

  it("applies multiple versions in numeric order", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = loadMigrations({
      "./migrations/0001_initial.sql": `${historyTable}\nCREATE TABLE items (id INTEGER PRIMARY KEY);`,
      "./migrations/0002_add_value.sql":
        "ALTER TABLE items ADD COLUMN value TEXT;",
    });

    migrateDatabase(database, migrations);

    expect(
      database.prepare("SELECT version FROM _migrations ORDER BY version").all()
    ).toEqual([{ version: 1 }, { version: 2 }]);
    expect(database.prepare("PRAGMA table_info(items)").all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "value" })])
    );
    database.close();
  });

  it("rolls back schema, history, and version when the first migration fails", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = loadMigrations({
      "./migrations/0001_initial.sql": `${historyTable}\nCREATE TABLE doomed (id INTEGER);\nINVALID SQL;`,
    });

    expect(() => migrateDatabase(database, migrations)).toThrow(
      "Database migration 0001_initial failed."
    );

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 0,
    });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('_migrations', 'doomed')"
        )
        .all()
    ).toEqual([]);
    database.close();
  });

  it("keeps a committed version when the next migration fails", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = loadMigrations({
      "./migrations/0001_initial.sql": `${historyTable}\nCREATE TABLE stable (id INTEGER);`,
      "./migrations/0002_broken.sql":
        "CREATE TABLE transient (id INTEGER); INVALID SQL;",
    });

    expect(() => migrateDatabase(database, migrations)).toThrow(
      "Database migration 0002_broken failed."
    );

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });
    expect(database.prepare("SELECT version FROM _migrations").all()).toEqual([
      { version: 1 },
    ]);
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transient'"
        )
        .get()
    ).toBeUndefined();
    database.close();
  });

  it.each([
    ["name", "UPDATE _migrations SET name = 'changed' WHERE version = 1"],
    [
      "checksum",
      "UPDATE _migrations SET checksum = 'changed' WHERE version = 1",
    ],
  ])("rejects modified migration %s history", (_field, mutation) => {
    const database = new DatabaseSync(":memory:");
    const migrations = loadMigrations({
      "./migrations/0001_initial.sql": `${historyTable}\nCREATE TABLE items (id INTEGER);`,
    });
    migrateDatabase(database, migrations);
    database.exec(mutation);

    expect(() => migrateDatabase(database, migrations)).toThrow(
      "Migration history mismatch at version 1"
    );
    database.close();
  });

  it("rejects a database newer than the bundled migrations", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA user_version = 2");
    const migrations = loadMigrations({
      "./migrations/0001_initial.sql": historyTable,
    });
    expect(() => migrateDatabase(database, migrations)).toThrow(
      "newer than this app supports"
    );
    database.close();
  });

  it("rejects a pre-migrator database without changing its file", async () => {
    const root = await createTemporaryDirectory();
    const path = `${root}/legacy.sqlite`;
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE legacy (value TEXT); INSERT INTO legacy VALUES ('keep'); PRAGMA user_version = 1;"
    );
    legacy.close();
    const before = await readFile(path);

    expect(() => openDatabase(path)).toThrow(
      "predates the versioned migration system"
    );

    expect(await readFile(path)).toEqual(before);
    await rm(root, { force: true, recursive: true });
  });
});

function createTemporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "contentdesk-migration-"));
}
