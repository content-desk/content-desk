import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const migration = `
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT,
  model TEXT NOT NULL,
  secret_ref TEXT,
  api_key_configured INTEGER NOT NULL DEFAULT 0,
  header_names TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_profiles (
  kind TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executable_path TEXT,
  working_directory TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  available INTEGER NOT NULL DEFAULT 0,
  version TEXT,
  last_error TEXT,
  last_probed_at TEXT
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  model TEXT,
  runtime_kind TEXT NOT NULL DEFAULT 'contentdesk-native',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages(conversation_id, created_at);
PRAGMA user_version = 1;
`;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { mode: 0o700, recursive: true });
  }
  const database = new DatabaseSync(path);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  }
  const version = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (version.user_version > 1) {
    database.close();
    throw new Error(
      `Database version ${version.user_version} is newer than this app supports.`
    );
  }
  if (version.user_version === 0) {
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration);
      seedRuntimes(database);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.close();
      throw error;
    }
  }
  database
    .prepare(
      "UPDATE messages SET status = 'stopped' WHERE status = 'streaming'"
    )
    .run();
  return database;
}

function seedRuntimes(database: DatabaseSync): void {
  const statement = database.prepare(
    "INSERT OR IGNORE INTO runtime_profiles (kind, name, available) VALUES (?, ?, ?)"
  );
  statement.run("contentdesk-native", "ContentDesk Native", 1);
  statement.run("codex", "Codex", 0);
  statement.run("claude-code", "Claude Code", 0);
}
