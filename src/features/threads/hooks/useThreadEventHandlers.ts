import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  workspaceScopedDelete,
  workspaceScopedHas,
} from "./workspaceScopedMap";
import type {
  AppServerEvent,
  CollaborationModeBlockedRequest,
  CollaborationModeResolvedRequest,
  RequestUserInputRequest,
  TurnReconciliationRuntimeStatus,
} from "../../../types";
import { useThreadApprovalEvents } from "./useThreadApprovalEvents";
import { useThreadItemEvents } from "./useThreadItemEvents";
import { useThreadTurnEvents } from "./useThreadTurnEvents";
import { queryTurnReconciliationStatusWithTimeout } from "./threadReconciliationStatusQuery";
import { useThreadUserInputEvents } from "./useThreadUserInputEvents";
import { parseFirstPacketTimeoutSeconds } from "../utils/networkErrors";
import { buildThreadDebugCorrelation } from "../utils/threadDebugCorrelation";
import type {
  ConversationEngine,
  NormalizedThreadEvent,
} from "../contracts/conversationCurtainContracts";
import {
  buildThreadStreamCorrelationDimensions,
  completeThreadStreamTurn,
  noteThreadDeltaReceived,
  noteThreadTextIngressReceived,
  noteThreadTurnStarted,
  reportThreadUpstreamPending,
  type StreamIngressSource,
} from "../utils/streamLatencyDiagnostics";
import { buildCodexLivenessDiagnostic } from "../utils/codexConversationLiveness";
import {
  DEFAULT_TURN_SETTLEMENT_POLICY,
  evaluateTurnSettlement,
  toDryRunSettlementDecisionLabel,
  type TurnSettlementTerminalKind,
} from "../utils/turnSettlementDecision";
import { domainEventFactories } from "../domain-events";
import type { ThreadEventHandlersOptions } from "./threadEventHandlerTypes";
import { handleThreadAppServerEventDiagnostics } from "./threadAppServerEventDiagnostics";
import {
  TURN_FIRST_DELTA_WARNING_MS,
  TURN_STALL_WARNING_MS,
  applyActiveExecutionItemEvent,
  asString,
  buildAssistantSnapshotIngressKey,
  buildCodexTurnIdentityKey,
  cleanupThreadTransientState,
  createThreadLifecycleSnapshot,
  createTurnDiagnosticState,
  extractTurnIdFromRawItem,
  getCodexNoProgressTimeoutMs,
  sweepThreadTransientState,
  TRANSIENT_TURN_STATE_SWEEP_INTERVAL_MS,
  inferRawItemEngine,
  inferThreadEngine,
  isExecutionItemType,
  isRequestUserInputModeBlocked,
  isTurnDiagnosticVerboseEnabled,
  listActiveExecutionItemTypes,
  listDeferredCompletionBlockers,
  resolveAgentMessageSnapshotText,
  type CodexQuarantinedTurn,
  type DeferredCompletionFlushSource,
  type ThreadLifecycleSnapshot,
  type TurnDiagnosticState,
} from "./threadEventDiagnostics";
export { CODEX_EXECUTION_ACTIVE_NO_PROGRESS_STALL_MS, CODEX_TURN_NO_PROGRESS_STALL_MS } from "./threadEventDiagnostics";
export function useThreadEventHandlers({
  activeThreadId,
  dispatch,
  getCustomName,
  resolveCanonicalThreadId,
  resolveCollaborationUiMode,
  isAutoTitlePending,
  isThreadHidden,
  markProcessing,
  markReviewing,
  setActiveTurnId,
  codexCompactionInFlightByThreadRef,
  safeMessageActivity,
  recordThreadActivity,
  pushThreadErrorMessage,
  onDebug,
  onWorkspaceConnected,
  applyCollabThreadLinks,
  approvalAllowlistRef,
  pendingInterruptsRef,
  interruptedThreadsRef,
  renameCustomNameKey,
  renameAutoTitlePendingKey,
  renameThreadTitleMapping,
  resolveClaudeContinuationThreadId,
  resolvePendingThreadForSession,
  resolvePendingThreadForTurn,
  getActiveTurnIdForThread,
  renamePendingMemoryCaptureKey,
  onAgentMessageCompletedExternal,
  onTurnCompletedExternal,
  onTurnTerminalExternal,
  onThreadTransientCleanupReady,
  onCollaborationModeResolved,
  onExitPlanModeToolCompleted,
  domainEventController = null,
}: ThreadEventHandlersOptions) {
  const threadLifecycleSnapshotRef = useRef<Map<string, ThreadLifecycleSnapshot>>(new Map());
  const turnDiagnosticsRef = useRef<Map<string, TurnDiagnosticState>>(new Map());
  const turnFirstDeltaTimerRef = useRef<Map<string, number>>(new Map());
  const turnStallTimerRef = useRef<Map<string, number>>(new Map());
  const codexNoProgressTimerRef = useRef<Map<string, number>>(new Map());
  const reconciliationQueryInFlightRef = useRef<Set<string>>(new Set());
  const flushDeferredTurnCompletionRef = useRef<
    ((threadId: string, source: DeferredCompletionFlushSource) => void) | null
  >(null);
  const assistantSnapshotIngressLengthRef = useRef<Map<string, number>>(new Map());
  const quarantinedCodexTurnsRef = useRef<Map<string, CodexQuarantinedTurn>>(new Map());
  const cleanupThreadTransientRefs = useCallback(
    (workspaceId: string | null | undefined, threadId: string) =>
      cleanupThreadTransientState(
        {
          turnDiagnosticsRef,
          quarantinedCodexTurnsRef,
          assistantSnapshotIngressLengthRef,
        },
        workspaceId,
        threadId,
      ),
    [],
  );
  useEffect(() => {
    return onThreadTransientCleanupReady?.(cleanupThreadTransientRefs);
  }, [cleanupThreadTransientRefs, onThreadTransientCleanupReady]);
  const getThreadLifecycleSnapshot = useCallback((threadId: string) => {
    return (
      threadLifecycleSnapshotRef.current.get(threadId) ?? createThreadLifecycleSnapshot()
    );
  }, []);
  const emitTurnDiagnostic = useCallback(
    (
      label: string,
      payload: Record<string, unknown>,
      options?: { force?: boolean },
    ) => {
      if (!options?.force && !isTurnDiagnosticVerboseEnabled()) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-turn-diagnostic-${label}`,
        timestamp: Date.now(),
        source: "event",
        label: `thread/session:turn-diagnostic:${label}`,
        payload: buildThreadDebugCorrelation(
          {
            workspaceId:
              typeof payload.workspaceId === "string" ? payload.workspaceId : null,
            threadId:
              typeof payload.threadId === "string" ? payload.threadId : null,
            action: `turn-diagnostic:${label}`,
            diagnosticCategory:
              typeof payload.diagnosticCategory === "string"
                ? payload.diagnosticCategory
                : null,
          },
          payload,
        ),
      });
    },
    [onDebug],
  );
  const emitForegroundSettlementDiagnostic = useCallback(
    (label: string, payload: Record<string, unknown>) => {
      emitTurnDiagnostic(label, {
        diagnosticCategory: "foreground-terminal-settlement",
        ...payload,
      }, { force: true });
    },
    [emitTurnDiagnostic],
  );
  const buildReconciliationQueryKey = useCallback(
    (input: {
      workspaceId: string;
      engine: ConversationEngine;
      threadId: string;
      turnId: string | null;
      runtimeSessionId: string | null;
      runtimeLeaseId: string | null;
    }) => {
      return [
        input.workspaceId,
        input.engine,
        input.threadId,
        input.turnId ?? "",
        input.runtimeSessionId ?? "",
        input.runtimeLeaseId ?? "",
      ].join("\u0000");
    },
    [],
  );
  const terminalKindFromReconciliationStatus = useCallback(
    (status: TurnReconciliationRuntimeStatus): TurnSettlementTerminalKind | null => {
      switch (status) {
        case "completed":
          return "status-confirmed-completed";
        case "failed":
          return "status-confirmed-error";
        case "stalled":
          return "stalled";
        case "runtime-ended":
          return "runtime-ended";
        case "running":
        case "unknown":
        case "query-failed":
          return null;
      }
    },
    [],
  );
  const settleForegroundTurnResidue = useCallback(
    (input: {
      workspaceId: string;
      threadId: string;
      turnId: string | null;
      engine: ConversationEngine;
      lifecycle: ThreadLifecycleSnapshot;
      source: "three-evidence-query-skipped" | "three-evidence-query-resolved" | "watchdog-interrupted";
      decisionAction: string;
      decisionReason: string;
      scopeMatch: Record<string, unknown>;
      acceptedEvidence: Record<string, unknown>;
      boundedReason: string | null;
      status?: TurnReconciliationRuntimeStatus | null;
      statusSource?: string | null;
      lastProgressAgeMs?: number | null;
      allowAbandonedActiveTurn?: boolean;
    }) => {
      const activeTurnId = input.lifecycle.activeTurnId;
      const turnMatches =
        activeTurnId === input.turnId ||
        (input.allowAbandonedActiveTurn === true && activeTurnId === null);
      const scopeMatched = input.scopeMatch.matched === true;
      const engineMatched = input.scopeMatch.engine !== false;
      const terminalAccepted = input.acceptedEvidence.terminal === true;
      const stateAccepted = input.acceptedEvidence.state === true;
      const cleanupAllowed =
        input.decisionAction === "cleanup-residue" &&
        input.lifecycle.isProcessing &&
        turnMatches &&
        engineMatched &&
        (input.source === "watchdog-interrupted" ||
          (scopeMatched && terminalAccepted && stateAccepted));

      if (!cleanupAllowed) {
        emitTurnDiagnostic("three-evidence-reconciliation-cleanup-skipped", {
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          turnId: input.turnId,
          engine: input.engine,
          diagnosticCategory: "three-evidence-reconciliation",
          cleanupSource: input.source,
          skipReason: !input.lifecycle.isProcessing
            ? "not-processing"
            : !turnMatches
              ? "active-turn-mismatch"
              : !engineMatched
                ? "engine-mismatch"
              : input.decisionAction !== "cleanup-residue"
                ? "decision-not-cleanup-residue"
                : input.source !== "watchdog-interrupted" && !scopeMatched
                  ? "scope-mismatch"
                  : input.source !== "watchdog-interrupted" &&
                      (!terminalAccepted || !stateAccepted)
                    ? "evidence-not-accepted"
                    : "guard-rejected",
          status: input.status ?? null,
          statusSource: input.statusSource ?? null,
          decisionAction: input.decisionAction,
          decisionReason: input.decisionReason,
          scopeMatch: input.scopeMatch,
          acceptedEvidence: input.acceptedEvidence,
          boundedReason: input.boundedReason,
          lastProgressAgeMs: input.lastProgressAgeMs ?? null,
          isProcessing: input.lifecycle.isProcessing,
          activeTurnId,
          activeThreadId,
        }, { force: true });
        return false;
      }

      threadLifecycleSnapshotRef.current.set(input.threadId, {
        ...input.lifecycle,
        isProcessing: false,
        activeTurnId: null,
      });
      dispatch({ type: "clearCodexSilentSuspected", threadId: input.threadId });
      markProcessing(input.threadId, false);
      setActiveTurnId(input.threadId, null);
      emitTurnDiagnostic("three-evidence-reconciliation-cleanup-applied", {
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        turnId: input.turnId,
        engine: input.engine,
        diagnosticCategory: "three-evidence-reconciliation",
        cleanupSource: input.source,
        status: input.status ?? null,
        statusSource: input.statusSource ?? null,
        decisionAction: input.decisionAction,
        decisionReason: input.decisionReason,
        scopeMatch: input.scopeMatch,
        acceptedEvidence: input.acceptedEvidence,
        boundedReason: input.boundedReason,
        lastProgressAgeMs: input.lastProgressAgeMs ?? null,
        wasProcessing: input.lifecycle.isProcessing,
        previousActiveTurnId: activeTurnId,
        clearedProcessing: true,
        clearedActiveTurn: activeTurnId !== null,
        activeThreadId,
      }, { force: true });
      return true;
    },
    [activeThreadId, dispatch, emitTurnDiagnostic, markProcessing, setActiveTurnId],
  );
  const emitThreeEvidenceDryRunDiagnostic = useCallback(
    (input: {
      workspaceId: string;
      threadId: string;
      turnId: string;
      terminalKind: TurnSettlementTerminalKind | null;
      sourceMethod: string | null;
      lifecycle: ThreadLifecycleSnapshot;
      diagnostic: TurnDiagnosticState | undefined;
      handled: boolean;
      fallbackApplied: boolean;
    }) => {
      if (activeThreadId !== null && activeThreadId !== input.threadId) {
        return;
      }
      const now = Date.now();
      const progressFreshWindowMs = input.diagnostic
        ? getCodexNoProgressTimeoutMs(input.diagnostic)
        : DEFAULT_TURN_SETTLEMENT_POLICY.progressFreshWindowMs;
      const lastProgressAgeMs = input.diagnostic
        ? Math.max(0, now - input.diagnostic.lastProgressAt)
        : null;
      const engine = inferThreadEngine(input.threadId);
      const decision = evaluateTurnSettlement(
        {
          workspaceId: input.workspaceId,
          engine,
          threadId: input.threadId,
          turnId: input.turnId || null,
          runtimeSessionId: null,
          runtimeLeaseId: null,
          source: "event",
          scope: {
            foreground: true,
            currentWorkspaceId: input.workspaceId,
            currentEngine: engine,
            currentThreadId: input.threadId,
            currentTurnId: input.lifecycle.activeTurnId,
            currentRuntimeLeaseId: null,
          },
          terminal: {
            kind: input.terminalKind,
            sourceMethod: input.sourceMethod,
            receivedAtMs: input.terminalKind ? now : null,
          },
          state: {
            isProcessing: input.lifecycle.isProcessing,
            activeTurnId: input.lifecycle.activeTurnId,
            aliasTurnId: null,
            blockers: [],
          },
          progress: {
            lastSource: input.diagnostic?.lastProgressSource ?? null,
            lastAtMs: input.diagnostic?.lastProgressAt ?? null,
            ageMs: lastProgressAgeMs,
            sequence: input.diagnostic?.progressSequence ?? 0,
            fresh:
              lastProgressAgeMs !== null &&
              lastProgressAgeMs < progressFreshWindowMs,
          },
        },
        {
          ...DEFAULT_TURN_SETTLEMENT_POLICY,
          progressFreshWindowMs,
        },
        now,
      );
      emitTurnDiagnostic("three-evidence-dry-run", {
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        turnId: input.turnId,
        diagnosticCategory: "three-evidence-settlement-dry-run",
        dryRunDecision: toDryRunSettlementDecisionLabel(decision.action),
        decisionAction: decision.action,
        decisionReason: decision.reason,
        scopeMatch: decision.scopeMatch,
        acceptedEvidence: decision.acceptedEvidence,
        boundedReason: decision.diagnostics.boundedReason,
        missingScope: decision.diagnostics.missingScope ?? [],
        staleEvidence: Boolean(decision.diagnostics.staleEvidence),
        residue: Boolean(decision.diagnostics.residue),
        handled: input.handled,
        fallbackApplied: input.fallbackApplied,
        isProcessing: input.lifecycle.isProcessing,
        activeTurnId: input.lifecycle.activeTurnId,
        lastProgressSource: input.diagnostic?.lastProgressSource ?? null,
        lastProgressAgeMs,
        progressSequence: input.diagnostic?.progressSequence ?? null,
        activeThreadId,
        ...buildThreadStreamCorrelationDimensions(input.threadId),
      }, { force: decision.action !== "settle" });
      if (decision.action !== "request-reconciliation") {
        emitTurnDiagnostic("three-evidence-reconciliation-query-skipped", {
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          turnId: input.turnId || null,
          engine,
          diagnosticCategory: "three-evidence-reconciliation",
          skipReason: "decision-not-reconciliation",
          decisionAction: decision.action,
          decisionReason: decision.reason,
          scopeMatch: decision.scopeMatch,
          acceptedEvidence: decision.acceptedEvidence,
          boundedReason: decision.diagnostics.boundedReason,
          missingScope: decision.diagnostics.missingScope ?? [],
          staleEvidence: Boolean(decision.diagnostics.staleEvidence),
          residue: Boolean(decision.diagnostics.residue),
          handled: input.handled,
          fallbackApplied: input.fallbackApplied,
          isProcessing: input.lifecycle.isProcessing,
          activeTurnId: input.lifecycle.activeTurnId,
          lastProgressSource: input.diagnostic?.lastProgressSource ?? null,
          lastProgressAgeMs,
          progressSequence: input.diagnostic?.progressSequence ?? null,
          activeThreadId,
        }, { force: decision.action !== "settle" });
        if (decision.action === "cleanup-residue") {
          settleForegroundTurnResidue({
            workspaceId: input.workspaceId,
            threadId: input.threadId,
            turnId: input.turnId || null,
            engine,
            lifecycle: input.lifecycle,
            source: "three-evidence-query-skipped",
            decisionAction: decision.action,
            decisionReason: decision.reason,
            scopeMatch: decision.scopeMatch,
            acceptedEvidence: decision.acceptedEvidence,
            boundedReason: decision.diagnostics.boundedReason,
            lastProgressAgeMs,
          });
        }
        return;
      }

      const request = {
        workspaceId: input.workspaceId,
        engine,
        threadId: input.threadId,
        turnId: input.turnId || null,
        runtimeSessionId: null,
        runtimeLeaseId: null,
        requestSource: "three-evidence-reconciliation" as const,
        requestedAtMs: now,
      };
      const queryKey = buildReconciliationQueryKey(request);
      if (reconciliationQueryInFlightRef.current.has(queryKey)) {
        emitTurnDiagnostic("three-evidence-reconciliation-query-skipped", {
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          turnId: input.turnId || null,
          engine,
          diagnosticCategory: "three-evidence-reconciliation",
          skipReason: "query-already-in-flight",
          requestSource: request.requestSource,
          decisionAction: decision.action,
          decisionReason: decision.reason,
          boundedReason: decision.diagnostics.boundedReason,
          queryKeyHash: queryKey.length,
          isProcessing: input.lifecycle.isProcessing,
          activeTurnId: input.lifecycle.activeTurnId,
          lastProgressAgeMs,
          activeThreadId,
        }, { force: true });
        return;
      }
      reconciliationQueryInFlightRef.current.add(queryKey);
      emitTurnDiagnostic("three-evidence-reconciliation-query-requested", {
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        turnId: input.turnId || null,
        engine,
        diagnosticCategory: "three-evidence-reconciliation",
        requestSource: request.requestSource,
        lastProgressAgeMs,
        decisionAction: decision.action,
        decisionReason: decision.reason,
        boundedReason: decision.diagnostics.boundedReason,
        queryKeyHash: queryKey.length,
        activeThreadId,
      }, { force: true });

      void queryTurnReconciliationStatusWithTimeout(request)
        .then((response) => {
          const latestLifecycle = getThreadLifecycleSnapshot(input.threadId);
          const latestDiagnostic = turnDiagnosticsRef.current.get(input.threadId);
          const responseNow = Date.now();
          const responseLastProgressAgeMs = latestDiagnostic
            ? Math.max(0, responseNow - latestDiagnostic.lastProgressAt)
            : lastProgressAgeMs;
          const responseTerminalKind = terminalKindFromReconciliationStatus(response.status);
          const responseDecision = evaluateTurnSettlement(
            {
              workspaceId: response.workspaceId,
              engine: response.engine,
              threadId: response.threadId,
              turnId: response.turnId,
              runtimeSessionId: response.runtimeSessionId,
              runtimeLeaseId: response.runtimeLeaseId,
              source: "status-query",
              scope: {
                foreground: activeThreadId === null || activeThreadId === input.threadId,
                currentWorkspaceId: input.workspaceId,
                currentEngine: engine,
                currentThreadId: input.threadId,
                currentTurnId: latestLifecycle.activeTurnId,
                currentRuntimeLeaseId: null,
              },
              terminal: {
                kind: responseTerminalKind,
                sourceMethod: "three-evidence-reconciliation-status-query",
                receivedAtMs: responseTerminalKind ? responseNow : null,
              },
              state: {
                isProcessing: latestLifecycle.isProcessing,
                activeTurnId: latestLifecycle.activeTurnId,
                aliasTurnId: null,
                blockers: [],
              },
              progress: {
                lastSource:
                  latestDiagnostic?.lastProgressSource ??
                  input.diagnostic?.lastProgressSource ??
                  null,
                lastAtMs:
                  latestDiagnostic?.lastProgressAt ??
                  input.diagnostic?.lastProgressAt ??
                  null,
                ageMs: responseLastProgressAgeMs,
                sequence:
                  latestDiagnostic?.progressSequence ??
                  input.diagnostic?.progressSequence ??
                  0,
                fresh:
                  responseLastProgressAgeMs !== null &&
                  responseLastProgressAgeMs < progressFreshWindowMs,
              },
              reconciliation: {
                attempted: true,
                status: response.status,
                replayRequested: false,
              },
            },
            {
              ...DEFAULT_TURN_SETTLEMENT_POLICY,
              progressFreshWindowMs,
              allowRuntimeEndedDegradedSettlement: true,
            },
            responseNow,
          );
          const label = responseDecision.scopeMatch.matched
            ? "three-evidence-reconciliation-query-resolved"
            : "three-evidence-reconciliation-query-rejected";
          emitTurnDiagnostic(label, {
            workspaceId: input.workspaceId,
            threadId: input.threadId,
            turnId: input.turnId || null,
            engine,
            diagnosticCategory: "three-evidence-reconciliation",
            status: response.status,
            statusSource: response.statusSource,
            observedAtMs: response.observedAtMs,
            responseWorkspaceId: response.workspaceId,
            responseThreadId: response.threadId,
            responseTurnId: response.turnId,
            decisionAction: responseDecision.action,
            decisionReason: responseDecision.reason,
            scopeMatch: responseDecision.scopeMatch,
            acceptedEvidence: responseDecision.acceptedEvidence,
            boundedReason: response.boundedReason,
            helperBoundedReason: responseDecision.diagnostics.boundedReason,
            lastProgressAgeMs: responseLastProgressAgeMs,
            isProcessing: latestLifecycle.isProcessing,
            activeTurnId: latestLifecycle.activeTurnId,
            activeThreadId,
          }, { force: true });
          if (responseDecision.action !== "cleanup-residue") {
            emitTurnDiagnostic("three-evidence-reconciliation-cleanup-skipped", {
              workspaceId: input.workspaceId,
              threadId: input.threadId,
              turnId: input.turnId || null,
              engine,
              diagnosticCategory: "three-evidence-reconciliation",
              skipReason: responseDecision.scopeMatch.matched
                ? "decision-not-cleanup-residue"
                : "scope-mismatch",
              status: response.status,
              statusSource: response.statusSource,
              decisionAction: responseDecision.action,
              decisionReason: responseDecision.reason,
              scopeMatch: responseDecision.scopeMatch,
              acceptedEvidence: responseDecision.acceptedEvidence,
              boundedReason: response.boundedReason,
              helperBoundedReason: responseDecision.diagnostics.boundedReason,
              lastProgressAgeMs: responseLastProgressAgeMs,
              isProcessing: latestLifecycle.isProcessing,
              activeTurnId: latestLifecycle.activeTurnId,
              activeThreadId,
            }, { force: true });
            return;
          }
          settleForegroundTurnResidue({
            workspaceId: input.workspaceId,
            threadId: input.threadId,
            turnId: input.turnId || null,
            engine,
            lifecycle: latestLifecycle,
            source: "three-evidence-query-resolved",
            decisionAction: responseDecision.action,
            decisionReason: responseDecision.reason,
            scopeMatch: responseDecision.scopeMatch,
            acceptedEvidence: responseDecision.acceptedEvidence,
            boundedReason: responseDecision.diagnostics.boundedReason,
            status: response.status,
            statusSource: response.statusSource,
            lastProgressAgeMs: responseLastProgressAgeMs,
          });
        })
        .catch((error: unknown) => {
          const latestLifecycle = getThreadLifecycleSnapshot(input.threadId);
          emitTurnDiagnostic("three-evidence-reconciliation-query-failed", {
            workspaceId: input.workspaceId,
            threadId: input.threadId,
            turnId: input.turnId || null,
            engine,
            diagnosticCategory: "three-evidence-reconciliation",
            status: "query-failed",
            boundedReason:
              error instanceof Error
                ? error.message
                : "status query failed with unknown error",
            lastProgressAgeMs,
            isProcessing: latestLifecycle.isProcessing,
            activeTurnId: latestLifecycle.activeTurnId,
            activeThreadId,
          }, { force: true });
        })
        .finally(() => {
          reconciliationQueryInFlightRef.current.delete(queryKey);
        });
    },
    [
      activeThreadId,
      buildReconciliationQueryKey,
      emitTurnDiagnostic,
      getThreadLifecycleSnapshot,
      settleForegroundTurnResidue,
      terminalKindFromReconciliationStatus,
    ],
  );

  const clearFirstDeltaTimer = useCallback((threadId: string) => {
    const timerId = turnFirstDeltaTimerRef.current.get(threadId);
    if (timerId === undefined) {
      return;
    }
    window.clearTimeout(timerId);
    turnFirstDeltaTimerRef.current.delete(threadId);
  }, []);

  const clearTurnStallTimer = useCallback((threadId: string) => {
    const timerId = turnStallTimerRef.current.get(threadId);
    if (timerId === undefined) {
      return;
    }
    window.clearTimeout(timerId);
    turnStallTimerRef.current.delete(threadId);
  }, []);

  const clearCodexNoProgressTimer = useCallback((threadId: string) => {
    const timerId = codexNoProgressTimerRef.current.get(threadId);
    if (timerId === undefined) {
      return;
    }
    window.clearTimeout(timerId);
    codexNoProgressTimerRef.current.delete(threadId);
  }, []);

  const markCodexNoProgressSuspected = useCallback(
    (threadId: string, diagnostic: TurnDiagnosticState, elapsedSinceProgressMs: number) => {
      if (diagnostic.noProgressSuspectedAt !== null) {
        return;
      }
      const now = Date.now();
      const timeoutMs = getCodexNoProgressTimeoutMs(diagnostic);
      const activeExecutionItemTypes = listActiveExecutionItemTypes(diagnostic);
      const lifecycle = getThreadLifecycleSnapshot(threadId);
      diagnostic.noProgressSuspectedAt = now;
      diagnostic.noProgressSuspectedSource = "frontend-no-progress-suspected";
      dispatch({
        type: "markCodexSilentSuspected",
        threadId,
        timestamp: now,
        source: "frontend-no-progress-suspected",
      });
      emitTurnDiagnostic("codex-no-progress-suspected", {
        ...buildCodexLivenessDiagnostic({
          workspaceId: diagnostic.workspaceId,
          threadId,
          stage: "suspected-silent",
          outcome: "recoverable",
          source: "frontend-no-progress-suspected",
          reason: "frontend observed no Codex progress before the watchdog window",
          turnId: diagnostic.turnId,
          lastEventAgeMs: elapsedSinceProgressMs,
        }),
        turnId: diagnostic.turnId,
        elapsedMs: Math.max(0, now - diagnostic.startedAt),
        elapsedSinceProgressMs,
        timeoutMs,
        lastProgressSource: diagnostic.lastProgressSource,
        progressSequence: diagnostic.progressSequence,
        activeExecutionItemCount: diagnostic.activeExecutionItems.size,
        activeExecutionItemTypes,
        isProcessing: lifecycle.isProcessing,
        activeTurnId: lifecycle.activeTurnId,
        diagnosticCategory: "codex-no-progress",
        terminal: false,
        quarantine: false,
        ...buildThreadStreamCorrelationDimensions(threadId),
      }, { force: true });
      emitThreeEvidenceDryRunDiagnostic({
        workspaceId: diagnostic.workspaceId,
        threadId,
        turnId: diagnostic.turnId,
        terminalKind: null,
        sourceMethod: "frontend-no-progress-suspected",
        lifecycle,
        diagnostic,
        handled: false,
        fallbackApplied: false,
      });
    },
    [dispatch, emitThreeEvidenceDryRunDiagnostic, emitTurnDiagnostic, getThreadLifecycleSnapshot],
  );

  const emitCodexNoProgressWatchdogDiagnostic = useCallback(
    (
      stage: "scheduled" | "fired" | "skipped",
      input: {
        workspaceId?: string | null;
        threadId: string;
        diagnostic: TurnDiagnosticState | null;
        reason?: string;
        timeoutMs?: number | null;
        elapsedSinceProgressMs?: number | null;
        delayMs?: number | null;
        lifecycle?: ThreadLifecycleSnapshot | null;
      },
    ) => {
      emitTurnDiagnostic(`codex-no-progress-watchdog-${stage}`, {
        workspaceId: input.workspaceId ?? input.diagnostic?.workspaceId ?? null,
        threadId: input.threadId,
        turnId: input.diagnostic?.turnId ?? null,
        diagnosticCategory: "codex-no-progress-watchdog",
        stage,
        reason: input.reason ?? null,
        timeoutMs: input.timeoutMs ?? null,
        elapsedSinceProgressMs: input.elapsedSinceProgressMs ?? null,
        delayMs: input.delayMs ?? null,
        lastProgressSource: input.diagnostic?.lastProgressSource ?? null,
        progressSequence: input.diagnostic?.progressSequence ?? null,
        activeExecutionItemCount:
          input.diagnostic?.activeExecutionItems.size ?? null,
        isProcessing: input.lifecycle?.isProcessing ?? null,
        activeTurnId: input.lifecycle?.activeTurnId ?? null,
        activeThreadId,
        ...buildThreadStreamCorrelationDimensions(input.threadId),
      }, { force: true });
    },
    [activeThreadId, emitTurnDiagnostic],
  );

  const scheduleCodexNoProgressTimer = useCallback(
    (workspaceId: string | null, threadId: string) => {
      if (typeof window === "undefined" || inferThreadEngine(threadId) !== "codex") {
        return;
      }
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (!diagnostic) {
        emitCodexNoProgressWatchdogDiagnostic("skipped", {
          workspaceId,
          threadId,
          diagnostic: null,
          reason: "missing-diagnostic",
        });
        return;
      }
      clearCodexNoProgressTimer(threadId);
      const now = Date.now();
      const timeoutMs = getCodexNoProgressTimeoutMs(diagnostic);
      const elapsedSinceProgressMs = Math.max(0, now - diagnostic.lastProgressAt);
      const delayMs = Math.max(0, timeoutMs - elapsedSinceProgressMs);
      emitCodexNoProgressWatchdogDiagnostic("scheduled", {
        workspaceId: diagnostic.workspaceId,
        threadId,
        diagnostic,
        timeoutMs,
        elapsedSinceProgressMs,
        delayMs,
      });
      const timerId = window.setTimeout(() => {
        const latestDiagnostic = turnDiagnosticsRef.current.get(threadId);
        if (!latestDiagnostic) {
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: null,
            reason: "missing-diagnostic",
          });
          return;
        }
        const now = Date.now();
        const elapsedSinceProgressMs = Math.max(0, now - latestDiagnostic.lastProgressAt);
        const timeoutMs = getCodexNoProgressTimeoutMs(latestDiagnostic);
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        emitCodexNoProgressWatchdogDiagnostic("fired", {
          workspaceId: diagnostic?.workspaceId ?? null,
          threadId,
          diagnostic: latestDiagnostic,
          timeoutMs,
          elapsedSinceProgressMs,
          lifecycle,
        });
        if (latestDiagnostic.completedAt !== null) {
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: latestDiagnostic,
            reason: "completed",
            timeoutMs,
            elapsedSinceProgressMs,
          });
          return;
        }
        if (latestDiagnostic.errorAt !== null) {
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: latestDiagnostic,
            reason: "error",
            timeoutMs,
            elapsedSinceProgressMs,
          });
          return;
        }
        if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId ?? latestDiagnostic.workspaceId ?? null, threadId)) {
          const inferredEngine = inferThreadEngine(threadId);
          const correlationEngine =
            buildThreadStreamCorrelationDimensions(threadId).engine;
          const engineScopeMatches =
            correlationEngine === null || correlationEngine === inferredEngine;
          const turnScopeMatches =
            lifecycle.activeTurnId === latestDiagnostic.turnId ||
            lifecycle.activeTurnId === null;
          settleForegroundTurnResidue({
            workspaceId: latestDiagnostic.workspaceId,
            threadId,
            turnId: latestDiagnostic.turnId,
            engine: inferredEngine,
            lifecycle,
            source: "watchdog-interrupted",
            decisionAction: "cleanup-residue",
            decisionReason: "interrupted",
            scopeMatch: {
              matched: engineScopeMatches && turnScopeMatches,
              workspace: true,
              engine: engineScopeMatches,
              thread: true,
              turn: turnScopeMatches,
              foregroundOwner: true,
              runtimeLease: null,
            },
            acceptedEvidence: {
              terminal: true,
              state: lifecycle.isProcessing,
              progress: false,
              reconciliation: false,
            },
            boundedReason: "watchdog skipped because turn was interrupted",
            lastProgressAgeMs: elapsedSinceProgressMs,
            allowAbandonedActiveTurn: true,
          });
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: latestDiagnostic,
            reason: "interrupted",
            timeoutMs,
            elapsedSinceProgressMs,
            lifecycle,
          });
          return;
        }
        if (!lifecycle.isProcessing) {
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: latestDiagnostic,
            reason: "not-processing",
            timeoutMs,
            elapsedSinceProgressMs,
            lifecycle,
          });
          return;
        }
        if (
          lifecycle.activeTurnId !== null &&
          lifecycle.activeTurnId !== latestDiagnostic.turnId
        ) {
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: latestDiagnostic,
            reason: "active-turn-mismatch",
            timeoutMs,
            elapsedSinceProgressMs,
            lifecycle,
          });
          return;
        }
        if (elapsedSinceProgressMs < timeoutMs) {
          emitCodexNoProgressWatchdogDiagnostic("skipped", {
            workspaceId: diagnostic?.workspaceId ?? null,
            threadId,
            diagnostic: latestDiagnostic,
            reason: "progress-still-fresh",
            timeoutMs,
            elapsedSinceProgressMs,
            lifecycle,
          });
          return;
        }
        markCodexNoProgressSuspected(
          threadId,
          latestDiagnostic,
          elapsedSinceProgressMs,
        );
      }, delayMs);
      codexNoProgressTimerRef.current.set(threadId, timerId);
    },
    [
      clearCodexNoProgressTimer,
      emitCodexNoProgressWatchdogDiagnostic,
      getThreadLifecycleSnapshot,
      interruptedThreadsRef,
      markCodexNoProgressSuspected,
      settleForegroundTurnResidue,
    ],
  );

  const noteCodexTurnProgressEvidence = useCallback(
    (workspaceId: string | null, threadId: string, source: string) => {
      if (inferThreadEngine(threadId) !== "codex" || workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        return;
      }
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (!diagnostic) {
        return;
      }
      const wasSuspected = diagnostic.noProgressSuspectedAt !== null;
      const suspectedDurationMs =
        diagnostic.noProgressSuspectedAt === null
          ? null
          : Math.max(0, Date.now() - diagnostic.noProgressSuspectedAt);
      diagnostic.lastProgressAt = Date.now();
      diagnostic.lastProgressSource = source;
      diagnostic.progressSequence += 1;
      diagnostic.noProgressSuspectedAt = null;
      diagnostic.noProgressSuspectedSource = null;
      if (wasSuspected) {
        dispatch({ type: "clearCodexSilentSuspected", threadId });
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        emitTurnDiagnostic("codex-no-progress-recovered", {
          ...buildCodexLivenessDiagnostic({
            workspaceId: diagnostic.workspaceId,
            threadId,
            stage: "active",
            outcome: "recovered",
            source,
            reason: "matching Codex progress arrived after frontend no-progress suspicion",
            turnId: diagnostic.turnId,
          }),
          turnId: diagnostic.turnId,
          progressSource: source,
          suspectedDurationMs,
          progressSequence: diagnostic.progressSequence,
          isProcessing: lifecycle.isProcessing,
          activeTurnId: lifecycle.activeTurnId,
          diagnosticCategory: "codex-no-progress",
          ...buildThreadStreamCorrelationDimensions(threadId),
        }, { force: true });
      }
      scheduleCodexNoProgressTimer(workspaceId, threadId);
    },
    [
      emitTurnDiagnostic,
      dispatch,
      getThreadLifecycleSnapshot,
      interruptedThreadsRef,
      scheduleCodexNoProgressTimer,
    ],
  );

  const scheduleFirstDeltaTimer = useCallback(
    (workspaceId: string | null, threadId: string) => {
      if (typeof window === "undefined") {
        return;
      }
      clearFirstDeltaTimer(threadId);
      const timerId = window.setTimeout(() => {
        if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
          return;
        }
        const diagnostic = turnDiagnosticsRef.current.get(threadId);
        if (!diagnostic || diagnostic.firstDeltaAt !== null) {
          return;
        }
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        const now = Date.now();
        const elapsedMs = Math.max(0, now - diagnostic.startedAt);
        reportThreadUpstreamPending(threadId, {
          elapsedMs,
          diagnosticCategory: "first-token-delay",
          reason: "waiting-for-first-delta",
        });
        emitTurnDiagnostic("waiting-for-first-delta", {
          workspaceId: diagnostic.workspaceId,
          threadId: diagnostic.threadId,
          turnId: diagnostic.turnId,
          elapsedMs,
          isProcessing: lifecycle.isProcessing,
          activeTurnId: lifecycle.activeTurnId,
          diagnosticCategory: "first-token-delay",
          ...buildThreadStreamCorrelationDimensions(threadId),
        }, { force: true });
      }, TURN_FIRST_DELTA_WARNING_MS);
      turnFirstDeltaTimerRef.current.set(threadId, timerId);
    },
    [clearFirstDeltaTimer, emitTurnDiagnostic, getThreadLifecycleSnapshot, interruptedThreadsRef],
  );

  const scheduleTurnStallTimer = useCallback(
    (threadId: string) => {
      if (typeof window === "undefined") {
        return;
      }
      clearTurnStallTimer(threadId);
      const timerId = window.setTimeout(() => {
        const diagnostic = turnDiagnosticsRef.current.get(threadId);
        if (!diagnostic || diagnostic.stallReported || diagnostic.firstExecutionAt !== null) {
          return;
        }
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        const now = Date.now();
        diagnostic.stallReported = true;
        emitTurnDiagnostic("stalled-after-first-delta", {
          workspaceId: diagnostic.workspaceId,
          threadId: diagnostic.threadId,
          turnId: diagnostic.turnId,
          elapsedMs: Math.max(0, now - diagnostic.startedAt),
          deltaSinceMs:
            diagnostic.firstDeltaAt === null ? null : Math.max(0, now - diagnostic.firstDeltaAt),
          itemEventCount: diagnostic.itemEventCount,
          firstItemEventKind: diagnostic.firstItemEventKind,
          firstItemType: diagnostic.firstItemType,
          hasExecutionItem: false,
          isProcessing: lifecycle.isProcessing,
          activeTurnId: lifecycle.activeTurnId,
          ...buildThreadStreamCorrelationDimensions(threadId),
        }, { force: true });
      }, TURN_STALL_WARNING_MS);
      turnStallTimerRef.current.set(threadId, timerId);
    },
    [clearTurnStallTimer, emitTurnDiagnostic, getThreadLifecycleSnapshot],
  );

  const noteNonTextRuntimeProgress = useCallback(
    (
      threadId: string,
      source: string,
      evidence: {
        itemType?: string | null;
        itemId?: string | null;
        itemEventKind?: "started" | "updated" | "completed" | "output-delta" | null;
        outputLength?: number | null;
      } = {},
    ) => {
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (!diagnostic || diagnostic.completedAt !== null || diagnostic.errorAt !== null) {
        return;
      }
      const now = Date.now();
      diagnostic.lastProgressAt = now;
      diagnostic.lastProgressSource = source;
      diagnostic.progressSequence += 1;
      if (diagnostic.firstDeltaAt === null) {
        clearFirstDeltaTimer(threadId);
      }
      const lifecycle = getThreadLifecycleSnapshot(threadId);
      emitTurnDiagnostic("non-text-runtime-progress", {
        workspaceId: diagnostic.workspaceId,
        threadId,
        turnId: diagnostic.turnId,
        source,
        itemType: evidence.itemType ?? null,
        itemId: evidence.itemId ?? null,
        itemEventKind: evidence.itemEventKind ?? null,
        outputLength: evidence.outputLength ?? null,
        elapsedMs: Math.max(0, now - diagnostic.startedAt),
        firstDeltaSeen: diagnostic.firstDeltaAt !== null,
        progressSequence: diagnostic.progressSequence,
        isProcessing: lifecycle.isProcessing,
        activeTurnId: lifecycle.activeTurnId,
        diagnosticCategory: "non-text-runtime-progress",
        ...buildThreadStreamCorrelationDimensions(threadId),
      });
    },
    [clearFirstDeltaTimer, emitTurnDiagnostic, getThreadLifecycleSnapshot],
  );

  const clearAssistantSnapshotIngressForThread = useCallback((threadId: string) => {
    const prefix = `${threadId}\u0000`;
    assistantSnapshotIngressLengthRef.current.forEach((_value, key) => {
      if (key.startsWith(prefix)) {
        assistantSnapshotIngressLengthRef.current.delete(key);
      }
    });
  }, []);

  const quarantineCodexTurn = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      reason: string,
      source: string,
      engineHint?: ConversationEngine | null,
    ) => {
      const normalizedTurnId = turnId.trim();
      const engine = engineHint ?? inferThreadEngine(threadId);
      if (engine !== "codex" || !normalizedTurnId) {
        return;
      }
      const key = buildCodexTurnIdentityKey(threadId, normalizedTurnId);
      if (quarantinedCodexTurnsRef.current.has(key)) {
        return;
      }
      quarantinedCodexTurnsRef.current.set(key, {
        workspaceId,
        threadId,
        turnId: normalizedTurnId,
        settledAt: Date.now(),
        reason,
        source,
      });
    },
    [],
  );

  const shouldSkipCodexTurnEvent = useCallback(
    (input: {
      engine: "claude" | "codex" | "gemini" | "opencode";
      workspaceId: string;
      threadId: string;
      turnId: string;
      operation: string;
      sourceMethod: string;
    }) => {
      if (input.engine !== "codex") {
        return false;
      }
      const eventTurnId = input.turnId.trim();
      if (!eventTurnId) {
        return false;
      }
      const quarantineKey = buildCodexTurnIdentityKey(input.threadId, eventTurnId);
      const quarantinedTurn = quarantinedCodexTurnsRef.current.get(quarantineKey);
      if (quarantinedTurn) {
        emitTurnDiagnostic("quarantined-codex-event-skipped", {
          ...buildCodexLivenessDiagnostic({
            workspaceId: input.workspaceId,
            threadId: input.threadId,
            stage: "abandoned",
            outcome: "abandoned",
            source: input.sourceMethod,
            reason: "event belongs to a quarantined Codex turn",
            turnId: eventTurnId,
          }),
          eventTurnId,
          quarantinedAtMs: quarantinedTurn.settledAt,
          quarantineReason: quarantinedTurn.reason,
          quarantineSource: quarantinedTurn.source,
          operation: input.operation,
          sourceMethod: input.sourceMethod,
          diagnosticCategory: "quarantined-codex-event",
        }, { force: true });
        return true;
      }
      const diagnosticTurnId = turnDiagnosticsRef.current.get(input.threadId)?.turnId ?? null;
      const activeTurnId = getThreadLifecycleSnapshot(input.threadId).activeTurnId;
      const expectedTurnId = diagnosticTurnId ?? activeTurnId;
      if (!expectedTurnId || expectedTurnId === eventTurnId) {
        return false;
      }
      emitTurnDiagnostic("late-codex-event-skipped", {
        ...buildCodexLivenessDiagnostic({
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          stage: "abandoned",
          outcome: "abandoned",
          source: input.sourceMethod,
          reason: "event turn id does not match active Codex turn",
          turnId: eventTurnId,
        }),
        eventTurnId,
        activeTurnId,
        expectedTurnId,
        operation: input.operation,
        sourceMethod: input.sourceMethod,
        diagnosticCategory: "late-codex-event",
      }, { force: true });
      return true;
    },
    [emitTurnDiagnostic, getThreadLifecycleSnapshot],
  );

  const markProcessingTracked = useCallback(
    (threadId: string, isProcessing: boolean) => {
      const previous =
        threadLifecycleSnapshotRef.current.get(threadId) ?? createThreadLifecycleSnapshot();
      threadLifecycleSnapshotRef.current.set(threadId, {
        ...previous,
        isProcessing,
      });
      markProcessing(threadId, isProcessing);
    },
    [markProcessing],
  );

  const setActiveTurnIdTracked = useCallback(
    (threadId: string, turnId: string | null) => {
      const previous =
        threadLifecycleSnapshotRef.current.get(threadId) ?? createThreadLifecycleSnapshot();
      threadLifecycleSnapshotRef.current.set(threadId, {
        ...previous,
        activeTurnId: turnId,
      });
      setActiveTurnId(threadId, turnId);
    },
    [setActiveTurnId],
  );

  const captureTurnItemDiagnostic = useCallback(
    (
      workspaceId: string | null,
      threadId: string,
      kind: "started" | "updated" | "completed",
      item: Record<string, unknown>,
    ) => {
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (!diagnostic) {
        return;
      }
      diagnostic.itemEventCount += 1;
      const itemType = asString(item.type).trim() || null;
      const itemId = asString(item.id).trim() || null;
      const now = Date.now();
      if (diagnostic.firstItemEventAt === null) {
        diagnostic.firstItemEventAt = now;
        diagnostic.firstItemEventKind = kind;
        diagnostic.firstItemType = itemType;
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        emitTurnDiagnostic("first-item", {
          workspaceId: diagnostic.workspaceId,
          threadId,
          turnId: diagnostic.turnId,
          itemEventKind: kind,
          itemType,
          itemId,
          elapsedMs: Math.max(0, now - diagnostic.startedAt),
          deltaSeen: diagnostic.firstDeltaAt !== null,
          isProcessing: lifecycle.isProcessing,
          activeTurnId: lifecycle.activeTurnId,
          ...buildThreadStreamCorrelationDimensions(threadId),
        });
      }
      if (isExecutionItemType(itemType)) {
        noteNonTextRuntimeProgress(threadId, `execution-item-${kind}`, {
          itemType,
          itemId,
          itemEventKind: kind,
        });
        if (diagnostic.firstExecutionAt === null) {
          diagnostic.firstExecutionAt = now;
          diagnostic.firstExecutionEventKind = kind;
          diagnostic.firstExecutionItemType = itemType;
          diagnostic.firstExecutionItemId = itemId;
          clearTurnStallTimer(threadId);
          const lifecycle = getThreadLifecycleSnapshot(threadId);
          emitTurnDiagnostic("first-execution-item", {
            workspaceId: diagnostic.workspaceId,
            threadId,
            turnId: diagnostic.turnId,
            itemEventKind: kind,
            itemType,
            itemId,
            elapsedMs: Math.max(0, now - diagnostic.startedAt),
            deltaSinceMs:
              diagnostic.firstDeltaAt === null ? null : Math.max(0, now - diagnostic.firstDeltaAt),
            isProcessing: lifecycle.isProcessing,
            activeTurnId: lifecycle.activeTurnId,
            ...buildThreadStreamCorrelationDimensions(threadId),
          });
        }
      }
      if (applyActiveExecutionItemEvent(diagnostic, kind, itemType, itemId, item, now)) {
        scheduleCodexNoProgressTimer(workspaceId, threadId);
      }
    },
    [
      clearTurnStallTimer,
      emitTurnDiagnostic,
      getThreadLifecycleSnapshot,
      noteNonTextRuntimeProgress,
      scheduleCodexNoProgressTimer,
    ],
  );

  const recordAssistantCompletionEvidence = useCallback(
    (threadId: string, itemId: string) => {
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (!diagnostic) {
        return;
      }
      diagnostic.assistantCompletedAt = Date.now();
      diagnostic.assistantCompletedItemId = itemId || null;
    },
    [],
  );

  const recordAssistantStreamIngress = useCallback(
    (payload: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      textLength: number;
      source: StreamIngressSource;
    }) => {
      if (workspaceScopedHas(interruptedThreadsRef.current, payload.workspaceId, payload.threadId)) {
        return;
      }
      const diagnostic = turnDiagnosticsRef.current.get(payload.threadId);
      if (!diagnostic) {
        return;
      }
      const deltaTimestamp = Date.now();
      const source = payload.source;
      const isDeltaIngress = source === "delta" || source === "snapshot";
      if (isDeltaIngress) {
        noteThreadDeltaReceived(payload.threadId, deltaTimestamp, {
          source,
          itemId: payload.itemId,
          textLength: payload.textLength,
        });
        diagnostic.deltaCount += 1;
      } else {
        noteThreadTextIngressReceived(payload.threadId, {
          source: payload.source,
          itemId: payload.itemId,
          textLength: payload.textLength,
          timestamp: deltaTimestamp,
        });
      }
      if (!isDeltaIngress) {
        return;
      }
      if (diagnostic.firstDeltaAt !== null) {
        return;
      }
      diagnostic.firstDeltaAt = deltaTimestamp;
      clearFirstDeltaTimer(payload.threadId);
      scheduleTurnStallTimer(payload.threadId);
      const lifecycle = getThreadLifecycleSnapshot(payload.threadId);
      emitTurnDiagnostic("first-delta", {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
        turnId: diagnostic.turnId,
        itemId: payload.itemId,
        deltaLength: payload.textLength,
        ingressSource: payload.source,
        elapsedMs: Math.max(0, diagnostic.firstDeltaAt - diagnostic.startedAt),
        isProcessing: lifecycle.isProcessing,
        activeTurnId: lifecycle.activeTurnId,
        ...buildThreadStreamCorrelationDimensions(payload.threadId),
      });
    },
    [
      clearFirstDeltaTimer,
      emitTurnDiagnostic,
      getThreadLifecycleSnapshot,
      interruptedThreadsRef,
      scheduleTurnStallTimer,
    ],
  );

  const maybeRecordAgentMessageSnapshotIngress = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      const itemType = asString(item.type).trim();
      if (itemType !== "agentMessage") {
        return;
      }
      const text = resolveAgentMessageSnapshotText(item);
      if (!text.trim()) {
        return;
      }
      const itemId = asString(item.id).trim();
      const ingressKey = buildAssistantSnapshotIngressKey(threadId, itemId);
      const previousLength =
        assistantSnapshotIngressLengthRef.current.get(ingressKey) ?? 0;
      const nextLength = text.length;
      if (nextLength <= previousLength) {
        return;
      }
      assistantSnapshotIngressLengthRef.current.set(ingressKey, nextLength);
      recordAssistantStreamIngress({
        workspaceId,
        threadId,
        itemId,
        textLength: nextLength,
        source: "snapshot",
      });
    },
    [recordAssistantStreamIngress],
  );

  useEffect(() => {
    const firstDeltaTimers = turnFirstDeltaTimerRef.current;
    const stallTimers = turnStallTimerRef.current;
    const codexNoProgressTimers = codexNoProgressTimerRef.current;
    const assistantSnapshotIngressLength = assistantSnapshotIngressLengthRef.current;
    const quarantinedCodexTurns = quarantinedCodexTurnsRef.current;
    const reconciliationQueryInFlight = reconciliationQueryInFlightRef.current;
    return () => {
      firstDeltaTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      firstDeltaTimers.clear();
      stallTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      stallTimers.clear();
      codexNoProgressTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      codexNoProgressTimers.clear();
      assistantSnapshotIngressLength.clear();
      quarantinedCodexTurns.clear();
      reconciliationQueryInFlight.clear();
    };
  }, []);

  // chat-stream-render-isolation-2026-06 task 8.4: 60s interval sweep
  // over turnDiagnosticsRef / quarantinedCodexTurnsRef. Active turns (no
  // settled timestamp) are never evicted; settled entries expire 30min after
  // their settledAt. See design.md §4 and sweepThreadTransientState in
  // threadEventDiagnostics.ts.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const diagnosticEntries = Array.from(
        turnDiagnosticsRef.current.entries(),
      ).map(([threadId, state]) => ({
        threadId,
        settledAt:
          state.completedAt ?? state.errorAt ?? state.assistantCompletedAt,
      }));
      const diagnosticSweep = sweepThreadTransientState(
        diagnosticEntries,
        now,
      );
      for (const threadId of diagnosticSweep.expiredThreadIds) {
        const workspaceId =
          turnDiagnosticsRef.current.get(threadId)?.workspaceId ?? null;
        cleanupThreadTransientRefs(workspaceId, threadId);
      }
      const quarantineEntries = Array.from(
        quarantinedCodexTurnsRef.current.entries(),
      ).map(([quarantineKey, entry]) => ({
        threadId: quarantineKey,
        settledAt: entry.settledAt,
      }));
      const quarantineSweep = sweepThreadTransientState(
        quarantineEntries,
        now,
      );
      for (const quarantineKey of quarantineSweep.expiredThreadIds) {
        quarantinedCodexTurnsRef.current.delete(quarantineKey);
      }
    }, TRANSIENT_TURN_STATE_SWEEP_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [cleanupThreadTransientRefs]);

  const onApprovalRequest = useThreadApprovalEvents({
    dispatch,
    approvalAllowlistRef,
    markProcessing: markProcessingTracked,
    setActiveTurnId: setActiveTurnIdTracked,
    resolveClaudeContinuationThreadId,
  });
  const enqueueUserInputRequest = useThreadUserInputEvents({
    dispatch,
    resolveClaudeContinuationThreadId,
  });
  const settleThreadWaitingForUserChoice = useCallback(
    (threadId: string) => {
      if (!threadId) {
        return;
      }
      // User-choice gates are no longer normal foreground processing.
      markProcessingTracked(threadId, false);
      setActiveTurnIdTracked(threadId, null);
      dispatch({
        type: "settleThreadPlanInProgress",
        threadId,
        targetStatus: "pending",
      });
    },
    [dispatch, markProcessingTracked, setActiveTurnIdTracked],
  );
  const onRequestUserInput = useCallback(
    (request: RequestUserInputRequest) => {
      enqueueUserInputRequest(request);
      const threadId =
        resolveClaudeContinuationThreadId?.(
          request.workspace_id,
          request.params.thread_id,
          request.params.turn_id,
        ) ?? request.params.thread_id;
      if (!threadId) {
        return;
      }
      settleThreadWaitingForUserChoice(threadId);
    },
    [
      enqueueUserInputRequest,
      resolveClaudeContinuationThreadId,
      settleThreadWaitingForUserChoice,
    ],
  );
  const onModeBlocked = useCallback(
    (event: CollaborationModeBlockedRequest) => {
      const rawThreadId = event.params.thread_id;
      const threadId =
        resolveClaudeContinuationThreadId?.(event.workspace_id, rawThreadId) ?? rawThreadId;
      if (!threadId) {
        return;
      }
      const requestUserInputBlocked = isRequestUserInputModeBlocked(event);
      const requestId = event.params.request_id;
      if (requestId !== null && requestId !== undefined) {
        dispatch({
          type: "removeUserInputRequest",
          requestId,
          workspaceId: event.workspace_id,
        });
      }
      if (requestUserInputBlocked) {
        settleThreadWaitingForUserChoice(threadId);
      }
      const reason =
        event.params.reason.trim() ||
        "This request is blocked while effective mode is code.";
      const suggestion =
        (event.params.suggestion ?? "").trim() ||
        "Switch to Plan mode and retry if user input is required.";
      const blockedMethod = asString(event.params.blocked_method).trim();
      const blockedDetail = blockedMethod || (
        requestUserInputBlocked ? "item/tool/requestUserInput" : "modeBlocked"
      );
      const blockedTitle = requestUserInputBlocked
        ? "Tool: askuserquestion"
        : "Tool: mode policy";
      const eventId = requestId !== null && requestId !== undefined
        ? String(requestId)
        : `${Date.now()}`;
      dispatch({
        type: "upsertItem",
        workspaceId: event.workspace_id,
        threadId,
        item: {
          id: `mode-blocked-${threadId}-${eventId}`,
          kind: "tool",
          toolType: "modeBlocked",
          title: blockedTitle,
          detail: blockedDetail,
          status: "completed",
          output: `${reason}\n\n${suggestion}`,
        },
        hasCustomName: Boolean(getCustomName(event.workspace_id, threadId)),
      });
    },
    [dispatch, getCustomName, resolveClaudeContinuationThreadId, settleThreadWaitingForUserChoice],
  );

  const onModeResolved = useCallback(
    (event: CollaborationModeResolvedRequest) => {
      onCollaborationModeResolved?.(event);
    },
    [onCollaborationModeResolved],
  );

  const {
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
    flushPendingRealtimeEvents,
    isRealtimeTurnTerminalExact,
    noteRealtimeTurnStarted,
    markRealtimeTurnTerminal,
  } = useThreadItemEvents({
    activeThreadId,
    dispatch,
    getCustomName,
    resolveCollaborationUiMode,
    markProcessing: markProcessingTracked,
    markReviewing,
    safeMessageActivity,
    recordThreadActivity,
    applyCollabThreadLinks,
    interruptedThreadsRef,
    onDebug,
    onAgentMessageCompletedExternal,
    onExitPlanModeToolCompleted,
  });

  const {
    onThreadStarted,
    onTurnStarted,
    onTurnCompleted,
    onTurnPlanUpdated,
    onThreadTokenUsageUpdated: onThreadTokenUsageUpdatedBase,
    onAccountRateLimitsUpdated,
    onTurnError,
    onTurnStalled,
    onContextCompacting,
    onContextCompacted,
    onContextCompactionFailed,
    onThreadSessionIdUpdated,
  } = useThreadTurnEvents({
    activeThreadId,
    dispatch,
    getCustomName,
    resolveCanonicalThreadId,
    isAutoTitlePending,
    isThreadHidden,
    markProcessing: markProcessingTracked,
    markReviewing,
    setActiveTurnId: setActiveTurnIdTracked,
    codexCompactionInFlightByThreadRef,
    pendingInterruptsRef,
    interruptedThreadsRef,
    pushThreadErrorMessage,
    safeMessageActivity,
    recordThreadActivity,
    renameCustomNameKey,
    renameAutoTitlePendingKey,
    renameThreadTitleMapping,
    resolvePendingThreadForSession,
    resolvePendingThreadForTurn,
    getActiveTurnIdForThread,
    renamePendingMemoryCaptureKey,
    onDebug,
  });

  const onThreadTokenUsageUpdatedTracked = useCallback(
    (workspaceId: string, threadId: string, tokenUsage: Record<string, unknown>) => {
      onThreadTokenUsageUpdatedBase(workspaceId, threadId, tokenUsage);
      noteCodexTurnProgressEvidence(workspaceId, threadId, "thread-token-usage");
    },
    [noteCodexTurnProgressEvidence, onThreadTokenUsageUpdatedBase],
  );

  const onBackgroundThreadAction = useCallback(
    (workspaceId: string, threadId: string, action: string) => {
      if (action !== "hide") {
        return;
      }
      dispatch({ type: "hideThread", workspaceId, threadId });
    },
    [dispatch],
  );

  const onProcessingHeartbeat = useCallback(
    (_workspaceId: string, threadId: string, pulse: number) => {
      if (!threadId || pulse <= 0) {
        return;
      }
      dispatch({ type: "markHeartbeat", threadId, pulse });
      dispatch({ type: "markContinuationEvidence", threadId });
      noteCodexTurnProgressEvidence(_workspaceId, threadId, "processing-heartbeat");
      safeMessageActivity();
    },
    [dispatch, noteCodexTurnProgressEvidence, safeMessageActivity],
  );

  const emitTurnDomainEvent = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      status: "completed" | "failed",
      payload?: { durationMs?: number | null; errorMessage?: string },
    ) => {
      if (!domainEventController || !turnId.trim()) {
        return;
      }
      const common = {
        occurredAt: new Date().toISOString(),
        workspaceId,
        sessionId: threadId,
        engine: inferThreadEngine(threadId),
        turnId,
      };
      domainEventController.emitInternal(
        status === "completed"
          ? domainEventFactories.turnCompleted({
              ...common,
              durationMs: payload?.durationMs ?? null,
            })
          : domainEventFactories.turnFailed({
              ...common,
              errorMessage: payload?.errorMessage ?? "turn failed",
            }),
      );
    },
    [domainEventController],
  );

  const onTurnStartedTracked = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      const startedAt = Date.now();
      noteRealtimeTurnStarted(threadId, turnId);
      clearAssistantSnapshotIngressForThread(threadId);
      noteThreadTurnStarted({
        workspaceId,
        threadId,
        turnId,
        startedAt,
      });
      clearTurnStallTimer(threadId);
      clearFirstDeltaTimer(threadId);
      turnDiagnosticsRef.current.set(
        threadId,
        createTurnDiagnosticState(workspaceId, threadId, turnId, startedAt),
      );
      dispatch({ type: "clearCodexSilentSuspected", threadId });
      scheduleFirstDeltaTimer(workspaceId, threadId);
      scheduleCodexNoProgressTimer(workspaceId, threadId);
      onTurnStarted(workspaceId, threadId, turnId);
      dispatch({ type: "markContinuationEvidence", threadId });
      const lifecycle = getThreadLifecycleSnapshot(threadId);
      emitTurnDiagnostic("started", {
        workspaceId,
        threadId,
        turnId,
        isProcessing: lifecycle.isProcessing,
        activeTurnId: lifecycle.activeTurnId,
        ...buildThreadStreamCorrelationDimensions(threadId),
      });
    },
    [
      clearFirstDeltaTimer,
      clearTurnStallTimer,
      dispatch,
      emitTurnDiagnostic,
      getThreadLifecycleSnapshot,
      onTurnStarted,
      noteRealtimeTurnStarted,
      scheduleCodexNoProgressTimer,
      scheduleFirstDeltaTimer,
      clearAssistantSnapshotIngressForThread,
    ],
  );

  const onAgentMessageDeltaTracked = useCallback(
    (payload: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      turnId?: string | null;
    }) => {
      const eventTurnId = asString(payload.turnId).trim();
      if (
        eventTurnId &&
        isRealtimeTurnTerminalExact(payload.threadId, eventTurnId)
      ) {
        return;
      }
      if (
        eventTurnId &&
        shouldSkipCodexTurnEvent({
          engine: inferThreadEngine(payload.threadId),
          workspaceId: payload.workspaceId,
          threadId: payload.threadId,
          turnId: eventTurnId,
          operation: "appendAgentMessageDelta",
          sourceMethod: "item/agentMessage/delta",
        })
      ) {
        return;
      }
      onAgentMessageDelta(payload);
      dispatch({ type: "markContinuationEvidence", threadId: payload.threadId });
      if (workspaceScopedHas(interruptedThreadsRef.current, payload.workspaceId, payload.threadId)) {
        return;
      }
      noteCodexTurnProgressEvidence(payload.workspaceId, payload.threadId, "agent-message-delta");
      recordAssistantStreamIngress({
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
        itemId: payload.itemId,
        textLength: payload.delta.length,
        source: "delta",
      });
    },
    [
      dispatch,
      interruptedThreadsRef,
      isRealtimeTurnTerminalExact,
      noteCodexTurnProgressEvidence,
      onAgentMessageDelta,
      recordAssistantStreamIngress,
      shouldSkipCodexTurnEvent,
    ],
  );

  const onAgentMessageCompletedTracked = useCallback(
    (payload: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      text: string;
      turnId?: string | null;
    }) => {
      const eventTurnId = asString(payload.turnId).trim();
      if (eventTurnId && isRealtimeTurnTerminalExact(payload.threadId, eventTurnId)) {
        return;
      }
      onAgentMessageCompleted(payload);
      if (workspaceScopedHas(interruptedThreadsRef.current, payload.workspaceId, payload.threadId) || payload.text.length === 0) {
        return;
      }
      recordAssistantCompletionEvidence(payload.threadId, payload.itemId);
      recordAssistantStreamIngress({
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
        itemId: payload.itemId,
        textLength: payload.text.length,
        source: "completion",
      });
      flushDeferredTurnCompletionRef.current?.(
        payload.threadId,
        "assistant-completed",
      );
    },
    [
      interruptedThreadsRef,
      isRealtimeTurnTerminalExact,
      onAgentMessageCompleted,
      recordAssistantCompletionEvidence,
      recordAssistantStreamIngress,
    ],
  );

  const onItemStartedTracked = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      const eventTurnId = extractTurnIdFromRawItem(item);
      if (eventTurnId && isRealtimeTurnTerminalExact(threadId, eventTurnId)) {
        return;
      }
      if (
        shouldSkipCodexTurnEvent({
          engine: inferRawItemEngine(threadId, item),
          workspaceId,
          threadId,
          turnId: eventTurnId,
          operation: "itemStarted",
          sourceMethod: "item/started",
        })
      ) {
        return;
      }
      onItemStarted(workspaceId, threadId, item);
      dispatch({ type: "markContinuationEvidence", threadId });
      noteCodexTurnProgressEvidence(workspaceId, threadId, "item-started");
      maybeRecordAgentMessageSnapshotIngress(workspaceId, threadId, item);
      captureTurnItemDiagnostic(workspaceId, threadId, "started", item);
    },
    [
      captureTurnItemDiagnostic,
      dispatch,
      isRealtimeTurnTerminalExact,
      maybeRecordAgentMessageSnapshotIngress,
      noteCodexTurnProgressEvidence,
      onItemStarted,
      shouldSkipCodexTurnEvent,
    ],
  );

  const onItemUpdatedTracked = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      const eventTurnId = extractTurnIdFromRawItem(item);
      if (eventTurnId && isRealtimeTurnTerminalExact(threadId, eventTurnId)) {
        return;
      }
      if (
        shouldSkipCodexTurnEvent({
          engine: inferRawItemEngine(threadId, item),
          workspaceId,
          threadId,
          turnId: eventTurnId,
          operation: "itemUpdated",
          sourceMethod: "item/updated",
        })
      ) {
        return;
      }
      onItemUpdated(workspaceId, threadId, item);
      dispatch({ type: "markContinuationEvidence", threadId });
      noteCodexTurnProgressEvidence(workspaceId, threadId, "item-updated");
      maybeRecordAgentMessageSnapshotIngress(workspaceId, threadId, item);
      captureTurnItemDiagnostic(workspaceId, threadId,
        "updated", item);
      flushDeferredTurnCompletionRef.current?.(threadId, "item-terminal");
    },
    [
      captureTurnItemDiagnostic,
      dispatch,
      isRealtimeTurnTerminalExact,
      maybeRecordAgentMessageSnapshotIngress,
      noteCodexTurnProgressEvidence,
      onItemUpdated,
      shouldSkipCodexTurnEvent,
    ],
  );

  const onItemCompletedTracked = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      const eventTurnId = extractTurnIdFromRawItem(item);
      if (eventTurnId && isRealtimeTurnTerminalExact(threadId, eventTurnId)) {
        return;
      }
      if (
        shouldSkipCodexTurnEvent({
          engine: inferRawItemEngine(threadId, item),
          workspaceId,
          threadId,
          turnId: eventTurnId,
          operation: "itemCompleted",
          sourceMethod: "item/completed",
        })
      ) {
        return;
      }
      onItemCompleted(workspaceId, threadId, item);
      dispatch({ type: "markContinuationEvidence", threadId });
      noteCodexTurnProgressEvidence(workspaceId, threadId, "item-completed");
      captureTurnItemDiagnostic(workspaceId, threadId,
        "completed", item);
      flushDeferredTurnCompletionRef.current?.(threadId, "item-terminal");
    },
    [
      captureTurnItemDiagnostic,
      dispatch,
      isRealtimeTurnTerminalExact,
      noteCodexTurnProgressEvidence,
      onItemCompleted,
      shouldSkipCodexTurnEvent,
    ],
  );

  const shouldSkipLateCodexNormalizedEvent = useCallback(
    (event: NormalizedThreadEvent) => {
      return shouldSkipCodexTurnEvent({
        engine: event.engine,
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        turnId: asString(event.turnId).trim(),
        operation: event.operation,
        sourceMethod: event.sourceMethod,
      });
    },
    [shouldSkipCodexTurnEvent],
  );

  const onNormalizedRealtimeEventTracked = useCallback(
    (event: NormalizedThreadEvent) => {
      if (
        event.turnId &&
        isRealtimeTurnTerminalExact(event.threadId, event.turnId)
      ) {
        return;
      }
      if (shouldSkipLateCodexNormalizedEvent(event)) {
        return;
      }
      onNormalizedRealtimeEvent(event);
      dispatch({ type: "markContinuationEvidence", threadId: event.threadId });
      noteCodexTurnProgressEvidence(event.workspaceId, event.threadId, `normalized:${event.operation}`);
      if (event.operation === "appendAgentMessageDelta") {
        const textLength =
          event.delta?.length ??
          (event.item.kind === "message" ? event.item.text.length : 0);
        if (textLength > 0 && event.item.kind === "message") {
          recordAssistantStreamIngress({
            workspaceId: event.workspaceId,
            threadId: event.threadId,
            itemId: event.item.id,
            textLength,
            source:
              event.sourceMethod === "item/started" ||
              event.sourceMethod === "item/updated"
                ? "snapshot"
                : "delta",
          });
        }
      }
      if (event.operation === "appendToolOutputDelta" && event.item.kind === "tool") {
        noteNonTextRuntimeProgress(event.threadId, "normalized-tool-output-delta", {
          itemType: event.item.toolType,
          itemId: event.item.id,
          itemEventKind: "output-delta",
          outputLength: (event.delta ?? event.item.output ?? "").length,
        });
      }
      if (
        event.operation === "completeAgentMessage" &&
        event.item.kind === "message" &&
        event.item.role === "assistant" &&
        event.item.text.length > 0
      ) {
        recordAssistantStreamIngress({
          workspaceId: event.workspaceId,
          threadId: event.threadId,
          itemId: event.item.id,
          textLength: event.item.text.length,
          source: "completion",
        });
        recordAssistantCompletionEvidence(event.threadId, event.item.id);
        flushDeferredTurnCompletionRef.current?.(
          event.threadId,
          "assistant-completed",
        );
      }
      if (!event.rawItem) {
        return;
      }
      if (event.operation === "itemStarted" || event.operation === "itemUpdated") {
        maybeRecordAgentMessageSnapshotIngress(
          event.workspaceId,
          event.threadId,
          event.rawItem,
        );
      }
      if (event.operation === "itemStarted") {
        captureTurnItemDiagnostic(event.workspaceId, event.threadId,
        "started", event.rawItem);
        return;
      }
      if (event.operation === "itemUpdated") {
        captureTurnItemDiagnostic(event.workspaceId, event.threadId,
        "updated", event.rawItem);
        flushDeferredTurnCompletionRef.current?.(event.threadId, "item-terminal");
        return;
      }
      if (event.operation === "itemCompleted") {
        captureTurnItemDiagnostic(event.workspaceId, event.threadId,
        "completed", event.rawItem);
        flushDeferredTurnCompletionRef.current?.(event.threadId, "item-terminal");
      }
    },
    [
      captureTurnItemDiagnostic,
      dispatch,
      isRealtimeTurnTerminalExact,
      maybeRecordAgentMessageSnapshotIngress,
      noteCodexTurnProgressEvidence,
      noteNonTextRuntimeProgress,
      onNormalizedRealtimeEvent,
      recordAssistantCompletionEvidence,
      recordAssistantStreamIngress,
      shouldSkipLateCodexNormalizedEvent,
    ],
  );

  const onCommandOutputDeltaTracked = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      turnId?: string | null,
    ) => {
      onCommandOutputDelta(workspaceId, threadId, itemId, delta, turnId);
      if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        return;
      }
      noteNonTextRuntimeProgress(threadId, "command-output-delta", {
        itemType: "commandExecution",
        itemId,
        itemEventKind: "output-delta",
        outputLength: delta.length,
      });
    },
    [interruptedThreadsRef, noteNonTextRuntimeProgress, onCommandOutputDelta],
  );

  const onFileChangeOutputDeltaTracked = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      delta: string,
      turnId?: string | null,
    ) => {
      onFileChangeOutputDelta(workspaceId, threadId, itemId, delta, turnId);
      if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        return;
      }
      noteNonTextRuntimeProgress(threadId, "file-change-output-delta", {
        itemType: "fileChange",
        itemId,
        itemEventKind: "output-delta",
        outputLength: delta.length,
      });
    },
    [interruptedThreadsRef, noteNonTextRuntimeProgress, onFileChangeOutputDelta],
  );

  const onTerminalInteractionTracked = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      stdin: string,
      turnId?: string | null,
    ) => {
      onTerminalInteraction(workspaceId, threadId, itemId, stdin, turnId);
      if (workspaceScopedHas(interruptedThreadsRef.current, workspaceId, threadId)) {
        return;
      }
      noteNonTextRuntimeProgress(threadId, "terminal-interaction", {
        itemType: "commandExecution",
        itemId,
        itemEventKind: "output-delta",
        outputLength: stdin.length,
      });
    },
    [interruptedThreadsRef, noteNonTextRuntimeProgress, onTerminalInteraction],
  );

  const finalizeTurnDiagnostic = useCallback(
    (
      threadId: string,
      finalState: "completed" | "error",
      payload?: Record<string, unknown>,
    ) => {
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      clearFirstDeltaTimer(threadId);
      clearTurnStallTimer(threadId);
      clearCodexNoProgressTimer(threadId);
      if (!diagnostic) {
        return;
      }
      const now = Date.now();
      if (finalState === "completed") {
        diagnostic.completedAt = now;
      } else {
        diagnostic.errorAt = now;
      }
      const rawMessage =
        typeof payload?.message === "string" ? payload.message : null;
      const firstPacketTimeoutSeconds =
        rawMessage ? parseFirstPacketTimeoutSeconds(rawMessage) : null;
      if (diagnostic.firstDeltaAt === null && finalState === "error") {
        reportThreadUpstreamPending(threadId, {
          elapsedMs: Math.max(0, now - diagnostic.startedAt),
          diagnosticCategory:
            firstPacketTimeoutSeconds !== null
              ? "first-packet-timeout"
              : "first-token-delay",
          reason: firstPacketTimeoutSeconds !== null ? "first-packet-timeout" : "turn-error",
          firstPacketTimeoutSeconds,
          message: rawMessage,
        });
      }
      const lifecycle = getThreadLifecycleSnapshot(threadId);
      const suspectedDurationMs =
        diagnostic.noProgressSuspectedAt === null
          ? null
          : Math.max(0, now - diagnostic.noProgressSuspectedAt);
      emitTurnDiagnostic(finalState, {
        workspaceId: diagnostic.workspaceId,
        threadId,
        turnId: diagnostic.turnId,
        elapsedMs: Math.max(0, now - diagnostic.startedAt),
        firstDeltaAtMs:
          diagnostic.firstDeltaAt === null
            ? null
            : Math.max(0, diagnostic.firstDeltaAt - diagnostic.startedAt),
        firstItemAtMs:
          diagnostic.firstItemEventAt === null
            ? null
            : Math.max(0, diagnostic.firstItemEventAt - diagnostic.startedAt),
        firstItemEventKind: diagnostic.firstItemEventKind,
        firstItemType: diagnostic.firstItemType,
        firstExecutionAtMs:
          diagnostic.firstExecutionAt === null
            ? null
            : Math.max(0, diagnostic.firstExecutionAt - diagnostic.startedAt),
        firstExecutionEventKind: diagnostic.firstExecutionEventKind,
        firstExecutionItemType: diagnostic.firstExecutionItemType,
        firstExecutionItemId: diagnostic.firstExecutionItemId,
        deltaCount: diagnostic.deltaCount,
        itemEventCount: diagnostic.itemEventCount,
        stalledAfterFirstDelta: diagnostic.stallReported,
        lastProgressSource: diagnostic.lastProgressSource,
        lastProgressAgeMs: Math.max(0, now - diagnostic.lastProgressAt),
        progressSequence: diagnostic.progressSequence,
        wasNoProgressSuspected: diagnostic.noProgressSuspectedAt !== null,
        noProgressSuspectedSource: diagnostic.noProgressSuspectedSource,
        suspectedDurationMs,
        isProcessing: lifecycle.isProcessing,
        activeTurnId: lifecycle.activeTurnId,
        firstPacketTimeoutSeconds,
        ...buildThreadStreamCorrelationDimensions(threadId),
        ...payload,
      }, { force: finalState === "error" || diagnostic.stallReported });
      turnDiagnosticsRef.current.delete(threadId);
      clearAssistantSnapshotIngressForThread(threadId);
      completeThreadStreamTurn(threadId);
    },
    [
      clearAssistantSnapshotIngressForThread,
      clearFirstDeltaTimer,
      clearTurnStallTimer,
      clearCodexNoProgressTimer,
      emitTurnDiagnostic,
      getThreadLifecycleSnapshot,
    ],
  );

  const settleCompletedTurn = useCallback(
    (workspaceId: string, threadId: string, normalizedTurnId: string) => {
      markRealtimeTurnTerminal(threadId, normalizedTurnId);
      const handled = onTurnCompleted(workspaceId, threadId, normalizedTurnId);
      let fallbackApplied = false;
      if (handled) {
        onTurnCompletedExternal?.({ workspaceId, threadId, turnId: normalizedTurnId });
        onTurnTerminalExternal?.({
          workspaceId,
          threadId,
          turnId: normalizedTurnId,
          status: "completed",
        });
      }
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (!handled && diagnostic && diagnostic.assistantCompletedAt !== null) {
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        const canFallbackSettle =
          !normalizedTurnId ||
          lifecycle.activeTurnId === null ||
          lifecycle.activeTurnId === normalizedTurnId;
        if (canFallbackSettle) {
          dispatch({
            type: "clearProcessingGeneratedImages",
            threadId,
          });
          dispatch({ type: "markTerminalSettlement", threadId });
          dispatch({
            type: "finalizePendingToolStatuses",
            threadId,
            status: "completed",
          });
          dispatch({
            type: "markContextCompacting",
            threadId,
            isCompacting: false,
            timestamp: Date.now(),
          });
          dispatch({
            type: "settleThreadPlanInProgress",
            threadId,
            targetStatus: "completed",
          });
          markProcessingTracked(threadId, false);
          setActiveTurnIdTracked(threadId, null);
          workspaceScopedDelete(pendingInterruptsRef.current, workspaceId, threadId);
          workspaceScopedDelete(interruptedThreadsRef.current, workspaceId, threadId);
          dispatch({ type: "resetAgentSegment", threadId });
          dispatch({ type: "markLatestAssistantMessageFinal", threadId });
          onTurnCompletedExternal?.({
            workspaceId,
            threadId,
            turnId: normalizedTurnId,
          });
          onTurnTerminalExternal?.({
            workspaceId,
            threadId,
            turnId: normalizedTurnId,
            status: "completed",
          });
          fallbackApplied = true;
          emitTurnDiagnostic("terminal-settlement-fallback-applied", {
            workspaceId,
            threadId,
            turnId: normalizedTurnId,
            elapsedMs: Math.max(0, Date.now() - diagnostic.startedAt),
            assistantCompletedAtMs:
              diagnostic.assistantCompletedAt === null
                ? null
                : Math.max(0, diagnostic.assistantCompletedAt - diagnostic.startedAt),
            assistantCompletedItemId: diagnostic.assistantCompletedItemId,
            isProcessing: lifecycle.isProcessing,
            activeTurnId: lifecycle.activeTurnId,
            diagnosticCategory: "frontend-terminal-settlement",
            reason: "turn-completed-settlement-fallback-applied",
            ...buildThreadStreamCorrelationDimensions(threadId),
          }, { force: true });
        } else {
          emitTurnDiagnostic("terminal-settlement-rejected", {
            workspaceId,
            threadId,
            turnId: normalizedTurnId,
            elapsedMs: Math.max(0, Date.now() - diagnostic.startedAt),
            assistantCompletedAtMs:
              diagnostic.assistantCompletedAt === null
                ? null
                : Math.max(0, diagnostic.assistantCompletedAt - diagnostic.startedAt),
            assistantCompletedItemId: diagnostic.assistantCompletedItemId,
            isProcessing: lifecycle.isProcessing,
            activeTurnId: lifecycle.activeTurnId,
            diagnosticCategory: "frontend-terminal-settlement",
            reason: "turn-completed-settlement-rejected",
            ...buildThreadStreamCorrelationDimensions(threadId),
          }, { force: true });
        }
      }
      const postSettlementLifecycle = getThreadLifecycleSnapshot(threadId);
      emitThreeEvidenceDryRunDiagnostic({
        workspaceId,
        threadId,
        turnId: normalizedTurnId,
        terminalKind: "completed",
        sourceMethod: "turn/completed",
        lifecycle: postSettlementLifecycle,
        diagnostic: diagnostic ?? undefined,
        handled,
        fallbackApplied,
      });
      if (
        postSettlementLifecycle.isProcessing ||
        (
          normalizedTurnId &&
          postSettlementLifecycle.activeTurnId === normalizedTurnId
        )
      ) {
        const now = Date.now();
        emitForegroundSettlementDiagnostic("terminal-settlement-busy-residue", {
          workspaceId,
          threadId,
          turnId: normalizedTurnId,
          handled,
          fallbackApplied,
          isProcessing: postSettlementLifecycle.isProcessing,
          activeTurnId: postSettlementLifecycle.activeTurnId,
          lastProgressSource: diagnostic?.lastProgressSource ?? null,
          lastProgressAgeMs: diagnostic ? Math.max(0, now - diagnostic.lastProgressAt) : null,
          progressSequence: diagnostic?.progressSequence ?? null,
          wasNoProgressSuspected: Boolean(
            diagnostic && diagnostic.noProgressSuspectedAt !== null,
          ),
          reason: "terminal-event-handled-but-foreground-state-remains-busy",
          ...buildThreadStreamCorrelationDimensions(threadId),
        });
      }
      if (diagnostic && diagnostic.turnId !== normalizedTurnId) {
        return handled || fallbackApplied;
      }
      emitTurnDomainEvent(
        workspaceId,
        threadId,
        normalizedTurnId,
        "completed",
        {
          durationMs: diagnostic ? Math.max(0, Date.now() - diagnostic.startedAt) : null,
        },
      );
      finalizeTurnDiagnostic(threadId, "completed");
      return handled || fallbackApplied;
    },
    [
      dispatch,
      emitThreeEvidenceDryRunDiagnostic,
      emitTurnDiagnostic,
      emitForegroundSettlementDiagnostic,
      emitTurnDomainEvent,
      finalizeTurnDiagnostic,
      getThreadLifecycleSnapshot,
      interruptedThreadsRef,
      markRealtimeTurnTerminal,
      markProcessingTracked,
      onTurnCompleted,
      onTurnCompletedExternal,
      onTurnTerminalExternal,
      pendingInterruptsRef,
      setActiveTurnIdTracked,
    ],
  );

  const deferCodexTurnCompletionIfBlocked = useCallback(
    (workspaceId: string, threadId: string, normalizedTurnId: string) => {
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (
        inferThreadEngine(threadId) !== "codex" ||
        !diagnostic ||
        !normalizedTurnId ||
        diagnostic.turnId !== normalizedTurnId
      ) {
        return false;
      }
      const blockers = listDeferredCompletionBlockers(diagnostic);
      if (blockers.length === 0) {
        return false;
      }
      const now = Date.now();
      const assistantCompletedAt = diagnostic.assistantCompletedAt;
      if (assistantCompletedAt !== null) {
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        emitTurnDiagnostic("turn-completed-deferred-bypassed", {
          workspaceId,
          threadId,
          turnId: normalizedTurnId,
          elapsedMs: Math.max(0, now - diagnostic.startedAt),
          assistantCompletedAtMs: Math.max(
            0,
            assistantCompletedAt - diagnostic.startedAt,
          ),
          assistantCompletedItemId: diagnostic.assistantCompletedItemId,
          blockerCount: blockers.length,
          remainingBlockers: blockers,
          isProcessing: lifecycle.isProcessing,
          activeTurnId: lifecycle.activeTurnId,
          diagnosticCategory: "codex-collab-terminal-order",
          reason:
            "turn/completed arrived after final assistant text with remaining Codex collaboration blockers",
          ...buildThreadStreamCorrelationDimensions(threadId),
        }, { force: true });
        return false;
      }
      if (diagnostic.firstDeltaAt !== null || diagnostic.deltaCount > 0) {
        const lifecycle = getThreadLifecycleSnapshot(threadId);
        emitTurnDiagnostic("turn-completed-deferred-bypassed", {
          workspaceId,
          threadId,
          turnId: normalizedTurnId,
          elapsedMs: Math.max(0, now - diagnostic.startedAt),
          firstDeltaAtMs:
            diagnostic.firstDeltaAt === null
              ? null
              : Math.max(0, diagnostic.firstDeltaAt - diagnostic.startedAt),
          deltaCount: diagnostic.deltaCount,
          blockerCount: blockers.length,
          remainingBlockers: blockers,
          isProcessing: lifecycle.isProcessing,
          activeTurnId: lifecycle.activeTurnId,
          diagnosticCategory: "codex-collab-terminal-order",
          reason:
            "turn/completed arrived after assistant stream ingress with remaining Codex collaboration blockers",
          ...buildThreadStreamCorrelationDimensions(threadId),
        }, { force: true });
        return false;
      }
      diagnostic.deferredCompletion = diagnostic.deferredCompletion ?? {
        workspaceId,
        threadId,
        turnId: normalizedTurnId,
        deferredAt: now,
      };
      const lifecycle = getThreadLifecycleSnapshot(threadId);
      emitTurnDiagnostic("turn-completed-deferred", {
        workspaceId,
        threadId,
        turnId: normalizedTurnId,
        elapsedMs: Math.max(0, now - diagnostic.startedAt),
        blockerCount: blockers.length,
        blockers,
        isProcessing: lifecycle.isProcessing,
        activeTurnId: lifecycle.activeTurnId,
        diagnosticCategory: "codex-collab-terminal-order",
        reason: "turn/completed arrived while Codex collaboration child agents were still active",
        ...buildThreadStreamCorrelationDimensions(threadId),
      }, { force: true });
      return true;
    },
    [emitTurnDiagnostic, getThreadLifecycleSnapshot],
  );

  const flushDeferredTurnCompletionIfReady = useCallback(
    (threadId: string, source: DeferredCompletionFlushSource) => {
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      const completion = diagnostic?.deferredCompletion ?? null;
      if (!diagnostic || !completion) {
        return;
      }
      const blockers = listDeferredCompletionBlockers(diagnostic);
      const forcedByAssistantCompletion =
        source === "assistant-completed" && blockers.length > 0;
      if (blockers.length > 0 && !forcedByAssistantCompletion) {
        return;
      }
      diagnostic.deferredCompletion = null;
      const now = Date.now();
      emitTurnDiagnostic("turn-completed-deferred-flushed", {
        workspaceId: completion.workspaceId,
        threadId: completion.threadId,
        turnId: completion.turnId,
        deferredMs: Math.max(0, now - completion.deferredAt),
        elapsedMs: Math.max(0, now - diagnostic.startedAt),
        source,
        forcedByAssistantCompletion,
        remainingBlockers: forcedByAssistantCompletion ? blockers : [],
        diagnosticCategory: "codex-collab-terminal-order",
        ...buildThreadStreamCorrelationDimensions(threadId),
      }, { force: true });
      settleCompletedTurn(completion.workspaceId, completion.threadId, completion.turnId);
    },
    [emitTurnDiagnostic, settleCompletedTurn],
  );
  flushDeferredTurnCompletionRef.current = flushDeferredTurnCompletionIfReady;

  const onTurnCompletedTracked = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      const normalizedTurnId = turnId.trim();
      flushPendingRealtimeEvents();
      if (deferCodexTurnCompletionIfBlocked(workspaceId, threadId, normalizedTurnId)) {
        return;
      }
      settleCompletedTurn(workspaceId, threadId, normalizedTurnId);
    },
    [deferCodexTurnCompletionIfBlocked, flushPendingRealtimeEvents, settleCompletedTurn],
  );

  const onTurnErrorTracked = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: {
        message: string;
        willRetry: boolean;
        engine?: ConversationEngine | null;
      },
    ) => {
      const normalizedTurnId = turnId.trim();
      flushPendingRealtimeEvents();
      markRealtimeTurnTerminal(threadId, normalizedTurnId);
      onTurnError(workspaceId, threadId, normalizedTurnId, payload);
      if (payload.willRetry) {
        return;
      }
      quarantineCodexTurn(
        workspaceId,
        threadId,
        normalizedTurnId,
        "turn-error",
        "turn/error",
        payload.engine,
      );
      onTurnTerminalExternal?.({
        workspaceId,
        threadId,
        turnId: normalizedTurnId,
        status: "error",
      });
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (diagnostic && diagnostic.turnId !== normalizedTurnId) {
        return;
      }
      emitTurnDomainEvent(workspaceId, threadId, normalizedTurnId, "failed", {
        errorMessage: payload.message,
      });
      finalizeTurnDiagnostic(threadId, "error", {
        message: payload.message,
        willRetry: payload.willRetry,
      });
    },
    [
      finalizeTurnDiagnostic,
      emitTurnDomainEvent,
      flushPendingRealtimeEvents,
      markRealtimeTurnTerminal,
      onTurnError,
      onTurnTerminalExternal,
      quarantineCodexTurn,
    ],
  );

  const onTurnStalledTracked = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: {
        message: string;
        reasonCode: string;
        stage: string;
        source: string;
        startedAtMs: number | null;
        timeoutMs: number | null;
        engine?: ConversationEngine | null;
      },
    ) => {
      const normalizedTurnId = turnId.trim();
      flushPendingRealtimeEvents();
      markRealtimeTurnTerminal(threadId, normalizedTurnId);
      onTurnStalled(workspaceId, threadId, normalizedTurnId, payload);
      quarantineCodexTurn(
        workspaceId,
        threadId,
        normalizedTurnId,
        payload.reasonCode || "turn-stalled",
        payload.source || "turn/stalled",
        payload.engine,
      );
      onTurnTerminalExternal?.({
        workspaceId,
        threadId,
        turnId: normalizedTurnId,
        status: "stalled",
      });
      const diagnostic = turnDiagnosticsRef.current.get(threadId);
      if (diagnostic && diagnostic.turnId !== normalizedTurnId) {
        return;
      }
      emitTurnDomainEvent(workspaceId, threadId, normalizedTurnId, "failed", {
        errorMessage: payload.message,
      });
      finalizeTurnDiagnostic(threadId, "error", {
        message: payload.message,
        diagnosticCategory: "resume_stalled",
        reasonCode: payload.reasonCode,
        stage: payload.stage,
        source: payload.source,
        startedAtMs: payload.startedAtMs,
        timeoutMs: payload.timeoutMs,
      });
    },
    [
      finalizeTurnDiagnostic,
      emitTurnDomainEvent,
      flushPendingRealtimeEvents,
      markRealtimeTurnTerminal,
      onTurnStalled,
      onTurnTerminalExternal,
      quarantineCodexTurn,
    ],
  );

  const onAppServerEvent = useCallback(
    (event: AppServerEvent) => {
      handleThreadAppServerEventDiagnostics({
        event,
        onDebug,
        getThreadLifecycleSnapshot,
        getExpectedTurnId: (threadId) =>
          turnDiagnosticsRef.current.get(threadId)?.turnId ??
          getThreadLifecycleSnapshot(threadId).activeTurnId,
        emitForegroundSettlementDiagnostic,
        noteCodexTurnProgressEvidence,
      });
    },
    [
      emitForegroundSettlementDiagnostic,
      getThreadLifecycleSnapshot,
      onDebug,
      noteCodexTurnProgressEvidence,
    ],
  );

  const handlers = useMemo(
    () => ({
      onWorkspaceConnected,
      onApprovalRequest,
      onRequestUserInput,
      onModeBlocked,
      onModeResolved,
      onBackgroundThreadAction,
      onAppServerEvent,
      onAgentMessageDelta: onAgentMessageDeltaTracked,
      onAgentMessageCompleted: onAgentMessageCompletedTracked,
      onNormalizedRealtimeEvent: onNormalizedRealtimeEventTracked,
      onItemStarted: onItemStartedTracked,
      onItemUpdated: onItemUpdatedTracked,
      onItemCompleted: onItemCompletedTracked,
      onReasoningSummaryDelta,
      onReasoningSummaryBoundary,
      onReasoningTextDelta,
      onCommandOutputDelta: onCommandOutputDeltaTracked,
      onTerminalInteraction: onTerminalInteractionTracked,
      onFileChangeOutputDelta: onFileChangeOutputDeltaTracked,
      onThreadStarted,
      onTurnStarted: onTurnStartedTracked,
      onTurnCompleted: onTurnCompletedTracked,
      onProcessingHeartbeat,
      onTurnPlanUpdated,
      onThreadTokenUsageUpdated: onThreadTokenUsageUpdatedTracked,
      onAccountRateLimitsUpdated,
      onTurnError: onTurnErrorTracked,
      onTurnStalled: onTurnStalledTracked,
      onContextCompacting,
      onContextCompacted,
      onContextCompactionFailed,
      onThreadSessionIdUpdated,
    }),
    [
      onWorkspaceConnected,
      onApprovalRequest,
      onRequestUserInput,
      onModeBlocked,
      onModeResolved,
      onBackgroundThreadAction,
      onAppServerEvent,
      onAgentMessageDeltaTracked,
      onAgentMessageCompletedTracked,
      onNormalizedRealtimeEventTracked,
      onItemStartedTracked,
      onItemUpdatedTracked,
      onItemCompletedTracked,
      onReasoningSummaryDelta,
      onReasoningSummaryBoundary,
      onReasoningTextDelta,
      onCommandOutputDeltaTracked,
      onTerminalInteractionTracked,
      onFileChangeOutputDeltaTracked,
      onThreadStarted,
      onTurnStartedTracked,
      onTurnCompletedTracked,
      onProcessingHeartbeat,
      onTurnPlanUpdated,
      onThreadTokenUsageUpdatedTracked,
      onAccountRateLimitsUpdated,
      onTurnErrorTracked,
      onTurnStalledTracked,
      onContextCompacting,
      onContextCompacted,
      onContextCompactionFailed,
      onThreadSessionIdUpdated,
    ],
  );

  return handlers;
}
