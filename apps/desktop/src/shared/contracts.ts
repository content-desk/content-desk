import { z } from "zod";

export const providerKindSchema = z.enum([
  "openai-compatible",
  "anthropic-compatible",
  "azure-openai",
  "vertex-ai",
  "amazon-bedrock",
]);
export type ProviderKind = z.infer<typeof providerKindSchema>;

export const supportedProviderKinds = [
  "openai-compatible",
  "anthropic-compatible",
] as const satisfies readonly ProviderKind[];
export type SupportedProviderKind = (typeof supportedProviderKinds)[number];

export function isSupportedProviderKind(
  kind: ProviderKind
): kind is SupportedProviderKind {
  return supportedProviderKinds.some((supportedKind) => supportedKind === kind);
}

const providerBaseUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    const loopback = new Set(["127.0.0.1", "[::1]", "localhost"]);
    return (
      (url.protocol === "https:" ||
        (url.protocol === "http:" && loopback.has(url.hostname))) &&
      !url.username &&
      !url.password
    );
  }, "Base URL must use HTTPS (HTTP is limited to loopback) and cannot contain credentials.");

export const providerInputSchema = z.object({
  apiKey: z.string().max(8192).optional(),
  baseUrl: providerBaseUrlSchema.optional(),
  clearHeaders: z.boolean().optional(),
  headers: z
    .record(z.string().trim().min(1).max(128), z.string().max(8192))
    .default({}),
  id: z.string().uuid().optional(),
  kind: providerKindSchema,
  model: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(80),
});
export type ProviderInput = z.infer<typeof providerInputSchema>;

export const providerViewSchema = providerInputSchema
  .omit({ apiKey: true, clearHeaders: true, headers: true })
  .extend({
    createdAt: z.string(),
    hasApiKey: z.boolean(),
    headerNames: z.array(z.string()),
    id: z.string().uuid(),
    supported: z.boolean(),
    updatedAt: z.string(),
  });
export type ProviderView = z.infer<typeof providerViewSchema>;

export const runtimeKindSchema = z.enum([
  "contentdesk-native",
  "codex",
  "claude-code",
]);
export type RuntimeKind = z.infer<typeof runtimeKindSchema>;

export const runtimeProfileSchema = z.object({
  available: z.boolean(),
  capabilities: z.array(z.string()),
  enabled: z.boolean(),
  executablePath: z.string().nullable(),
  kind: runtimeKindSchema,
  lastError: z.string().nullable(),
  lastProbedAt: z.string().nullable(),
  name: z.string(),
  version: z.string().nullable(),
});
export type RuntimeProfile = z.infer<typeof runtimeProfileSchema>;

export const messageRoleSchema = z.enum(["user", "assistant"]);
export const messageSchema = z.object({
  content: z.string(),
  conversationId: z.string().uuid(),
  createdAt: z.string(),
  error: z.string().nullable(),
  id: z.string().uuid(),
  role: messageRoleSchema,
  status: z.enum(["complete", "streaming", "stopped", "error"]),
});
export type ChatMessage = z.infer<typeof messageSchema>;

export const conversationSchema = z.object({
  createdAt: z.string(),
  id: z.string().uuid(),
  model: z.string().nullable(),
  providerId: z.string().uuid().nullable(),
  runtimeKind: runtimeKindSchema,
  title: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const conversationDetailSchema = conversationSchema.extend({
  messages: z.array(messageSchema),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const chatStartSchema = z.object({
  content: z.string().trim().min(1).max(200_000),
  conversationId: z.string().uuid(),
  model: z.string().trim().min(1).max(160),
  providerId: z.string().uuid(),
  runId: z.string().uuid(),
  runtimeKind: runtimeKindSchema,
});
export type ChatStartInput = z.infer<typeof chatStartSchema>;

export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({
    runId: z.string().uuid(),
    text: z.string(),
    type: z.literal("delta"),
  }),
  z.object({
    message: messageSchema,
    runId: z.string().uuid(),
    type: z.literal("done"),
  }),
  z.object({
    message: z.string(),
    runId: z.string().uuid(),
    type: z.literal("error"),
  }),
  z.object({ runId: z.string().uuid(), type: z.literal("stopped") }),
]);
export type ChatEvent = z.infer<typeof chatEventSchema>;

export const ipcResultSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion("ok", [
    z.object({ data, ok: z.literal(true) }),
    z.object({
      error: z.object({ code: z.string(), message: z.string() }),
      ok: z.literal(false),
    }),
  ]);
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export const channels = {
  chatEvent: "chat:event",
  chatRetry: "chat:retry",
  chatStart: "chat:start",
  chatStop: "chat:stop",
  conversationsCreate: "conversations:create",
  conversationsDelete: "conversations:delete",
  conversationsGet: "conversations:get",
  conversationsList: "conversations:list",
  externalOpen: "external:open",
  providersDelete: "providers:delete",
  providersList: "providers:list",
  providersSave: "providers:save",
  providersTest: "providers:test",
  runtimesChooseExecutable: "runtimes:choose-executable",
  runtimesList: "runtimes:list",
  runtimesProbe: "runtimes:probe",
} as const;

export interface DesktopApi {
  chat: {
    start: (input: ChatStartInput) => Promise<IpcResult<{ accepted: true }>>;
    stop: (runId: string) => Promise<IpcResult<null>>;
    retry: (
      input: Omit<ChatStartInput, "content">
    ) => Promise<IpcResult<{ accepted: true }>>;
    onEvent: (listener: (event: ChatEvent) => void) => () => void;
  };
  conversations: {
    list: () => Promise<IpcResult<Conversation[]>>;
    get: (id: string) => Promise<IpcResult<ConversationDetail>>;
    create: (input: {
      providerId?: string;
      model?: string;
    }) => Promise<IpcResult<ConversationDetail>>;
    delete: (id: string) => Promise<IpcResult<null>>;
  };
  openExternal: (url: string) => Promise<IpcResult<null>>;
  providers: {
    list: () => Promise<IpcResult<ProviderView[]>>;
    save: (input: ProviderInput) => Promise<IpcResult<ProviderView>>;
    delete: (id: string) => Promise<IpcResult<null>>;
    test: (id: string) => Promise<IpcResult<{ latencyMs: number }>>;
  };
  runtimes: {
    list: () => Promise<IpcResult<RuntimeProfile[]>>;
    probe: (kind: RuntimeKind) => Promise<IpcResult<RuntimeProfile>>;
    chooseExecutable: (
      kind: Exclude<RuntimeKind, "contentdesk-native">
    ) => Promise<IpcResult<RuntimeProfile | null>>;
  };
}
