import type { DebugEntry } from "../../../types";
import type { ThreadRecoveryDecision } from "./useThreadActions.helpers";

export type ThreadReopenOutcome =
  | "recovered"
  | "degraded-readable"
  | "fresh-continuation"
  | "failed";

export function createThreadHistoryReadableSurfaceDebugEntry(input: {
  workspaceId: string;
  threadId: string;
  sourceThreadId?: string;
  reopenOutcome: ThreadReopenOutcome;
  reasonCode?: string;
  localItemCount: number;
  snapshotItemCount: number;
  fallbackWarningCount?: number;
}): DebugEntry {
  return {
    id: `${Date.now()}-history-loader-readable-surface`,
    timestamp: Date.now(),
    source: input.reopenOutcome === "failed" ? "error" : "client",
    label: "thread/history readable surface",
    payload: input,
  };
}

export function createThreadHistoryContinuationDecisionDebugEntry(input: {
  workspaceId: string;
  staleThreadId: string;
  replacementThreadId: string;
  decision: ThreadRecoveryDecision;
}): DebugEntry {
  const verifiedRebind = input.decision.isPersistent;
  return {
    id: `${Date.now()}-history-loader-continuation-decision`,
    timestamp: Date.now(),
    source: "client",
    label: "thread/history continuation decision",
    payload: {
      workspaceId: input.workspaceId,
      staleThreadId: input.staleThreadId,
      replacementThreadId: input.replacementThreadId,
      reopenOutcome: verifiedRebind ? "recovered" : "fresh-continuation",
      reasonCode: verifiedRebind ? "verified-rebind" : "unverified-stale-thread",
      aliasPersisted: verifiedRebind,
      recoveryStrategy: input.decision.strategy,
      recoveryConfidence: input.decision.confidence,
    },
  };
}
