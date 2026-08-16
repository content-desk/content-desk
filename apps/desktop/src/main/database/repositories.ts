import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  type ChatMessage,
  type Conversation,
  type ConversationDetail,
  isSupportedProviderKind,
  type ProviderInput,
  type ProviderKind,
  type ProviderView,
  type RuntimeKind,
  type RuntimeProfile,
} from "@desktop/shared/contracts";

interface ProviderRow {
  api_key_configured: number;
  base_url: string | null;
  created_at: string;
  header_names: string;
  id: string;
  kind: ProviderKind;
  model: string;
  name: string;
  secret_ref: string | null;
  updated_at: string;
}
interface ConversationRow {
  created_at: string;
  id: string;
  model: string | null;
  provider_id: string | null;
  runtime_kind: RuntimeKind;
  title: string;
  updated_at: string;
}
interface MessageRow {
  content: string;
  conversation_id: string;
  created_at: string;
  error: string | null;
  id: string;
  role: "user" | "assistant";
  status: ChatMessage["status"];
}
interface RuntimeRow {
  available: number;
  enabled: number;
  executable_path: string | null;
  kind: RuntimeKind;
  last_error: string | null;
  last_probed_at: string | null;
  name: string;
  version: string | null;
}

export class Repositories {
  public constructor(private readonly db: DatabaseSync) {}

  listProviders(): ProviderView[] {
    const rows = this.db
      .prepare("SELECT * FROM providers ORDER BY updated_at DESC")
      .all() as unknown as ProviderRow[];
    return rows.map((row) => this.providerView(row));
  }

  getProviderRow(id: string): ProviderRow | undefined {
    return this.db.prepare("SELECT * FROM providers WHERE id = ?").get(id) as
      | ProviderRow
      | undefined;
  }

  saveProvider(
    input: ProviderInput,
    secretRef: string | null,
    secretMeta: { hasApiKey: boolean; headerNames: string[] }
  ): ProviderView {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const existing = this.getProviderRow(id);
    this.db
      .prepare(`
      INSERT INTO providers (id, name, kind, base_url, model, secret_ref, api_key_configured, header_names, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind,
        base_url=excluded.base_url, model=excluded.model, secret_ref=excluded.secret_ref,
        api_key_configured=excluded.api_key_configured, header_names=excluded.header_names,
        updated_at=excluded.updated_at
    `)
      .run(
        id,
        input.name,
        input.kind,
        input.baseUrl ?? null,
        input.model,
        secretRef,
        secretMeta.hasApiKey ? 1 : 0,
        JSON.stringify(secretMeta.headerNames),
        existing?.created_at ?? now,
        now
      );
    const saved = this.getProviderRow(id);
    if (!saved) {
      throw new Error("Provider was not saved.");
    }
    return this.providerView(saved);
  }

  deleteProvider(id: string): string | null {
    const row = this.getProviderRow(id);
    this.db.prepare("DELETE FROM providers WHERE id = ?").run(id);
    return row?.secret_ref ?? null;
  }

  listConversations(): Conversation[] {
    return (
      this.db
        .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
        .all() as unknown as ConversationRow[]
    ).map(mapConversation);
  }

  createConversation(providerId?: string, model?: string): ConversationDetail {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(`INSERT INTO conversations
      (id, title, provider_id, model, runtime_kind, created_at, updated_at)
      VALUES (?, '新对话', ?, ?, 'contentdesk-native', ?, ?)`)
      .run(id, providerId ?? null, model ?? null, now, now);
    const saved = this.getConversationRow(id);
    if (!saved) {
      throw new Error("Conversation was not created.");
    }
    return { ...mapConversation(saved), messages: [] };
  }

  getConversation(id: string): ConversationDetail | undefined {
    const row = this.getConversationRow(id);
    if (!row) {
      return;
    }
    const messages = this.db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid"
      )
      .all(id) as unknown as MessageRow[];
    return { ...mapConversation(row), messages: messages.map(mapMessage) };
  }

  deleteConversation(id: string): void {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }

  addMessage(
    conversationId: string,
    role: ChatMessage["role"],
    content: string,
    status: ChatMessage["status"]
  ): ChatMessage {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?, NULL, ?)")
      .run(id, conversationId, role, content, status, now);
    if (role === "user") {
      const title = content.replace(/\s+/g, " ").slice(0, 42);
      this.db
        .prepare(
          "UPDATE conversations SET title = CASE WHEN title = '新对话' THEN ? ELSE title END, updated_at = ? WHERE id = ?"
        )
        .run(title, now, conversationId);
    }
    return {
      content,
      conversationId,
      createdAt: now,
      error: null,
      id,
      role,
      status,
    };
  }

  updateMessage(
    id: string,
    content: string,
    status: ChatMessage["status"],
    error: string | null = null
  ): ChatMessage {
    this.db
      .prepare(
        "UPDATE messages SET content = ?, status = ?, error = ? WHERE id = ?"
      )
      .run(content, status, error, id);
    return mapMessage(
      this.db
        .prepare("SELECT * FROM messages WHERE id = ?")
        .get(id) as unknown as MessageRow
    );
  }

  getLastUserMessage(conversationId: string): ChatMessage | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at DESC, rowid DESC LIMIT 1"
      )
      .get(conversationId) as MessageRow | undefined;
    return row ? mapMessage(row) : undefined;
  }

  listRuntimes(): RuntimeProfile[] {
    return (
      this.db
        .prepare("SELECT * FROM runtime_profiles ORDER BY rowid")
        .all() as unknown as RuntimeRow[]
    ).map(mapRuntime);
  }

  getRuntime(kind: RuntimeKind): RuntimeProfile {
    return mapRuntime(
      this.db
        .prepare("SELECT * FROM runtime_profiles WHERE kind = ?")
        .get(kind) as unknown as RuntimeRow
    );
  }

  updateRuntime(
    kind: RuntimeKind,
    update: Partial<
      Pick<
        RuntimeProfile,
        | "executablePath"
        | "available"
        | "version"
        | "lastError"
        | "lastProbedAt"
      >
    >
  ): RuntimeProfile {
    const current = this.getRuntime(kind);
    const next = { ...current, ...update };
    this.db
      .prepare(`UPDATE runtime_profiles SET executable_path=?, available=?,
      version=?, last_error=?, last_probed_at=? WHERE kind=?`)
      .run(
        next.executablePath,
        next.available ? 1 : 0,
        next.version,
        next.lastError,
        next.lastProbedAt,
        kind
      );
    return this.getRuntime(kind);
  }

  private getConversationRow(id: string): ConversationRow | undefined {
    return this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as ConversationRow | undefined;
  }

  private providerView(row: ProviderRow): ProviderView {
    return {
      baseUrl: row.base_url ?? undefined,
      createdAt: row.created_at,
      hasApiKey: Boolean(row.api_key_configured),
      headerNames: JSON.parse(row.header_names) as string[],
      id: row.id,
      kind: row.kind,
      model: row.model,
      name: row.name,
      supported: isSupportedProviderKind(row.kind),
      updatedAt: row.updated_at,
    };
  }
}

const mapConversation = (row: ConversationRow): Conversation => ({
  createdAt: row.created_at,
  id: row.id,
  model: row.model,
  providerId: row.provider_id,
  runtimeKind: row.runtime_kind,
  title: row.title,
  updatedAt: row.updated_at,
});
const mapMessage = (row: MessageRow): ChatMessage => ({
  content: row.content,
  conversationId: row.conversation_id,
  createdAt: row.created_at,
  error: row.error,
  id: row.id,
  role: row.role,
  status: row.status,
});
const mapRuntime = (row: RuntimeRow): RuntimeProfile => ({
  available: Boolean(row.available),
  capabilities:
    row.kind === "contentdesk-native"
      ? ["chat", "stream", "stop", "retry"]
      : ["discovery", "version-probe"],
  enabled: Boolean(row.enabled),
  executablePath: row.executable_path,
  kind: row.kind,
  lastError: row.last_error,
  lastProbedAt: row.last_probed_at,
  name: row.name,
  version: row.version,
});
