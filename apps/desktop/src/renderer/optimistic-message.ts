import type { ChatMessage } from "@desktop/shared/contracts";

export function optimisticMessage(
  conversationId: string,
  content: string
): ChatMessage {
  return {
    content,
    conversationId,
    createdAt: new Date().toISOString(),
    error: null,
    id: crypto.randomUUID(),
    role: "user",
    status: "complete",
  };
}
