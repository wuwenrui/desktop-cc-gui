// Replay harness for turn-trace correlation aggregator.
// Given a list of replay events, synthesize a per-turn timeline of trace
// milestones and pass them through the bounded aggregator.

import {
  __forceTurnTraceForTests,
  completeTurnTrace,
  listTurnTraceSummaries,
  noteTurnBatchFlushBoundary,
  noteTurnDeltaIngress,
  noteTurnFirstEngineDeltaIngress,
  noteTurnFirstVisibleRowRender,
  noteTurnFirstVisibleTextGrowth,
  noteTurnReducerCommit,
  noteTurnRuntimeProcessStarted,
  noteTurnSendCommitted,
  resetTurnTraceCorrelationForTests,
  type TurnTraceDimensions,
  type TurnTraceSummary,
} from "../utils/turnTraceCorrelation";
import type { RealtimeReplayEvent } from "./realtimeReplayTypes";

const REPLAY_FLUSH_WINDOW_MS = 12;
const ASSISTANT_FIRST_VISIBLE_ROW_AFTER_MS = 16;
const ASSISTANT_FIRST_VISIBLE_TEXT_AFTER_MS = 24;
const ASSISTANT_TERMINAL_SETTLEMENT_AFTER_MS = 60;
const REASONING_FIRST_VISIBLE_ROW_AFTER_MS = 18;
const TOOL_FIRST_VISIBLE_ROW_AFTER_MS = 20;
const TOOL_TERMINAL_AFTER_MS = 36;

function inferEngineFromThreadId(threadId: string): TurnTraceDimensions["engine"] {
  if (typeof threadId !== "string" || threadId.length === 0) {
    return "codex";
  }
  if (threadId.startsWith("claude:") || threadId.startsWith("claude-")) {
    return "claude";
  }
  if (threadId.startsWith("gemini:") || threadId.startsWith("gemini-")) {
    return "gemini";
  }
  if (threadId.startsWith("opencode:") || threadId.startsWith("opencode-")) {
    return "opencode";
  }
  return "codex";
}

type PerTurnState = {
  dimensions: TurnTraceDimensions;
  sendCommittedAt: number;
  runtimeStartedAt: number;
  firstDeltaAt: number | null;
  firstVisibleRowAt: number | null;
  firstVisibleTextAt: number | null;
  terminalSettledAt: number | null;
  lastReducerCommitAt: number | null;
  lastDeltaAt: number | null;
  completed: boolean;
};

export type TurnTraceReplayResult = {
  totalTurns: number;
  completedTurns: number;
  summaries: TurnTraceSummary[];
  visibleTextLagP95Ms: number;
  batchFlushDurationP95Ms: number;
  reducerAmplificationMedian: number;
  terminalSettlementP95Ms: number;
  evidenceClassCounts: Record<"measured" | "proxy" | "manual-only" | "unsupported", number>;
};

function normalizeReplayEvidenceClass(summary: TurnTraceSummary): TurnTraceSummary {
  if (summary.dimensions.platform !== "replay" || summary.evidenceClass !== "measured") {
    return summary;
  }
  return {
    ...summary,
    evidenceClass: "proxy",
    evidenceReason: "proxy: replay synthesizes visible render milestones; real WebView timing is not directly measured",
  };
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getSafeEventAtMs(event: RealtimeReplayEvent): number {
  return typeof event.atMs === "number" && Number.isFinite(event.atMs)
    ? event.atMs
    : 0;
}

export function runTurnTraceReplay(events: RealtimeReplayEvent[]): TurnTraceReplayResult {
  // Force-on so the replay path is deterministic regardless of localStorage gate.
  __forceTurnTraceForTests(true);
  resetTurnTraceCorrelationForTests();
  __forceTurnTraceForTests(true);

  const orderedEvents = [...events].sort((left, right) => {
    const leftAtMs = getSafeEventAtMs(left);
    const rightAtMs = getSafeEventAtMs(right);
    if (leftAtMs !== rightAtMs) {
      return leftAtMs - rightAtMs;
    }
    return 0;
  });

  const perTurn = new Map<string, PerTurnState>();
  const activeTurnKeyByThread = new Map<string, string>();
  const turnCountByThread = new Map<string, number>();
  type PendingDelta = { atMs: number; state: PerTurnState };
  const pendingByTurn = new Map<string, PendingDelta[]>();

  const flushTurn = (key: string, flushAtMs: number) => {
    const pending = pendingByTurn.get(key);
    if (!pending || pending.length === 0) {
      return;
    }
    const firstAt = pending[0]!.atMs;
    noteTurnBatchFlushBoundary({
      dimensions: pending[0]!.state.dimensions,
      startedAt: firstAt,
      endedAt: flushAtMs,
      eventCount: pending.length,
      queueDepthAfter: 0,
    });
    pendingByTurn.delete(key);
  };

  for (const event of orderedEvents) {
    const atMs = getSafeEventAtMs(event);
    let key = activeTurnKeyByThread.get(event.threadId);
    if (!key) {
      const nextTurnIndex = (turnCountByThread.get(event.threadId) ?? 0) + 1;
      turnCountByThread.set(event.threadId, nextTurnIndex);
      key = `${event.threadId}#turn-${nextTurnIndex}`;
      activeTurnKeyByThread.set(event.threadId, key);
    }
    let state = perTurn.get(key);
    if (!state) {
      const dimensions: TurnTraceDimensions = {
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        turnId: key,
        engine: inferEngineFromThreadId(event.threadId),
        providerId: null,
        providerName: null,
        baseUrl: null,
        model: null,
        platform: "replay",
      };
      state = {
        dimensions,
        sendCommittedAt: atMs,
        runtimeStartedAt: atMs,
        firstDeltaAt: null,
        firstVisibleRowAt: null,
        firstVisibleTextAt: null,
        terminalSettledAt: null,
        lastReducerCommitAt: null,
        lastDeltaAt: null,
        completed: false,
      };
      perTurn.set(key, state);
      noteTurnSendCommitted(dimensions, atMs);
      noteTurnRuntimeProcessStarted(dimensions, atMs);
    }

    // Close any pending flush on a non-delta event.
    if (
      event.kind !== "agentDelta"
      && event.kind !== "reasoningSummaryDelta"
      && event.kind !== "reasoningContentDelta"
      && event.kind !== "toolOutputDelta"
    ) {
      flushTurn(key, atMs);
    }

    if (
      event.kind === "agentDelta"
      || event.kind === "reasoningSummaryDelta"
      || event.kind === "reasoningContentDelta"
      || event.kind === "toolOutputDelta"
    ) {
      const pendingList = pendingByTurn.get(key) ?? [];
      const lastPending = pendingList[pendingList.length - 1];
      if (lastPending && atMs - lastPending.atMs > REPLAY_FLUSH_WINDOW_MS) {
        flushTurn(key, lastPending.atMs);
      }
      const nextPending = pendingByTurn.get(key) ?? [];
      nextPending.push({ atMs, state });
      pendingByTurn.set(key, nextPending);

      const cadenceSampleMs = state.lastDeltaAt !== null
        ? Math.max(0, atMs - state.lastDeltaAt)
        : undefined;
      state.lastDeltaAt = atMs;
      state.lastReducerCommitAt = atMs;
      if (state.firstDeltaAt === null) {
        state.firstDeltaAt = atMs;
        noteTurnFirstEngineDeltaIngress(state.dimensions, atMs);
        if (event.kind === "agentDelta") {
          state.firstVisibleRowAt = atMs + ASSISTANT_FIRST_VISIBLE_ROW_AFTER_MS;
          state.firstVisibleTextAt = atMs + ASSISTANT_FIRST_VISIBLE_TEXT_AFTER_MS;
          noteTurnFirstVisibleRowRender(state.dimensions, state.firstVisibleRowAt);
          noteTurnFirstVisibleTextGrowth(state.dimensions, {
            atMs: state.firstVisibleTextAt,
            visibleTextGrowthCount: 1,
          });
        } else if (event.kind === "reasoningSummaryDelta" || event.kind === "reasoningContentDelta") {
          state.firstVisibleRowAt = atMs + REASONING_FIRST_VISIBLE_ROW_AFTER_MS;
          noteTurnFirstVisibleRowRender(state.dimensions, state.firstVisibleRowAt);
        } else if (event.kind === "toolOutputDelta") {
          state.firstVisibleRowAt = atMs + TOOL_FIRST_VISIBLE_ROW_AFTER_MS;
          noteTurnFirstVisibleRowRender(state.dimensions, state.firstVisibleRowAt);
        }
      } else {
        noteTurnDeltaIngress(state.dimensions, atMs);
      }
      noteTurnReducerCommit({
        dimensions: state.dimensions,
        atMs,
        isAssistantDelta: event.kind === "agentDelta",
        isReasoningDelta: event.kind === "reasoningSummaryDelta" || event.kind === "reasoningContentDelta",
        isToolDelta: event.kind === "toolOutputDelta",
        cadenceSampleMs,
      });
    } else if (event.kind === "agentCompleted") {
      state.terminalSettledAt = atMs + ASSISTANT_TERMINAL_SETTLEMENT_AFTER_MS;
      state.completed = true;
      noteTurnReducerCommit({
        dimensions: state.dimensions,
        atMs,
        isAssistantDelta: false,
        isToolCompleted: true,
      });
      completeTurnTrace(state.dimensions, { atMs: state.terminalSettledAt, reason: "completed" });
      flushTurn(key, state.terminalSettledAt);
      activeTurnKeyByThread.delete(event.threadId);
    } else if (event.kind === "toolStarted") {
      state.lastReducerCommitAt = atMs;
      state.terminalSettledAt = atMs + TOOL_TERMINAL_AFTER_MS;
      noteTurnReducerCommit({
        dimensions: state.dimensions,
        atMs,
        isAssistantDelta: false,
      });
    }
  }

  for (const [tk, pending] of pendingByTurn.entries()) {
    if (pending.length > 0) {
      const last = pending[pending.length - 1]!;
      flushTurn(tk, last.atMs);
    }
  }
  pendingByTurn.clear();

  const summaries = listTurnTraceSummaries().map(normalizeReplayEvidenceClass);
  const completedSummaries = summaries.filter((summary) => summary.endedReason === "completed");

  const visibleTextLag = completedSummaries
    .map((summary) => summary.deltas.firstDeltaToFirstVisibleTextMs ?? 0)
    .filter((value) => value > 0);
  const batchFlushDurations = completedSummaries
    .filter((summary) => summary.counters.batchFlushDurationCount > 0)
    .flatMap((summary) => {
      const avg = summary.counters.batchFlushDurationAvgMs ?? 0;
      return avg > 0 ? [avg] : [];
    });
  const reducerAmplifications = completedSummaries
    .map((summary) => summary.counters.reducerAmplification ?? 0)
    .filter((value) => value > 0);
  const terminalSettlementLags = completedSummaries
    .map((summary) => summary.counters.terminalSettlementLagMs ?? 0)
    .filter((value) => value > 0);

  const evidenceClassCounts = {
    "measured": 0,
    "proxy": 0,
    "manual-only": 0,
    "unsupported": 0,
  } as Record<"measured" | "proxy" | "manual-only" | "unsupported", number>;
  for (const summary of summaries) {
    evidenceClassCounts[summary.evidenceClass] += 1;
  }

  return {
    totalTurns: summaries.length,
    completedTurns: completedSummaries.length,
    summaries,
    visibleTextLagP95Ms: round2(percentile(visibleTextLag, 0.95)),
    batchFlushDurationP95Ms: round2(percentile(batchFlushDurations, 0.95)),
    reducerAmplificationMedian: round2(median(reducerAmplifications)),
    terminalSettlementP95Ms: round2(percentile(terminalSettlementLags, 0.95)),
    evidenceClassCounts,
  };
}
