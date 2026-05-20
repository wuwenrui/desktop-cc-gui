import type { ConversationItem } from "../../../types";
import { isTerminalToolStatus } from "./useThreadActions.helpers";

type MessageConversationItem = Extract<ConversationItem, { kind: "message" }>;
type AssistantConversationItem = MessageConversationItem & { role: "assistant" };

export function normalizeTerminalDriftTurnId(turnId: string | null | undefined) {
  const normalized = turnId?.trim() || "";
  return normalized && normalized !== "__unknown_turn__" ? normalized : null;
}

export function findLatestFinalAssistantCompletionEvidence(
  items: ConversationItem[],
  options?: { processingStartedAt?: number | null },
): { item: AssistantConversationItem; index: number } | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || item.kind !== "message") {
      continue;
    }
    if (item.role !== "assistant" || item.isFinal !== true || !item.text.trim()) {
      return null;
    }
    if (typeof options?.processingStartedAt === "number") {
      if (typeof item.finalCompletedAt !== "number") {
        return null;
      }
      if (item.finalCompletedAt < options.processingStartedAt) {
        return null;
      }
    }
    return { item: item as AssistantConversationItem, index };
  }
  return null;
}

export function hasFinalAssistantCompletionEvidence(
  items: ConversationItem[],
  options?: { processingStartedAt?: number | null },
) {
  return findLatestFinalAssistantCompletionEvidence(items, options) !== null;
}

export function hasActiveTerminalDriftWork(items: ConversationItem[]) {
  return items.some((item) => {
    if (item.kind === "generatedImage") {
      return item.status === "processing";
    }
    if (item.kind !== "tool") {
      return false;
    }
    const status = item.status?.trim().toLowerCase() ?? "";
    if (!status) {
      return true;
    }
    return !isTerminalToolStatus(status);
  });
}

export function isNativeCodexTerminalDriftThread(input: {
  threadId: string;
  engine?: "codex" | "claude" | "gemini" | "opencode";
  kind: "native" | "shared";
}) {
  if (input.kind === "shared") {
    return false;
  }
  if (input.engine && input.engine !== "codex") {
    return false;
  }
  return !(
    input.threadId.startsWith("claude:") ||
    input.threadId.startsWith("claude-pending-") ||
    input.threadId.startsWith("gemini:") ||
    input.threadId.startsWith("gemini-pending-") ||
    input.threadId.startsWith("opencode:") ||
    input.threadId.startsWith("opencode-pending-") ||
    input.threadId.startsWith("shared:")
  );
}
