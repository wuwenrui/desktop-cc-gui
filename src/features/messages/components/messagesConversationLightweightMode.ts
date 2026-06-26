import type { TimelineRenderWeightSummary } from "./messagesTimelineVirtualization";

export const CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT = 180;
export const CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS = 4;
export const CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT = 520;
export const CONVERSATION_OVERSIZED_HISTORY_ROWS = 260;
export const CONVERSATION_RENDER_MODE_KEY_LIMIT = 96;

export type ConversationLightweightPolicy = {
  suggested: boolean;
  oversized: boolean;
};

export type ConversationLightweightModeState = {
  active: boolean;
  reason: "manual" | "oversized" | "inactive";
};

export function resolveConversationLightweightPolicy(
  summary: Pick<TimelineRenderWeightSummary, "rowCount" | "renderWeight" | "heavyRowCount">,
): ConversationLightweightPolicy {
  const oversized =
    summary.renderWeight >= CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT ||
    summary.rowCount >= CONVERSATION_OVERSIZED_HISTORY_ROWS;
  const suggested =
    oversized ||
    summary.renderWeight >= CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT ||
    summary.heavyRowCount >= CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS;
  return { suggested, oversized };
}

export function resolveConversationLightweightModeState(input: {
  policy: ConversationLightweightPolicy;
  manualEnabled: boolean;
  detailHydrationRequested: boolean;
}): ConversationLightweightModeState {
  if (input.manualEnabled) {
    return { active: true, reason: "manual" };
  }
  if (input.policy.oversized && !input.detailHydrationRequested) {
    return { active: true, reason: "oversized" };
  }
  return { active: false, reason: "inactive" };
}

export function addBoundedConversationRenderModeKey(
  previous: Set<string>,
  key: string,
  limit = CONVERSATION_RENDER_MODE_KEY_LIMIT,
): Set<string> {
  if (!key || previous.has(key)) {
    return previous;
  }
  const next = new Set(previous);
  const normalizedLimit = Math.max(1, Math.floor(limit));
  while (next.size >= normalizedLimit) {
    const oldestKey = next.values().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    next.delete(oldestKey);
  }
  next.add(key);
  return next;
}
