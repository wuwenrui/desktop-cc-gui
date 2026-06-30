import { startTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { workspaceScopedHas, type WorkspaceScopedMap } from "./workspaceScopedMap";
import type { Dispatch, MutableRefObject } from "react";
import { buildConversationItem } from "../../../utils/threadItems";
import type { NormalizedThreadEvent } from "../contracts/conversationCurtainContracts";
import {
  createRealtimeEventBatcher,
  type RealtimeBatcherFlush,
  type RealtimeBatcherFlushReason,
} from "../contracts/realtimeEventBatcher";
import { asString } from "../utils/threadNormalize";
import type { ConversationItem, DebugEntry } from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";
import { isRealtimeBatchingEnabled, readStreamingScheduleTier } from "../utils/realtimePerfFlags";
import {
  resolveDispatchSubmitMode,
  type DispatchSubmitMode,
} from "../utils/renderSchedulingPolicy";
import {
  buildToolOutputKey,
  createToolOutputTailGate,
  type ToolOutputKey,
} from "./useToolOutputTailGate";
import {
  applyPendingClaudeMcpOutputNoticeToAgentCompleted,
  applyPendingClaudeMcpOutputNoticeToAgentDelta,
} from "../utils/claudeMcpRuntimeSnapshot";
import {
  appendLiveAssistantShadowDelta,
  settleLiveAssistantShadowTranscript,
  upsertLiveAssistantShadowSnapshot,
} from "../utils/liveAssistantShadowTranscript";
import {
  noteRealtimeCoalescedFlush,
  noteThreadReducerWorkMeasured,
} from "../utils/streamLatencyDiagnostics";

const CLAUDE_STREAM_DEBUG_FLAG_KEY = "ccgui.debug.claude.stream";

/**
 * Infer engine type from thread ID.
 * Claude/Gemini/OpenCode threads use "<engine>:" or "<engine>-pending-" prefixes.
 */
function inferEngineFromThreadId(threadId: string): "claude" | "codex" | "gemini" | "opencode" {
  if (threadId.startsWith("claude:") || threadId.startsWith("claude-pending-")) {
    return "claude";
  }
  if (threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-")) {
    return "gemini";
  }
  if (threadId.startsWith("opencode:") || threadId.startsWith("opencode-pending-")) {
    return "opencode";
  }
  return "codex";
}

function isClaudeThread(threadId: string) {
  return threadId.startsWith("claude:") || threadId.startsWith("claude-pending-");
}

function isGeminiThread(threadId: string) {
  return threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-");
}

function readHighResolutionNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

type ReasoningEngineHint = "gemini" | null;

function isGeminiEventThread(
  threadId: string,
  engineHint?: ReasoningEngineHint,
) {
  return engineHint === "gemini" || isGeminiThread(threadId);
}

function inferItemEngineSource(
  item: Record<string, unknown>,
  threadId: string,
): ReasoningEngineHint {
  const rawEngineSource = asString(item.engineSource ?? item.engine_source ?? "")
    .trim()
    .toLowerCase();
  if (rawEngineSource === "gemini") {
    return "gemini";
  }
  return isGeminiThread(threadId) ? "gemini" : null;
}

function isInterruptedThread(
  interruptedThreadsRef: MutableRefObject<WorkspaceScopedMap<true>>,
  workspaceId: string | null,
  threadId: string,
) {
  return workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId);
}

function isClaudeStreamDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const value = window.localStorage.getItem(CLAUDE_STREAM_DEBUG_FLAG_KEY);
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on";
  } catch {
    return false;
  }
}

function createDebugPreview(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

type UseThreadItemEventsOptions = {
  activeThreadId: string | null;
  dispatch: Dispatch<ThreadAction>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  resolveCollaborationUiMode?: (
    threadId: string,
  ) => "plan" | "code" | null;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  safeMessageActivity: () => void;
  recordThreadActivity: (
    workspaceId: string,
    threadId: string,
    timestamp?: number,
  ) => void;
  applyCollabThreadLinks: (
    threadId: string,
    item: Record<string, unknown>,
  ) => void;
  interruptedThreadsRef: MutableRefObject<WorkspaceScopedMap<true>>;
  onDebug?: (entry: DebugEntry) => void;
  onAgentMessageCompletedExternal?: (payload: {
    workspaceId: string;
    threadId: string;
    turnId?: string | null;
    itemId: string;
    text: string;
  }) => void;
  onExitPlanModeToolCompleted?: (payload: {
    workspaceId: string;
    threadId: string;
    itemId: string;
  }) => void;
  scheduleRealtimeDispatch?: (run: () => void) => void;
};

type RealtimeDeltaOperation =
  | {
      kind: "agentDelta";
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      turnId?: string | null;
    }
  | {
      kind: "reasoningSummaryDelta";
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      engineHint?: ReasoningEngineHint;
      turnId?: string | null;
    }
  | {
      kind: "reasoningSummaryBoundary";
      workspaceId: string;
      threadId: string;
      itemId: string;
      engineHint?: ReasoningEngineHint;
      turnId?: string | null;
    }
  | {
      kind: "reasoningContentDelta";
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      engineHint?: ReasoningEngineHint;
      turnId?: string | null;
    }
  | {
      kind: "toolOutputDelta";
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      turnId?: string | null;
    };

const REALTIME_DELTA_BATCH_FLUSH_MS = 12;
const NORMALIZED_REALTIME_BATCH_FLUSH_MS = 12;

type PendingNormalizedRealtimeOperation = {
  event: NormalizedThreadEvent;
  hasCustomName: boolean;
};

function isCodexAssistantMessageItem(
  item: NormalizedThreadEvent["item"],
): item is Extract<ConversationItem, { kind: "message"; role: "assistant" }> {
  return item.kind === "message" && item.role === "assistant";
}

function shouldBatchNormalizedRealtimeEvent(event: NormalizedThreadEvent) {
  return (
    (isCodexAssistantMessageItem(event.item) &&
      (event.operation === "itemStarted" || event.operation === "itemUpdated")) ||
    event.operation === "appendReasoningContentDelta" ||
    event.operation === "appendReasoningSummaryDelta" ||
    event.operation === "appendToolOutputDelta"
  );
}

function shouldUseContractRealtimeBatcher(event: NormalizedThreadEvent) {
  return event.operation === "appendAgentMessageDelta";
}

export function shouldUrgentlyDispatchReasoningDelta(
  event: NormalizedThreadEvent,
  flushReason: RealtimeBatcherFlushReason,
) {
  return (
    event.operation === "appendReasoningContentDelta" &&
    flushReason === "first-token"
  );
}

function shouldDispatchNormalizedRealtimeEventUrgently(
  event: NormalizedThreadEvent,
  flushReason: RealtimeBatcherFlushReason,
) {
  return (
    event.operation === "appendAgentMessageDelta" ||
    shouldUrgentlyDispatchReasoningDelta(event, flushReason)
  );
}

function buildPendingNormalizedRealtimeOperationKey(event: NormalizedThreadEvent) {
  return `${event.threadId}\u0000${event.item.kind}\u0000${event.item.id}`;
}

const MAX_TERMINAL_TURN_IDS_PER_THREAD = 12;

function normalizeTurnId(value: unknown) {
  return asString(value).trim();
}

function extractTurnIdFromRawItem(item: Record<string, unknown>) {
  const turn = item.turn && typeof item.turn === "object"
    ? (item.turn as Record<string, unknown>)
    : null;
  return normalizeTurnId(
    item.turnId ??
      item.turn_id ??
      turn?.id ??
      turn?.turnId ??
      turn?.turn_id ??
      "",
  );
}

function extractTurnIdFromNormalizedRealtimeEvent(event: NormalizedThreadEvent) {
  const eventTurnId = normalizeTurnId(event.turnId);
  if (eventTurnId) {
    return eventTurnId;
  }
  if (!event.rawItem) {
    return "";
  }
  return extractTurnIdFromRawItem(event.rawItem);
}

export function useThreadItemEvents({
  activeThreadId,
  dispatch,
  getCustomName,
  resolveCollaborationUiMode,
  markProcessing,
  markReviewing,
  safeMessageActivity,
  recordThreadActivity,
  applyCollabThreadLinks,
  interruptedThreadsRef,
  onDebug,
  onAgentMessageCompletedExternal,
  onExitPlanModeToolCompleted,
  scheduleRealtimeDispatch = startTransition,
}: UseThreadItemEventsOptions) {
  const enableRealtimeBatchingRef = useRef(isRealtimeBatchingEnabled());
  const pendingRealtimeDeltaOpsRef = useRef<RealtimeDeltaOperation[]>([]);
  const realtimeFlushTimerRef = useRef<number | null>(null);
  const isFlushingRealtimeDeltaOpsRef = useRef(false);
  const pendingNormalizedRealtimeOpsRef = useRef<Map<string, PendingNormalizedRealtimeOperation>>(
    new Map(),
  );
  const normalizedRealtimeBatcherRef = useRef(createRealtimeEventBatcher());
  const normalizedRealtimeFlushTimerRef = useRef<number | null>(null);
  const isFlushingNormalizedRealtimeOpsRef = useRef(false);
  const activeRealtimeTurnIdByThreadRef = useRef<Map<string, string>>(new Map());
  const terminalRealtimeTurnIdsByThreadRef = useRef<Map<string, Set<string>>>(new Map());

  const normalizeToolIdentifier = useCallback((value: string) => {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }, []);

  const isClaudeExitPlanModeTool = useCallback(
    (item: Extract<ConversationItem, { kind: "tool" }>) => {
      const normalizedToolType = normalizeToolIdentifier(item.toolType);
      const normalizedTitle = normalizeToolIdentifier(item.title);
      return (
        normalizedToolType === "exitplanmode" ||
        normalizedToolType.endsWith("exitplanmode") ||
        normalizedTitle.includes("exitplanmode")
      );
    },
    [normalizeToolIdentifier],
  );

  const logReasoningRoute = useCallback(
    (
      label: string,
      payload: {
        workspaceId: string;
        threadId: string;
        itemId: string;
        deltaLength?: number;
        skipped?: boolean;
        reason?: string;
      },
    ) => {
      onDebug?.({
        id: `${Date.now()}-thread-reasoning-route`,
        timestamp: Date.now(),
        source: "event",
        label: `thread/session:${label}`,
        payload: {
          ...payload,
          activeThreadId,
        },
      });
    },
    [activeThreadId, onDebug],
  );

  const logClaudeStream = useCallback(
    (
      label: string,
      payload: {
        workspaceId: string;
        threadId: string;
        itemId?: string;
        itemType?: string;
        deltaLength?: number;
        textPreview?: string;
        skipped?: boolean;
        reason?: string;
      },
    ) => {
      if (!onDebug || !isClaudeThread(payload.threadId) || !isClaudeStreamDebugEnabled()) {
        return;
      }
      onDebug({
        id: `${Date.now()}-claude-stream-${label}`,
        timestamp: Date.now(),
        source: "event",
        label: `thread/session:claude-stream:${label}`,
        payload: {
          ...payload,
          activeThreadId,
        },
      });
    },
    [activeThreadId, onDebug],
  );

  const isRealtimeTurnTerminal = useCallback(
    (
      threadId: string,
      turnId?: string | null,
      options: {
        allowActiveTurnFallback?: boolean;
      } = {},
    ) => {
      const normalizedTurnId = normalizeTurnId(turnId);
      const resolvedTurnId =
        normalizedTurnId ||
        (options.allowActiveTurnFallback === false
          ? ""
          : activeRealtimeTurnIdByThreadRef.current.get(threadId) ?? "");
      if (!resolvedTurnId) {
        return false;
      }
      return terminalRealtimeTurnIdsByThreadRef.current
        .get(threadId)
        ?.has(resolvedTurnId) ?? false;
    },
    [],
  );

  const noteRealtimeTurnStarted = useCallback((threadId: string, turnId: string) => {
    const normalizedTurnId = normalizeTurnId(turnId);
    if (!threadId || !normalizedTurnId) {
      return;
    }
    activeRealtimeTurnIdByThreadRef.current.set(threadId, normalizedTurnId);
  }, []);

  const markRealtimeTurnTerminal = useCallback((threadId: string, turnId: string) => {
    const normalizedTurnId = normalizeTurnId(turnId);
    if (!threadId || !normalizedTurnId) {
      return;
    }
    let threadTurnIds = terminalRealtimeTurnIdsByThreadRef.current.get(threadId);
    if (!threadTurnIds) {
      threadTurnIds = new Set<string>();
      terminalRealtimeTurnIdsByThreadRef.current.set(threadId, threadTurnIds);
    }
    threadTurnIds.delete(normalizedTurnId);
    threadTurnIds.add(normalizedTurnId);
    while (threadTurnIds.size > MAX_TERMINAL_TURN_IDS_PER_THREAD) {
      const oldestTurnId = threadTurnIds.values().next().value;
      if (!oldestTurnId) {
        break;
      }
      threadTurnIds.delete(oldestTurnId);
    }
    if (!activeRealtimeTurnIdByThreadRef.current.has(threadId)) {
      activeRealtimeTurnIdByThreadRef.current.set(threadId, normalizedTurnId);
    }
  }, []);

  const isRealtimeTurnTerminalExact = useCallback(
    (threadId: string, turnId?: string | null) =>
      isRealtimeTurnTerminal(threadId, turnId, {
        allowActiveTurnFallback: false,
      }),
    [isRealtimeTurnTerminal],
  );

  const applyRealtimeDeltaOperation = useCallback(
    (
      operation: RealtimeDeltaOperation,
      context?: {
        ensuredThreads?: Set<string>;
        markedProcessingThreads?: Set<string>;
      },
    ) => {
      if (isInterruptedThread(interruptedThreadsRef, operation.workspaceId, operation.threadId)) {
        return;
      }
      if (isRealtimeTurnTerminal(operation.threadId, operation.turnId)) {
        return;
      }
      const ensuredThreads = context?.ensuredThreads;
      const markedProcessingThreads = context?.markedProcessingThreads;
      if (!ensuredThreads || !ensuredThreads.has(operation.threadId)) {
        dispatch({
          type: "ensureThread",
          workspaceId: operation.workspaceId,
          threadId: operation.threadId,
          engine: inferEngineFromThreadId(operation.threadId),
        });
        ensuredThreads?.add(operation.threadId);
      }
      const reasoningEngineHint =
        "engineHint" in operation ? operation.engineHint : undefined;
      const isGeminiReasoningDelta =
        isGeminiEventThread(operation.threadId, reasoningEngineHint) &&
        (operation.kind === "reasoningSummaryDelta" ||
          operation.kind === "reasoningSummaryBoundary" ||
          operation.kind === "reasoningContentDelta");
      if (
        !isGeminiReasoningDelta &&
        (!markedProcessingThreads || !markedProcessingThreads.has(operation.threadId))
      ) {
        markProcessing(operation.threadId, true);
        markedProcessingThreads?.add(operation.threadId);
      }

      if (operation.kind === "agentDelta") {
        const dispatchStartedAt = readHighResolutionNowMs();
        dispatch({
          type: "appendAgentDelta",
          workspaceId: operation.workspaceId,
          threadId: operation.threadId,
          itemId: operation.itemId,
          delta: operation.delta,
          hasCustomName: Boolean(getCustomName(operation.workspaceId, operation.threadId)),
        });
        const dispatchCostMs = readHighResolutionNowMs() - dispatchStartedAt;
        noteThreadReducerWorkMeasured(operation.threadId, {
          itemId: operation.itemId,
          textLength: operation.delta.length,
          mergeCostMs: dispatchCostMs,
          normalizationCostMs: dispatchCostMs,
        });
        return;
      }
      if (operation.kind === "reasoningSummaryDelta") {
        dispatch({
          type: "appendReasoningSummary",
          threadId: operation.threadId,
          itemId: operation.itemId,
          delta: operation.delta,
        });
        return;
      }
      if (operation.kind === "reasoningSummaryBoundary") {
        dispatch({
          type: "appendReasoningSummaryBoundary",
          threadId: operation.threadId,
          itemId: operation.itemId,
        });
        return;
      }
      if (operation.kind === "reasoningContentDelta") {
        dispatch({
          type: "appendReasoningContent",
          threadId: operation.threadId,
          itemId: operation.itemId,
          delta: operation.delta,
        });
        return;
      }

      dispatch({
        type: "appendToolOutput",
        threadId: operation.threadId,
        itemId: operation.itemId,
        delta: operation.delta,
      });
    },
    [
      dispatch,
      getCustomName,
      interruptedThreadsRef,
      isRealtimeTurnTerminal,
      markProcessing,
    ],
  );

  const flushRealtimeDeltaOps = useCallback(() => {
    if (!enableRealtimeBatchingRef.current) {
      return;
    }
    if (isFlushingRealtimeDeltaOpsRef.current) {
      return;
    }
    if (realtimeFlushTimerRef.current !== null) {
      window.clearTimeout(realtimeFlushTimerRef.current);
      realtimeFlushTimerRef.current = null;
    }
    if (pendingRealtimeDeltaOpsRef.current.length === 0) {
      return;
    }
    isFlushingRealtimeDeltaOpsRef.current = true;
    try {
      const bufferedOps = pendingRealtimeDeltaOpsRef.current;
      pendingRealtimeDeltaOpsRef.current = [];
      const ensuredThreads = new Set<string>();
      const markedProcessingThreads = new Set<string>();
      for (const operation of bufferedOps) {
        applyRealtimeDeltaOperation(operation, {
          ensuredThreads,
          markedProcessingThreads,
        });
      }
      safeMessageActivity();
    } finally {
      isFlushingRealtimeDeltaOpsRef.current = false;
    }
  }, [applyRealtimeDeltaOperation, safeMessageActivity]);

  const enqueueRealtimeDeltaOperation = useCallback(
    (operation: RealtimeDeltaOperation) => {
      if (!enableRealtimeBatchingRef.current) {
        applyRealtimeDeltaOperation(operation);
        safeMessageActivity();
        return;
      }
      pendingRealtimeDeltaOpsRef.current.push(operation);
      if (realtimeFlushTimerRef.current !== null) {
        return;
      }
      realtimeFlushTimerRef.current = window.setTimeout(() => {
        flushRealtimeDeltaOps();
      }, REALTIME_DELTA_BATCH_FLUSH_MS);
    },
    [applyRealtimeDeltaOperation, flushRealtimeDeltaOps, safeMessageActivity],
  );

  const dispatchNormalizedRealtimeEvent = useCallback(
    (
      normalizedEvent: NormalizedThreadEvent,
      hasCustomName: boolean,
      options: {
        ensuredThreads?: Set<string>;
        markedProcessingThreads?: Set<string>;
        useTransitionForDispatch?: boolean;
      } = {},
    ) => {
      const {
        ensuredThreads,
        markedProcessingThreads,
      } = options;
      const eventTurnId = extractTurnIdFromNormalizedRealtimeEvent(normalizedEvent);
      const isEventTurnTerminal = () =>
        isRealtimeTurnTerminal(normalizedEvent.threadId, eventTurnId);
      const shouldMarkProcessing = normalizedEvent.operation !== "itemCompleted";
      const markProcessingIfNeeded = () => {
        if (!shouldMarkProcessing) {
          return;
        }
        if (markedProcessingThreads?.has(normalizedEvent.threadId)) {
          return;
        }
        if (isEventTurnTerminal()) {
          return;
        }
        markProcessing(normalizedEvent.threadId, true);
        markedProcessingThreads?.add(normalizedEvent.threadId);
      };
      const run = (runOptions: { skipProcessingMark?: boolean } = {}) => {
        if (isEventTurnTerminal()) {
          return;
        }
        if (!ensuredThreads?.has(normalizedEvent.threadId)) {
          dispatch({
            type: "ensureThread",
            workspaceId: normalizedEvent.workspaceId,
            threadId: normalizedEvent.threadId,
            engine: normalizedEvent.engine,
          });
          ensuredThreads?.add(normalizedEvent.threadId);
        }
        if (!runOptions.skipProcessingMark) {
          markProcessingIfNeeded();
        }
        dispatch({
          type: "applyNormalizedRealtimeEvent",
          workspaceId: normalizedEvent.workspaceId,
          threadId: normalizedEvent.threadId,
          event: normalizedEvent,
          hasCustomName,
        });
        if (
          normalizedEvent.operation === "completeAgentMessage" &&
          normalizedEvent.item.kind === "message" &&
          normalizedEvent.item.role === "assistant"
        ) {
          const timestamp = Date.now();
          dispatch({
            type: "setThreadTimestamp",
            workspaceId: normalizedEvent.workspaceId,
            threadId: normalizedEvent.threadId,
            timestamp,
          });
          dispatch({
            type: "setLastAgentMessage",
            threadId: normalizedEvent.threadId,
            text: normalizedEvent.item.text,
            timestamp,
          });
          if (normalizedEvent.threadId !== activeThreadId) {
            dispatch({
              type: "markUnread",
              threadId: normalizedEvent.threadId,
              hasUnread: true,
            });
          }
          recordThreadActivity(
            normalizedEvent.workspaceId,
            normalizedEvent.threadId,
            timestamp,
          );
        }
      };
      if (options.useTransitionForDispatch === false) {
        run();
        return;
      }
      markProcessingIfNeeded();
      scheduleRealtimeDispatch(() => run({ skipProcessingMark: true }));
    },
    [
      activeThreadId,
      dispatch,
      isRealtimeTurnTerminal,
      markProcessing,
      recordThreadActivity,
      scheduleRealtimeDispatch,
    ],
  );

  const runNormalizedRealtimeEventSideEffects = useCallback(
    (
      normalizedEvent: NormalizedThreadEvent,
      options: {
        skipMessageActivity?: boolean;
      } = {},
    ) => {
      if (normalizedEvent.rawItem) {
        applyCollabThreadLinks(normalizedEvent.threadId, normalizedEvent.rawItem);
      }
      if (
        normalizedEvent.operation === "completeAgentMessage" &&
        normalizedEvent.item.kind === "message" &&
        normalizedEvent.item.role === "assistant"
      ) {
        onAgentMessageCompletedExternal?.({
          workspaceId: normalizedEvent.workspaceId,
          threadId: normalizedEvent.threadId,
          ...(normalizedEvent.turnId ? { turnId: normalizedEvent.turnId } : {}),
          itemId: normalizedEvent.item.id,
          text: normalizedEvent.item.text,
        });
      }
      if (!options.skipMessageActivity) {
        safeMessageActivity();
      }
    },
    [
      applyCollabThreadLinks,
      onAgentMessageCompletedExternal,
      safeMessageActivity,
    ],
  );

  const applyNormalizedRealtimeEventNow = useCallback(
    (
      operation: PendingNormalizedRealtimeOperation,
      options: {
        ensuredThreads?: Set<string>;
        markedProcessingThreads?: Set<string>;
        useTransitionForDispatch?: boolean;
        skipMessageActivity?: boolean;
      } = {},
    ) => {
      if (
        isRealtimeTurnTerminal(
          operation.event.threadId,
          extractTurnIdFromNormalizedRealtimeEvent(operation.event),
        )
      ) {
        return;
      }
      dispatchNormalizedRealtimeEvent(operation.event, operation.hasCustomName, {
        ensuredThreads: options.ensuredThreads,
        markedProcessingThreads: options.markedProcessingThreads,
        useTransitionForDispatch: options.useTransitionForDispatch,
      });
      runNormalizedRealtimeEventSideEffects(operation.event, {
        skipMessageActivity: options.skipMessageActivity,
      });
    },
    [
      dispatchNormalizedRealtimeEvent,
      isRealtimeTurnTerminal,
      runNormalizedRealtimeEventSideEffects,
    ],
  );

  const flushNormalizedRealtimeOps = useCallback(() => {
    if (isFlushingNormalizedRealtimeOpsRef.current) {
      return;
    }
    if (normalizedRealtimeFlushTimerRef.current !== null) {
      window.clearTimeout(normalizedRealtimeFlushTimerRef.current);
      normalizedRealtimeFlushTimerRef.current = null;
    }
    if (pendingNormalizedRealtimeOpsRef.current.size === 0) {
      return;
    }
    isFlushingNormalizedRealtimeOpsRef.current = true;
    try {
      const bufferedOps = Array.from(pendingNormalizedRealtimeOpsRef.current.values());
      pendingNormalizedRealtimeOpsRef.current.clear();
      const ensuredThreads = new Set<string>();
      const markedProcessingThreads = new Set<string>();
      for (const operation of bufferedOps) {
        applyNormalizedRealtimeEventNow(operation, {
          ensuredThreads,
          markedProcessingThreads,
          useTransitionForDispatch: false,
          skipMessageActivity: true,
        });
      }
      safeMessageActivity();
    } finally {
      isFlushingNormalizedRealtimeOpsRef.current = false;
    }
  }, [applyNormalizedRealtimeEventNow, safeMessageActivity]);

  const applyNormalizedRealtimeBatcherFlushes = useCallback(
    (
      flushes: readonly RealtimeBatcherFlush[],
      operation: PendingNormalizedRealtimeOperation,
    ) => {
      if (flushes.length === 0) {
        return;
      }
      flushNormalizedRealtimeOps();
      const ensuredThreads = new Set<string>();
      const markedProcessingThreads = new Set<string>();
      const flushEndedAt = Date.now();
      for (const flush of flushes) {
        // Reconstruct the batch wait window from event timestamps, but measure
        // actual route work separately so evidence does not treat long streams
        // as one giant route operation.
        let batchStart = flushEndedAt;
        for (const event of flush.events) {
          if (typeof event.timestampMs === "number" && event.timestampMs < batchStart) {
            batchStart = event.timestampMs;
          }
        }
        const routeStartedAt = Date.now();
        for (const event of flush.events) {
          const useTransitionForDispatch =
            flush.reason !== "terminal" &&
            !shouldDispatchNormalizedRealtimeEventUrgently(event, flush.reason);
          applyNormalizedRealtimeEventNow(
            {
              event,
              hasCustomName: operation.hasCustomName,
            },
            {
              ensuredThreads,
              markedProcessingThreads,
              useTransitionForDispatch,
              skipMessageActivity: false,
            },
          );
        }
        const routeEndedAt = Date.now();
        noteRealtimeCoalescedFlush({
          reason: flush.reason,
          eventCount: flush.events.length,
          engine: operation.event.engine,
          workspaceId: operation.event.workspaceId,
          threadId: operation.event.threadId,
          turnId: operation.event.turnId ?? null,
          itemKind: operation.event.itemKind,
          startedAt: batchStart,
          endedAt: flushEndedAt,
          routeStartedAt,
          routeEndedAt,
          queueDepthAfter: 0,
        });
      }
    },
    [applyNormalizedRealtimeEventNow, flushNormalizedRealtimeOps],
  );

  const enqueueNormalizedRealtimeEvent = useCallback(
    (operation: PendingNormalizedRealtimeOperation) => {
      if (!enableRealtimeBatchingRef.current) {
        applyNormalizedRealtimeEventNow(operation, {
          useTransitionForDispatch: false,
        });
        return;
      }
      if (
        isCodexAssistantMessageItem(operation.event.item) &&
        (operation.event.operation === "itemStarted" || operation.event.operation === "itemUpdated")
      ) {
        pendingNormalizedRealtimeOpsRef.current.set(
          buildPendingNormalizedRealtimeOperationKey(operation.event),
          operation,
        );
        if (normalizedRealtimeFlushTimerRef.current !== null) {
          return;
        }
        normalizedRealtimeFlushTimerRef.current = window.setTimeout(() => {
          flushNormalizedRealtimeOps();
        }, NORMALIZED_REALTIME_BATCH_FLUSH_MS);
        return;
      }
      const flushes = normalizedRealtimeBatcherRef.current.push(operation.event);
      if (flushes.some((flush) => flush.reason === "first-token")) {
        for (const flush of flushes) {
          for (const event of flush.events) {
            applyNormalizedRealtimeEventNow(
              {
                event,
                hasCustomName: operation.hasCustomName,
              },
              {
                useTransitionForDispatch: !shouldDispatchNormalizedRealtimeEventUrgently(
                  event,
                  flush.reason,
                ),
              },
            );
          }
        }
        return;
      }
      applyNormalizedRealtimeBatcherFlushes(flushes, operation);
      if (normalizedRealtimeFlushTimerRef.current !== null) {
        return;
      }
      normalizedRealtimeFlushTimerRef.current = window.setTimeout(() => {
        const flush = normalizedRealtimeBatcherRef.current.flush("cadence");
        if (flush) {
          applyNormalizedRealtimeBatcherFlushes([flush], operation);
        }
      }, NORMALIZED_REALTIME_BATCH_FLUSH_MS);
    },
    [
      applyNormalizedRealtimeBatcherFlushes,
      applyNormalizedRealtimeEventNow,
      flushNormalizedRealtimeOps,
    ],
  );

  useEffect(
    () => () => {
      flushRealtimeDeltaOps();
      flushNormalizedRealtimeOps();
      if (realtimeFlushTimerRef.current !== null) {
        window.clearTimeout(realtimeFlushTimerRef.current);
        realtimeFlushTimerRef.current = null;
      }
      if (normalizedRealtimeFlushTimerRef.current !== null) {
        window.clearTimeout(normalizedRealtimeFlushTimerRef.current);
        normalizedRealtimeFlushTimerRef.current = null;
      }
      pendingRealtimeDeltaOpsRef.current = [];
      pendingNormalizedRealtimeOpsRef.current.clear();
      activeRealtimeTurnIdByThreadRef.current.clear();
      terminalRealtimeTurnIdsByThreadRef.current.clear();
    },
    [flushNormalizedRealtimeOps, flushRealtimeDeltaOps],
  );

  const flushPendingRealtimeEvents = useCallback(() => {
    flushRealtimeDeltaOps();
    flushNormalizedRealtimeOps();
  }, [flushNormalizedRealtimeOps, flushRealtimeDeltaOps]);


  // \u00a76.3 / \u00a76.4: dispatch \u8c03\u5ea6\u4e0e\u4eea\u8868\u62ee\u53d6
  const submitScheduleInstrumentationRef = useRef({
    urgentDispatchCount: 0,
    transitionDispatchCount: 0,
    idleDispatchCount: 0,
    totalDispatchCostMs: 0,
    lastDispatchAtMs: 0,
  });

  const dispatchWithSchedule = useCallback(
    (
      action: ThreadAction,
      options: {
        isLiveRow?: boolean;
        isCritical?: boolean;
      } = {},
    ) => {
      const tier = readStreamingScheduleTier();
      const isLiveRow = options.isLiveRow ?? false;
      const isCritical = options.isCritical ?? false;
      const mode: DispatchSubmitMode = resolveDispatchSubmitMode({
        tier,
        isLiveRow,
        isHeavy: false,
        isCritical,
      });
      const startedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      // §6.4: instrumentation \u5728 submit-mode \u9009\u5b9a\u540e\u7acb\u5373\u8bb0\u5f55,
      // \u4e0d\u7b49 dispatch \u5b8c\u6210\u3002\u8fd9\u6837 test \u4ee5 act() \u540c\u6b65\u8c03\u7528\u540e\u7acb\u5373\u80fd\u770b\u5230
      // \u8ba1\u6570\u4e0a\u53b8\u3002
      const inst0 = submitScheduleInstrumentationRef.current;
      if (mode === "urgent") inst0.urgentDispatchCount += 1;
      else if (mode === "transition") inst0.transitionDispatchCount += 1;
      else inst0.idleDispatchCount += 1;
      const finalize = () => {
        const endedAt =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();
        inst0.totalDispatchCostMs += Math.max(0, endedAt - startedAt);
        inst0.lastDispatchAtMs = endedAt;
        dispatch(action);
      };
      if (mode === "urgent") {
        finalize();
        return;
      }
      if (mode === "transition") {
        startTransition(() => {
          finalize();
        });
        return;
      }
      // mode === "idle"
      if (
        typeof (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback ===
        "function"
      ) {
        (globalThis as unknown as {
          requestIdleCallback: (cb: () => void) => void;
        }).requestIdleCallback(() => {
          finalize();
        });
        return;
      }
      // fallback: setTimeout(0)
      globalThis.setTimeout(() => {
        finalize();
      }, 0);
    },
    [dispatch],
  );

  const __getSubmitScheduleInstrumentationForTests = useCallback(
    () => submitScheduleInstrumentationRef.current,
    [],
  );


  const handleItemUpdate = useCallback(
    (
      workspaceId: string,
      threadId: string,
      item: Record<string, unknown>,
      shouldMarkProcessing: boolean,
      shouldIncrementAgentSegment: boolean,
    ) => {
      if (isInterruptedThread(interruptedThreadsRef, workspaceId, threadId)) {
        return;
      }
      flushRealtimeDeltaOps();
      const turnId = extractTurnIdFromRawItem(item);
      if (isRealtimeTurnTerminal(threadId, turnId)) {
        return;
      }
      // \u00a76.3: \u5165\u53e3 ensureThread \u8d70 dispatchWithSchedule\u3002
      // baseline \u4e0e isLiveRow / isCritical \u90fd\u9000\u5316\u4e3a urgent\uff0c\u8bed\u4e49\u4e0e\u539f\u540c\u3002
      // \u4f4e\u4f18\u5148\u7ea7\u4f1a\u8bdd\uff08threadId !== activeThreadId\uff09+ guarded / aggressive \u8d70 transition / idle \u3002
      const isLiveRow = threadId === activeThreadId;
      dispatchWithSchedule(
        { type: "ensureThread", workspaceId, threadId, engine: inferEngineFromThreadId(threadId) },
        { isLiveRow, isCritical: false },
      );
      const itemType = asString(item?.type ?? "");
      const itemId = asString(item?.id ?? "");
      const itemEngineSource = inferItemEngineSource(item, threadId);
      const shouldSuppressGeminiReasoningProcessing =
        itemType === "reasoning" && itemEngineSource === "gemini";
      if (shouldMarkProcessing && !shouldSuppressGeminiReasoningProcessing) {
        markProcessing(threadId, true);
      }
      applyCollabThreadLinks(threadId, item);
      const agentMessageSnapshotText = asString(
        item?.text ?? item?.content ?? item?.output_text ?? item?.outputText ?? "",
      );
      if (
        itemType === "agentMessage" ||
        itemType === "reasoning"
      ) {
        logClaudeStream("item-snapshot", {
          workspaceId,
          threadId,
          itemId,
          itemType,
          deltaLength: agentMessageSnapshotText.length,
          textPreview: createDebugPreview(agentMessageSnapshotText),
        });
      }
      if (itemType === "enteredReviewMode") {
        markReviewing(threadId, true);
      } else if (itemType === "exitedReviewMode") {
        markReviewing(threadId, false);
        markProcessing(threadId, false);
      }

      // 当 tool item 开始时，增加分段计数，确保后续文本创建新的 message
      // 这样可以实现文本和工具调用交替显示
      const isToolItem = [
        "commandExecution",
        "fileChange",
        "mcpToolCall",
        "collabToolCall",
        "collabAgentToolCall",
        "webSearch",
        "imageView",
        "generatedImage",
        "generated_image",
        "image_generation_call",
        "image_generation_end",
      ].includes(itemType);
      if (shouldMarkProcessing && shouldIncrementAgentSegment && isToolItem) {
        dispatch({ type: "incrementAgentSegment", threadId });
      }

      if (itemType === "agentMessage") {
        if (agentMessageSnapshotText) {
          upsertLiveAssistantShadowSnapshot({
            engine: inferEngineFromThreadId(threadId),
            workspaceId,
            threadId,
            itemId,
            text: agentMessageSnapshotText,
            turnId,
          });
          const dispatchStartedAt = readHighResolutionNowMs();
          dispatch({
            type: "appendAgentDelta",
            workspaceId,
            threadId,
            itemId,
            delta: agentMessageSnapshotText,
            hasCustomName: Boolean(getCustomName(workspaceId, threadId)),
          });
          const dispatchCostMs = readHighResolutionNowMs() - dispatchStartedAt;
          noteThreadReducerWorkMeasured(threadId, {
            itemId,
            textLength: agentMessageSnapshotText.length,
            mergeCostMs: dispatchCostMs,
            normalizationCostMs: dispatchCostMs,
          });
          logClaudeStream("agent-snapshot-routed", {
            workspaceId,
            threadId,
            itemId,
            itemType,
            deltaLength: agentMessageSnapshotText.length,
            textPreview: createDebugPreview(agentMessageSnapshotText),
          });
        }
        safeMessageActivity();
        return;
      }

      const converted = buildConversationItem(item);
      if (converted) {
        const itemEngineSource = asString(
          item.engineSource ?? item.engine_source ?? "",
        )
          .trim()
          .toLowerCase();
        const normalizedConverted =
          itemEngineSource === "claude" ||
          itemEngineSource === "gemini" ||
          itemEngineSource === "opencode" ||
          itemEngineSource === "codex"
            ? {
                ...converted,
                engineSource: itemEngineSource as "claude" | "codex" | "gemini" | "opencode",
              }
            : converted;
        const threadEngine = inferEngineFromThreadId(threadId);
        // Claude reasoning should converge to the persisted history shape.
        // Accept snapshot items so final/live state can be enriched by the
        // server snapshot instead of staying delta-only.
        if (threadEngine === "claude" && normalizedConverted.kind === "reasoning") {
          logReasoningRoute("reasoning-snapshot-accepted", {
            workspaceId,
            threadId,
            itemId: normalizedConverted.id,
            skipped: false,
            reason: "claude-snapshot-enriches-live-state",
          });
          logClaudeStream("reasoning-snapshot-upsert", {
            workspaceId,
            threadId,
            itemId: normalizedConverted.id,
            itemType,
            deltaLength: `${normalizedConverted.summary}${normalizedConverted.content}`.length,
            textPreview: createDebugPreview(
              normalizedConverted.content || normalizedConverted.summary || "",
            ),
          });
        }
        const normalizedItem =
          normalizedConverted.kind === "message" &&
          normalizedConverted.role === "user" &&
          !normalizedConverted.collaborationMode
            ? {
                ...normalizedConverted,
                collaborationMode: resolveCollaborationUiMode?.(threadId) ?? null,
              }
            : normalizedConverted;
        dispatch({
          type: "upsertItem",
          workspaceId,
          threadId,
          item: normalizedItem,
          hasCustomName: Boolean(getCustomName(workspaceId, threadId)),
        });
        if (
          !shouldMarkProcessing &&
          inferEngineFromThreadId(threadId) === "claude" &&
          normalizedItem.kind === "tool" &&
          isClaudeExitPlanModeTool(normalizedItem)
        ) {
          onExitPlanModeToolCompleted?.({
            workspaceId,
            threadId,
            itemId: normalizedItem.id,
          });
        }
      }
      safeMessageActivity();
    },
    [
      activeThreadId,
      applyCollabThreadLinks,
      dispatch,
      dispatchWithSchedule,
      flushRealtimeDeltaOps,
      getCustomName,
      interruptedThreadsRef,
      isRealtimeTurnTerminal,
      isClaudeExitPlanModeTool,
      logClaudeStream,
      logReasoningRoute,
      markProcessing,
      markReviewing,
      onExitPlanModeToolCompleted,
      resolveCollaborationUiMode,
      safeMessageActivity,
    ],
  );

  // 2026-06-24-harden-realtime-interaction-jank-during-tool-call §5.2
  // Tool output tail gate. Coalesces per-item deltas at 32ms (or 16ms in
  // aggressive tier) and caps the per-key buffer at 1 MiB. The flush
  // handler enqueues a single `toolOutputDelta` op into the existing
  // realtime delta queue, preserving the contract with
  // `applyRealtimeDeltaOperation`. The gate can be disabled at runtime
  // via `localStorage.setItem("ccgui.perf.toolOutputTailGate", "off")`,
  // in which case the flush handler is invoked synchronously per submit.
  const toolOutputMetadataRef = useRef(
    new Map<ToolOutputKey, { threadId: string; turnId: string | null }>(),
  );

  const toolOutputTailGate = useMemo(
    () =>
      createToolOutputTailGate({
        onEntryEvicted: (key) => {
          toolOutputMetadataRef.current.delete(key);
        },
        flushHandler: (key, fullText) => {
          // Re-decompose the key into the original tuple. The gate is
          // append-only, so we forward the merged text as a single delta.
          // The reducer is idempotent for repeated text appends.
          const [workspaceId, itemId] = key.split("\0") as [
            string,
            string,
            string,
          ];
          const metadata = toolOutputMetadataRef.current.get(key);
          const threadId = metadata?.threadId ?? "";
          if (!workspaceId || !threadId || !itemId) return;
          enqueueRealtimeDeltaOperation({
            kind: "toolOutputDelta",
            workspaceId,
            threadId,
            itemId,
            delta: fullText,
            turnId: metadata?.turnId ?? null,
          });
        },
      }),
    [enqueueRealtimeDeltaOperation],
  );

  // Flush the tool output gate on item completion / turn completion so the
  // user sees the final tail before the next reducer turn kicks in.
  useEffect(() => {
    return () => {
      // Drain on unmount so any buffered deltas land before the hook is
      // torn down. Tests can call __flushAllForTests synchronously.
      toolOutputTailGate.flushAll();
    };
  }, [toolOutputTailGate]);

  const handleToolOutputDelta = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      kind: "commandExecution" | "fileChange",
      turnId?: string | null,
    ) => {
      // 2026-06-24-harden-realtime-interaction-jank-during-tool-call §5.2
      // Forward the delta into the tail gate instead of the realtime delta
      // queue directly. The gate coalesces and forwards the merged text
      // to `enqueueRealtimeDeltaOperation` at its 32ms cadence.
      const key = buildToolOutputKey(workspaceId, itemId, kind);
      toolOutputMetadataRef.current.set(key, {
        threadId,
        turnId: turnId ?? null,
      });
      toolOutputTailGate.submit(key, delta);
    },
    [toolOutputTailGate],
  );

  const flushToolOutputForItem = useCallback(
    (workspaceId: string, itemId: string) => {
      for (const kind of ["commandExecution", "fileChange"] as const) {
        const key = buildToolOutputKey(workspaceId, itemId, kind);
        toolOutputTailGate.flush(key);
        toolOutputTailGate.reset(key);
        toolOutputMetadataRef.current.delete(key);
      }
    },
    [toolOutputTailGate],
  );

  const handleTerminalInteraction = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      stdin: string,
      turnId?: string | null,
    ) => {
      if (!stdin) {
        return;
      }
      const normalized = stdin.replace(/\r\n/g, "\n");
      const suffix = normalized.endsWith("\n") ? "" : "\n";
      handleToolOutputDelta(
        workspaceId,
        threadId,
        itemId,
        `\n[stdin]\n${normalized}${suffix}`,
        "commandExecution",
        turnId,
      );
    },
    [handleToolOutputDelta],
  );
  const onAgentMessageDelta = useCallback(
    ({
      workspaceId,
      threadId,
      itemId,
      delta,
      turnId,
    }: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      turnId?: string | null;
    }) => {
      // Skip late-arriving deltas for threads that have been interrupted
      if (isInterruptedThread(interruptedThreadsRef, workspaceId, threadId)) {
        logClaudeStream("agent-delta-skipped", {
          workspaceId,
          threadId,
          itemId,
          deltaLength: delta.length,
          textPreview: createDebugPreview(delta),
          skipped: true,
          reason: "interrupted-thread",
        });
        return;
      }
      const resolvedDelta = applyPendingClaudeMcpOutputNoticeToAgentDelta(
        workspaceId,
        threadId,
        delta,
      );
      appendLiveAssistantShadowDelta({
        engine: inferEngineFromThreadId(threadId),
        workspaceId,
        threadId,
        itemId,
        delta: resolvedDelta,
        turnId,
      });
      enqueueRealtimeDeltaOperation({
        kind: "agentDelta",
        workspaceId,
        threadId,
        itemId,
        delta: resolvedDelta,
        turnId,
      });
      logClaudeStream("agent-delta", {
        workspaceId,
        threadId,
        itemId,
        deltaLength: resolvedDelta.length,
        textPreview: createDebugPreview(resolvedDelta),
      });
    },
    [
      enqueueRealtimeDeltaOperation,
      interruptedThreadsRef,
      logClaudeStream,
    ],
  );

  const onAgentMessageCompleted = useCallback(
    ({
      workspaceId,
      threadId,
      itemId,
      text,
      turnId,
    }: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      text: string;
      turnId?: string | null;
    }) => {
      if (isInterruptedThread(interruptedThreadsRef, workspaceId, threadId)) {
        return;
      }
      const resolvedText = applyPendingClaudeMcpOutputNoticeToAgentCompleted(
        workspaceId,
        threadId,
        text,
      );
      settleLiveAssistantShadowTranscript({
        engine: inferEngineFromThreadId(threadId),
        workspaceId,
        threadId,
        itemId,
        text: resolvedText,
        turnId,
        providerFinalObserved: true,
      });
      flushRealtimeDeltaOps();
      if (isRealtimeTurnTerminal(threadId, turnId)) {
        return;
      }
      const timestamp = Date.now();
      // \u00a76.2: \u4fdd\u8bc1\u4e0a\u4e0b\u6587\u5148 ensureThread (\u539f\u987a\u5e8f)
      dispatch({ type: "ensureThread", workspaceId, threadId, engine: inferEngineFromThreadId(threadId) });
      const hasCustomName = Boolean(getCustomName(workspaceId, threadId));
      // \u00a76.2: \u4e00\u6b21\u6027\u5408\u5e76 completeAgentMessage + setThreadTimestamp +
      // setLastAgentMessage + (\u6761\u4ef6) markUnread\uff0c\u51cf\u5c11 reducer \u8c03\u5ea6\u6b21\u6570\u3002
      dispatch({
        type: "flushAgentCompletedBatch",
        workspaceId,
        threadId,
        itemId,
        text: resolvedText,
        hasCustomName,
        timestamp,
        isActiveThread: threadId === activeThreadId,
      });
      recordThreadActivity(workspaceId, threadId, timestamp);
      safeMessageActivity();
      onAgentMessageCompletedExternal?.({
        workspaceId,
        threadId,
        ...(turnId ? { turnId } : {}),
        itemId,
        text: resolvedText,
      });
      logClaudeStream("agent-completed", {
        workspaceId,
        threadId,
        itemId,
        deltaLength: resolvedText.length,
        textPreview: createDebugPreview(resolvedText),
      });
    },
    [
      activeThreadId,
      dispatch,
      flushRealtimeDeltaOps,
      getCustomName,
      logClaudeStream,
      onAgentMessageCompletedExternal,
      recordThreadActivity,
      safeMessageActivity,
      interruptedThreadsRef,
      isRealtimeTurnTerminal,
    ],
  );

  const onItemStarted = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      handleItemUpdate(workspaceId, threadId, item, true, true);
    },
    [handleItemUpdate],
  );

  const onItemUpdated = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      handleItemUpdate(workspaceId, threadId, item, true, false);
    },
    [handleItemUpdate],
  );

  const onItemCompleted = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      const itemId = asString(item.id ?? "");
      if (itemId) {
        flushToolOutputForItem(workspaceId, itemId);
      }
      handleItemUpdate(workspaceId, threadId, item, false, false);
    },
    [flushToolOutputForItem, handleItemUpdate],
  );

  const onReasoningSummaryDelta = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      engineHint?: ReasoningEngineHint,
      turnId?: string | null,
    ) => {
      logReasoningRoute("reasoning-summary-delta", {
        workspaceId,
        threadId,
        itemId,
        deltaLength: delta.length,
      });
      if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        logClaudeStream("reasoning-summary-delta-skipped", {
          workspaceId,
          threadId,
          itemId,
          deltaLength: delta.length,
          textPreview: createDebugPreview(delta),
          skipped: true,
          reason: "interrupted-thread",
        });
        return;
      }
      enqueueRealtimeDeltaOperation({
        kind: "reasoningSummaryDelta",
        workspaceId,
        threadId,
        itemId,
        delta,
        engineHint,
        turnId,
      });
      logClaudeStream("reasoning-summary-delta", {
        workspaceId,
        threadId,
        itemId,
        deltaLength: delta.length,
        textPreview: createDebugPreview(delta),
      });
    },
    [enqueueRealtimeDeltaOperation, interruptedThreadsRef, logClaudeStream, logReasoningRoute],
  );

  const onReasoningSummaryBoundary = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      engineHint?: ReasoningEngineHint,
      turnId?: string | null,
    ) => {
      logReasoningRoute("reasoning-summary-boundary", {
        workspaceId,
        threadId,
        itemId,
      });
      if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        logClaudeStream("reasoning-summary-boundary-skipped", {
          workspaceId,
          threadId,
          itemId,
          skipped: true,
          reason: "interrupted-thread",
        });
        return;
      }
      enqueueRealtimeDeltaOperation({
        kind: "reasoningSummaryBoundary",
        workspaceId,
        threadId,
        itemId,
        engineHint,
        turnId,
      });
      logClaudeStream("reasoning-summary-boundary", {
        workspaceId,
        threadId,
        itemId,
      });
    },
    [enqueueRealtimeDeltaOperation, interruptedThreadsRef, logClaudeStream, logReasoningRoute],
  );

  const onReasoningTextDelta = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      engineHint?: ReasoningEngineHint,
      turnId?: string | null,
    ) => {
      logReasoningRoute("reasoning-text-delta", {
        workspaceId,
        threadId,
        itemId,
        deltaLength: delta.length,
      });
      if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        logClaudeStream("reasoning-text-delta-skipped", {
          workspaceId,
          threadId,
          itemId,
          deltaLength: delta.length,
          textPreview: createDebugPreview(delta),
          skipped: true,
          reason: "interrupted-thread",
        });
        return;
      }
      enqueueRealtimeDeltaOperation({
        kind: "reasoningContentDelta",
        workspaceId,
        threadId,
        itemId,
        delta,
        engineHint,
        turnId,
      });
      logClaudeStream("reasoning-text-delta", {
        workspaceId,
        threadId,
        itemId,
        deltaLength: delta.length,
        textPreview: createDebugPreview(delta),
      });
    },
    [enqueueRealtimeDeltaOperation, interruptedThreadsRef, logClaudeStream, logReasoningRoute],
  );

  const onCommandOutputDelta = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      turnId?: string | null,
    ) => {
      handleToolOutputDelta(
        workspaceId,
        threadId,
        itemId,
        delta,
        "commandExecution",
        turnId,
      );
    },
    [handleToolOutputDelta],
  );

  const onTerminalInteraction = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      stdin: string,
      turnId?: string | null,
    ) => {
      handleTerminalInteraction(workspaceId, threadId, itemId, stdin, turnId);
    },
    [handleTerminalInteraction],
  );

  const onFileChangeOutputDelta = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      turnId?: string | null,
    ) => {
      handleToolOutputDelta(
        workspaceId,
        threadId,
        itemId,
        delta,
        "fileChange",
        turnId,
      );
    },
    [handleToolOutputDelta],
  );

  const onNormalizedRealtimeEvent = useCallback(
    (event: NormalizedThreadEvent) => {
      const { workspaceId, threadId } = event;
      if (isInterruptedThread(interruptedThreadsRef, workspaceId, threadId)) {
        return;
      }
      const hasCustomName = Boolean(getCustomName(workspaceId, threadId));
      const normalizedItem =
        event.item.kind === "message" &&
        event.item.role === "user" &&
        !event.item.collaborationMode
          ? {
              ...event.item,
              collaborationMode: resolveCollaborationUiMode?.(threadId) ?? null,
            }
          : event.item;
      const normalizedEvent =
        normalizedItem === event.item
          ? event
          : {
              ...event,
              item: normalizedItem,
            };
      const operation = {
        event: normalizedEvent,
        hasCustomName,
      } satisfies PendingNormalizedRealtimeOperation;
      if (
        shouldBatchNormalizedRealtimeEvent(normalizedEvent) ||
        (enableRealtimeBatchingRef.current && shouldUseContractRealtimeBatcher(normalizedEvent))
      ) {
        enqueueNormalizedRealtimeEvent(operation);
        return;
      }
      flushNormalizedRealtimeOps();
      applyNormalizedRealtimeEventNow(operation, {
        useTransitionForDispatch: normalizedEvent.operation !== "completeAgentMessage",
      });
    },
    [
      applyNormalizedRealtimeEventNow,
      enqueueNormalizedRealtimeEvent,
      flushNormalizedRealtimeOps,
      getCustomName,
      interruptedThreadsRef,
      resolveCollaborationUiMode,
    ],
  );

  return {
    onAgentMessageDelta,
    onAgentMessageCompleted,
    onItemStarted,
    onItemUpdated,
    onItemCompleted,
    onNormalizedRealtimeEvent,
    onReasoningSummaryDelta,
    onReasoningSummaryBoundary,
    onReasoningTextDelta,
    onCommandOutputDelta,
    onTerminalInteraction,
    onFileChangeOutputDelta,
    // §6.4: instrumentation test surface
    __getSubmitScheduleInstrumentationForTests,
    flushPendingRealtimeEvents,
    isRealtimeTurnTerminalExact,
    noteRealtimeTurnStarted,
    markRealtimeTurnTerminal,
  };
}
