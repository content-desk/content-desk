CREATE TABLE _migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE providers (
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

CREATE TABLE runtime_profiles (
  kind TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executable_path TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  available INTEGER NOT NULL DEFAULT 0,
  version TEXT,
  last_error TEXT,
  last_probed_at TEXT
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  model TEXT,
  runtime_kind TEXT NOT NULL DEFAULT 'contentdesk-native',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX messages_conversation_created_idx
  ON messages(conversation_id, created_at);

INSERT OR IGNORE INTO runtime_profiles (kind, name, available)
VALUES ('contentdesk-native', 'ContentDesk Native', 1);
INSERT OR IGNORE INTO runtime_profiles (kind, name, available)
VALUES ('codex', 'Codex', 0);
INSERT OR IGNORE INTO runtime_profiles (kind, name, available)
VALUES ('claude-code', 'Claude Code', 0);
