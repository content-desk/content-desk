import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "@desktop/main/database/migrator";

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { mode: 0o700, recursive: true });
  }
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrateDatabase(database);
    if (path !== ":memory:") {
      database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }
    database
      .prepare(
        "UPDATE messages SET status = 'stopped' WHERE status = 'streaming'"
      )
      .run();
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
