export type CodexEventRisk =
  | "terminal"
  | "processing-start"
  | "progress-only"
  | "diagnostic-only";

export type CodexEventOwnershipResolution =
  | {
      kind: "explicit";
      workspaceId: string;
      threadId: string;
      turnId: string | null;
      runtimeGeneration: string | null;
      source: "payload" | "affected-thread" | "affected-active-turn" | "shared-native-binding";
      risk: CodexEventRisk;
    }
  | {
      kind: "boundedFallback";
      workspaceId: string;
      threadId: string;
      turnId: null;
      runtimeGeneration: null;
      source: "single-processing-codex-thread";
      risk: CodexEventRisk;
    }
  | {
      kind: "ambiguous";
      workspaceId: string;
      candidateThreadIds: string[];
      reason: string;
      risk: CodexEventRisk;
    }
  | {
      kind: "unresolved";
      workspaceId: string;
      reason: string;
      risk: CodexEventRisk;
    };

export function classifyCodexEventRisk(method: string): CodexEventRisk {
  switch (method) {
    case "runtime/ended":
    case "codex/parseError":
    case "turn/error":
    case "turn/completed":
    case "turn/stalled":
      return "terminal";
    case "turn/started":
    case "thread/status/changed":
    case "thread/status":
      return "processing-start";
    case "codex/raw":
    case "processing/heartbeat":
    case "token_count":
    case "thread/tokenUsage/updated":
    case "item/tool/requestUserInput":
    case "item/reasoning/summaryTextDelta":
    case "response.reasoning_summary_text.delta":
    case "response.reasoning_summary_text.done":
    case "response.reasoning_summary.delta":
    case "response.reasoning_summary.done":
    case "response.reasoning_summary_part.done":
    case "item/reasoning/summaryPartAdded":
    case "response.reasoning_summary_part.added":
    case "item/reasoning/textDelta":
    case "response.reasoning_text.delta":
    case "response.reasoning_text.done":
    case "item/reasoning/delta":
      return "progress-only";
    default:
      return "diagnostic-only";
  }
}

function normalizeThreadId(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function uniqueThreadIds(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export function resolveCodexEventOwnership(input: {
  workspaceId: string;
  risk: CodexEventRisk;
  explicitThreadId?: string | null;
  explicitTurnId?: string | null;
  explicitSource?: "payload" | "affected-thread" | "affected-active-turn" | "shared-native-binding";
  runtimeGeneration?: string | null;
  boundedFallbackThreadIds?: readonly string[];
}): CodexEventOwnershipResolution {
  const workspaceId = input.workspaceId;
  const risk = input.risk;
  const explicitThreadId = normalizeThreadId(input.explicitThreadId);
  if (explicitThreadId) {
    return {
      kind: "explicit",
      workspaceId,
      threadId: explicitThreadId,
      turnId: input.explicitTurnId?.trim() || null,
      runtimeGeneration: input.runtimeGeneration?.trim() || null,
      source: input.explicitSource ?? "payload",
      risk,
    };
  }

  const candidateThreadIds = uniqueThreadIds(input.boundedFallbackThreadIds ?? []);
  if (risk === "diagnostic-only") {
    return {
      kind: "unresolved",
      workspaceId,
      reason: "diagnostic-only Codex event requires explicit owner",
      risk,
    };
  }
  if (candidateThreadIds.length === 1) {
    return {
      kind: "boundedFallback",
      workspaceId,
      threadId: candidateThreadIds[0] ?? "",
      turnId: null,
      runtimeGeneration: null,
      source: "single-processing-codex-thread",
      risk,
    };
  }
  if (candidateThreadIds.length > 1) {
    return {
      kind: "ambiguous",
      workspaceId,
      candidateThreadIds,
      reason: "multiple processing Codex owner candidates",
      risk,
    };
  }
  return {
    kind: "unresolved",
    workspaceId,
    reason: "no explicit or bounded fallback Codex owner",
    risk,
  };
}
