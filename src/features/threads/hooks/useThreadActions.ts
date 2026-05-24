import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type {
  ConversationItem,
  DebugEntry,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import {
  connectWorkspace as connectWorkspaceService,
  listThreadTitles as listThreadTitlesService,
  listThreads as listThreadsService,
  listClaudeSessions as listClaudeSessionsForFallbackSeedService,
  listGeminiSessions as listGeminiSessionsService,
  getOpenCodeSessionList as getOpenCodeSessionListService,
  loadClaudeSession as loadClaudeSessionService,
  loadGeminiSession as loadGeminiSessionService,
  loadCodexSession as loadCodexSessionService,
  resumeThread as resumeThreadService,
} from "../../../services/tauri";
import type { WorkspaceSessionCatalogSourceStatus } from "../../../services/tauri";
import * as tauriServices from "../../../services/tauri";
import {
  buildItemsFromThread,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import {
  createClaudeHistoryLoader,
  parseClaudeHistoryMessages,
} from "../loaders/claudeHistoryLoader";
import { createCodexHistoryLoader } from "../loaders/codexHistoryLoader";
import { createGeminiHistoryLoader } from "../loaders/geminiHistoryLoader";
import { parseGeminiHistoryMessages } from "../loaders/geminiHistoryParser";
import { createOpenCodeHistoryLoader } from "../loaders/opencodeHistoryLoader";
import { createSharedHistoryLoader } from "../loaders/sharedHistoryLoader";
import { hydrateHistory } from "../assembly/conversationAssembler";
import {
  listSharedSessions as listSharedSessionsService,
  loadSharedSession as loadSharedSessionService,
} from "../../shared-session/services/sharedSessions";
import {
  normalizeSharedSessionSummaries,
  toSharedThreadSummary,
} from "../../shared-session/runtime/sharedSessionSummaries";
import { asString } from "../utils/threadNormalize";
import { saveThreadActivity } from "../utils/threadStorage";
import {
  collectKnownCodexThreadIds,
  normalizeComparableWorkspacePath,
} from "./useThreadActions.workspacePath";
import {
  useAutomaticRuntimeRecovery,
  type AutomaticRuntimeRecoverySource,
} from "./useAutomaticRuntimeRecovery";
import {
  createArchiveClaudeThreadAction,
  createArchiveThreadAction,
  createDeleteThreadForWorkspaceAction,
  createRenameThreadTitleMappingAction,
} from "./useThreadActions.sessionActions";
import {
  createThreadHistoryContinuationDecisionDebugEntry,
  createThreadHistoryReadableSurfaceDebugEntry,
} from "./useThreadActions.recoveryDiagnostics";
import {
  collectRelatedThreadIdsFromSnapshot,
  extractThreadSizeBytes,
  filterRetainableContinuitySummaries,
  hasHealthyThreadSummaries,
  inferThreadEngineSource,
  isAskUserQuestionToolItem,
  isLocalSessionScanUnavailable,
  isPendingThreadId,
  isRetainableEngineContinuitySummary,
  isTerminalToolStatus,
  isThreadResumeNotFoundError,
  isWorkspaceNotConnectedError,
  mapWithConcurrency,
  markThreadSummariesDegraded,
  mergeCodexCatalogSessionSummaries,
  mergeDegradedCodexContinuitySummaries,
  mergeDegradedClaudeContinuitySummaries,
  mergeGeminiSessionSummaries,
  mergeThreadSummaryPreservingStableIdentity,
  mergeRecoveredThreadSummaries,
  normalizeGeminiSessionSummaries,
  normalizeThreadListPartialSource,
  resolveThreadSourceMeta,
  restoreThreadParentLinksFromSnapshot,
  seedLastGoodClaudeIntoMerged,
  seedLastGoodOpenCodeIntoMerged,
  listReplacementThreadCandidates,
  selectRecoveredNewThreadDecision,
  selectReplacementThreadByMessageHistoryDecision,
  selectReplacementThreadDecision,
  shouldApplyCodexSidebarContinuity,
  shouldApplyClaudeSidebarContinuity,
  shouldIncludeWorkspaceThreadEntry,
  shouldReplaceUserInputQueueFromSnapshot,
  withTimeout,
  type GeminiSessionSummary,
  type ThreadRecoveryDecision,
} from "./useThreadActions.helpers";
import {
  buildPartialHistoryDiagnostic,
  resolveThreadStabilityDiagnostic,
} from "../utils/stabilityDiagnostics";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";
import { buildThreadDebugCorrelation } from "../utils/threadDebugCorrelation";
import { useThreadActionsSessionRuntime } from "./useThreadActionsSessionRuntime";
import {
  useThreadActionsSessionCatalog,
  type ArchivedSessionMapResult,
} from "./useThreadActionsSessionCatalog";
import { useLoadOlderThreadsForWorkspace } from "./useThreadActionsLoadOlder";
import { useThreadHistoryLoadingState } from "./useThreadHistoryLoadingState";
import {
  DEFAULT_CLAUDE_CONTEXT_WINDOW,
  GEMINI_SESSION_CACHE_TTL_MS,
  GEMINI_SESSION_FETCH_TIMEOUT_MS,
  NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
  RELATED_THREAD_LOAD_CONCURRENCY,
  THREAD_LIST_LIVE_REQUEST_TIMEOUT_MS,
  THREAD_LIST_MAX_EMPTY_PAGES,
  THREAD_LIST_MAX_EMPTY_PAGES_WITH_ACTIVITY,
  THREAD_LIST_MAX_FETCH_DURATION_MS,
  THREAD_LIST_MAX_TOTAL_PAGES,
  THREAD_LIST_PAGE_SIZE,
  THREAD_LIST_TARGET_COUNT,
  THREAD_RECOVERY_HISTORY_MATCH_CANDIDATES,
  THREAD_RECOVERY_MAX_FETCH_DURATION_MS,
  THREAD_RECOVERY_MAX_PAGES,
  countCatalogSessionsByEngine,
  countSummariesByEngine,
  resolveNativeSessionListLimit,
  resolveThreadListCursorForDisplay,
  type StartupThreadHydrationMode,
} from "./useThreadActions.threadList";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";

type UseThreadActionsOptions = {
  dispatch: Dispatch<ThreadAction>;
  itemsByThread: ThreadState["itemsByThread"];
  userInputRequests: ThreadState["userInputRequests"];
  threadsByWorkspace: ThreadState["threadsByWorkspace"];
  activeThreadIdByWorkspace: ThreadState["activeThreadIdByWorkspace"];
  threadListCursorByWorkspace: ThreadState["threadListCursorByWorkspace"];
  threadStatusById: ThreadState["threadStatusById"];
  onDebug?: (entry: DebugEntry) => void;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  threadActivityRef: MutableRefObject<Record<string, Record<string, number>>>;
  loadedThreadsRef: MutableRefObject<Record<string, boolean>>;
  replaceOnResumeRef: MutableRefObject<Record<string, boolean>>;
  applyCollabThreadLinksFromThread: (
    threadId: string,
    thread: Record<string, unknown>,
  ) => void;
  updateThreadParent?: (parentId: string, childIds: string[]) => void;
  onThreadTitleMappingsLoaded?: (
    workspaceId: string,
    titles: Record<string, string>,
  ) => void;
  onRenameThreadTitleMapping?: (
    workspaceId: string,
    oldThreadId: string,
    newThreadId: string,
  ) => void;
  rememberThreadAlias?: (oldThreadId: string, newThreadId: string) => void;
  clearThreadAlias?: (oldThreadId: string) => void;
  resolveWorkspacePath?: (workspaceId: string) => string | null;
  useUnifiedHistoryLoader?: boolean;
};

function findCatalogSourceStatusForEngine(
  sourceStatuses: readonly WorkspaceSessionCatalogSourceStatus[] | undefined,
  engine: string,
): WorkspaceSessionCatalogSourceStatus | null {
  const normalizedEngine = engine.trim().toLowerCase();
  if (!normalizedEngine) {
    return null;
  }
  return (
    sourceStatuses?.find(
      (status) => status.engine.trim().toLowerCase() === normalizedEngine,
    ) ?? null
  );
}

function isIncompleteCatalogSourceStatus(
  sourceStatus: WorkspaceSessionCatalogSourceStatus | null,
): boolean {
  return (
    sourceStatus?.completeness === "degraded" ||
    sourceStatus?.completeness === "partial" ||
    sourceStatus?.completeness === "uncertain_empty"
  );
}

function hasAuthoritativeCatalogMembershipProof(
  sourceStatuses: readonly WorkspaceSessionCatalogSourceStatus[] | undefined,
): boolean {
  return (
    Array.isArray(sourceStatuses) &&
    sourceStatuses.length > 0 &&
    sourceStatuses.every(
      (sourceStatus) => !isIncompleteCatalogSourceStatus(sourceStatus),
    )
  );
}

type ThreadEngineSource = NonNullable<ThreadSummary["engineSource"]>;
type LastGoodThreadSummariesByEngine = Partial<
  Record<ThreadEngineSource, ThreadSummary[]>
>;

const THREAD_ENGINE_SOURCES: ThreadEngineSource[] = [
  "codex",
  "claude",
  "opencode",
  "gemini",
];

function resolveThreadSummaryEngine(
  summary: ThreadSummary,
): ThreadEngineSource {
  return (summary.engineSource ??
    inferThreadEngineSource(summary.id, summary) ??
    "codex") as ThreadEngineSource;
}

function isHealthyThreadSummary(summary: ThreadSummary): boolean {
  return !summary.isDegraded && !summary.partialSource && !summary.degradedReason;
}

function healthyThreadSummariesForEngine(
  threads: ThreadSummary[] | undefined,
  engine: ThreadEngineSource,
): ThreadSummary[] {
  if (!Array.isArray(threads) || threads.length === 0) {
    return [];
  }
  const engineThreads = threads.filter(
    (thread) => resolveThreadSummaryEngine(thread) === engine,
  );
  if (engineThreads.length === 0 || engineThreads.some((thread) => !isHealthyThreadSummary(thread))) {
    return [];
  }
  return engineThreads;
}

function flattenLastGoodEngineSnapshots(
  snapshots: LastGoodThreadSummariesByEngine,
): ThreadSummary[] {
  const mergedById = new Map<string, ThreadSummary>();
  THREAD_ENGINE_SOURCES.forEach((engine) => {
    snapshots[engine]?.forEach((summary) => {
      const previous = mergedById.get(summary.id);
      if (!previous || summary.updatedAt >= previous.updatedAt) {
        mergedById.set(summary.id, summary);
      }
    });
  });
  return Array.from(mergedById.values()).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

function resolvePartialSourceEngine(
  source: string,
): ThreadEngineSource | "all" | null {
  const normalized = source.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("archive") || normalized.includes("empty-thread-list")) {
    return "all";
  }
  if (normalized.includes("claude")) {
    return "claude";
  }
  if (normalized.includes("opencode")) {
    return "opencode";
  }
  if (normalized.includes("gemini")) {
    return "gemini";
  }
  if (
    normalized.includes("codex") ||
    normalized.includes("workspace-not-connected") ||
    normalized.includes("thread-list-live")
  ) {
    return "codex";
  }
  return "all";
}

function buildLastGoodSnapshotBlockedEngines(
  sourceStatuses: readonly WorkspaceSessionCatalogSourceStatus[] | undefined,
  partialSources: ReadonlySet<string>,
): Set<ThreadEngineSource> {
  const blocked = new Set<ThreadEngineSource>();
  sourceStatuses?.forEach((sourceStatus) => {
    const engine = sourceStatus.engine.trim().toLowerCase() as ThreadEngineSource;
    if (
      THREAD_ENGINE_SOURCES.includes(engine) &&
      isIncompleteCatalogSourceStatus(sourceStatus)
    ) {
      blocked.add(engine);
    }
  });
  partialSources.forEach((partialSource) => {
    const engine = resolvePartialSourceEngine(partialSource);
    if (engine === "all") {
      THREAD_ENGINE_SOURCES.forEach((item) => blocked.add(item));
    } else if (engine) {
      blocked.add(engine);
    }
  });
  return blocked;
}

type ResumeThreadForWorkspaceOptions = {
  preferLocalCodexHistory?: boolean;
};

export function useThreadActions({
  dispatch,
  itemsByThread,
  userInputRequests,
  threadsByWorkspace,
  activeThreadIdByWorkspace,
  threadListCursorByWorkspace,
  threadStatusById,
  onDebug,
  getCustomName,
  threadActivityRef,
  loadedThreadsRef,
  replaceOnResumeRef,
  applyCollabThreadLinksFromThread,
  updateThreadParent,
  onThreadTitleMappingsLoaded,
  onRenameThreadTitleMapping,
  rememberThreadAlias,
  clearThreadAlias,
  resolveWorkspacePath,
  useUnifiedHistoryLoader = false,
}: UseThreadActionsOptions) {
  const { historyLoadingByThreadId, setThreadHistoryLoading } =
    useThreadHistoryLoadingState();
  // Map workspaceId → filesystem path, populated in listThreadsForWorkspace
  const workspacePathsByIdRef = useRef<Record<string, string>>({});
  const geminiSessionCacheRef = useRef<
    Record<string, { fetchedAt: number; sessions: GeminiSessionSummary[] }>
  >({});
  const geminiRefreshAttemptedRef = useRef<Record<string, boolean>>({});
  const threadListRequestSeqRef = useRef<Record<string, number>>({});
  const lastGoodThreadSummariesByWorkspaceEngineRef = useRef<
    Record<string, LastGoodThreadSummariesByEngine>
  >({});
  const previousThreadsByWorkspaceRef = useRef(threadsByWorkspace);
  const latestThreadsByWorkspaceRef = useRef(threadsByWorkspace);
  if (latestThreadsByWorkspaceRef.current !== threadsByWorkspace) {
    previousThreadsByWorkspaceRef.current = latestThreadsByWorkspaceRef.current;
  }
  latestThreadsByWorkspaceRef.current = threadsByWorkspace;
  const listWorkspaceSessionsService = Object.prototype.hasOwnProperty.call(
    tauriServices,
    "listWorkspaceSessions",
  )
    ? tauriServices.listWorkspaceSessions
    : null;
  const canListWorkspaceSessions =
    typeof listWorkspaceSessionsService === "function";
  const listWorkspaceSessionArchiveEvidenceService =
    Object.prototype.hasOwnProperty.call(
      tauriServices,
      "listWorkspaceSessionArchiveEvidence",
    )
      ? tauriServices.listWorkspaceSessionArchiveEvidence
      : null;
  const { loadActiveProjectCatalogSessions, loadArchivedSessionMap } =
    useThreadActionsSessionCatalog({
      canListWorkspaceSessions,
      listWorkspaceSessionsService,
      listWorkspaceSessionArchiveEvidenceService,
    });
  const {
    beginAutomaticRuntimeRecovery,
    getAutomaticRuntimeRecoveryPartialSource,
  } = useAutomaticRuntimeRecovery(connectWorkspaceService);

  const getLastGoodThreadSummaries = useCallback(
    (workspaceId: string): ThreadSummary[] => {
      const currentThreads = latestThreadsByWorkspaceRef.current[workspaceId];
      if (hasHealthyThreadSummaries(currentThreads)) {
        return currentThreads;
      }
      const previousThreads =
        previousThreadsByWorkspaceRef.current[workspaceId];
      if (hasHealthyThreadSummaries(previousThreads)) {
        return previousThreads;
      }
      const stateThreads = threadsByWorkspace[workspaceId];
      if (hasHealthyThreadSummaries(stateThreads)) {
        return stateThreads;
      }
      const snapshotThreads =
        loadSidebarSnapshot()?.threadsByWorkspace[workspaceId];
      if (hasHealthyThreadSummaries(snapshotThreads)) {
        return snapshotThreads;
      }
      const snapshots: LastGoodThreadSummariesByEngine = {};
      const candidateSources = [
        currentThreads,
        previousThreads,
        stateThreads,
        snapshotThreads,
      ];
      for (const engine of THREAD_ENGINE_SOURCES) {
        const healthyEngineThreads = candidateSources
          .map((threads) => healthyThreadSummariesForEngine(threads, engine))
          .find((threads) => threads.length > 0);
        snapshots[engine] =
          healthyEngineThreads ??
          lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId]?.[
            engine
          ];
      }
      return flattenLastGoodEngineSnapshots(snapshots);
    },
    [threadsByWorkspace],
  );

  const getLastGoodThreadSummariesForEngine = useCallback(
    (workspaceId: string, engine: ThreadEngineSource): ThreadSummary[] => {
      const currentThreads = latestThreadsByWorkspaceRef.current[workspaceId];
      const previousThreads =
        previousThreadsByWorkspaceRef.current[workspaceId];
      const stateThreads = threadsByWorkspace[workspaceId];
      const snapshotThreads =
        loadSidebarSnapshot()?.threadsByWorkspace[workspaceId];
      return (
        [
          currentThreads,
          previousThreads,
          stateThreads,
          snapshotThreads,
        ]
          .map((threads) => healthyThreadSummariesForEngine(threads, engine))
          .find((threads) => threads.length > 0) ??
        lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId]?.[
          engine
        ] ??
        []
      );
    },
    [threadsByWorkspace],
  );

  const rememberLastGoodThreadSummariesByEngine = useCallback(
    (
      workspaceId: string,
      summaries: ThreadSummary[],
      blockedEngines: ReadonlySet<ThreadEngineSource>,
    ) => {
      const currentSnapshots =
        lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId] ?? {};
      const nextSnapshots: LastGoodThreadSummariesByEngine = {
        ...currentSnapshots,
      };
      let changed = false;
      for (const engine of THREAD_ENGINE_SOURCES) {
        if (blockedEngines.has(engine)) {
          continue;
        }
        const healthyEngineThreads = healthyThreadSummariesForEngine(
          summaries,
          engine,
        );
        if (healthyEngineThreads.length === 0) {
          continue;
        }
        nextSnapshots[engine] = healthyEngineThreads;
        changed = true;
      }
      if (!changed) {
        return;
      }
      lastGoodThreadSummariesByWorkspaceEngineRef.current = {
        ...lastGoodThreadSummariesByWorkspaceEngineRef.current,
        [workspaceId]: nextSnapshots,
      };
    },
    [],
  );

  const removeThreadFromCachedSummaries = useCallback(
    (workspaceId: string, threadId: string) => {
      const filterOutThread = (
        source: Record<string, ThreadSummary[] | undefined>,
      ): ThreadSummary[] => {
        const current = source[workspaceId] ?? [];
        return current.filter((entry) => entry.id !== threadId);
      };
      latestThreadsByWorkspaceRef.current = {
        ...latestThreadsByWorkspaceRef.current,
        [workspaceId]: filterOutThread(latestThreadsByWorkspaceRef.current),
      };
      previousThreadsByWorkspaceRef.current = {
        ...previousThreadsByWorkspaceRef.current,
        [workspaceId]: filterOutThread(previousThreadsByWorkspaceRef.current),
      };
      const currentSnapshots =
        lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId];
      if (currentSnapshots) {
        const nextSnapshots: LastGoodThreadSummariesByEngine = {};
        THREAD_ENGINE_SOURCES.forEach((engine) => {
          const nextEngineThreads = (currentSnapshots[engine] ?? []).filter(
            (entry) => entry.id !== threadId,
          );
          if (nextEngineThreads.length > 0) {
            nextSnapshots[engine] = nextEngineThreads;
          }
        });
        lastGoodThreadSummariesByWorkspaceEngineRef.current = {
          ...lastGoodThreadSummariesByWorkspaceEngineRef.current,
          [workspaceId]: nextSnapshots,
        };
      }
    },
    [],
  );

  const reconcileMissingClaudeThread = useCallback(
    (workspaceId: string, threadId: string) => {
      loadedThreadsRef.current[threadId] = false;
      dispatch({
        type: "clearUserInputRequestsForThread",
        workspaceId,
        threadId,
      });
      const isSelectedThread =
        activeThreadIdByWorkspace[workspaceId] === threadId;
      const hasReadableItems = (itemsByThread[threadId]?.length ?? 0) > 0;
      if (isSelectedThread && hasReadableItems) {
        onDebug?.({
          id: `${Date.now()}-claude-history-preserve-readable-surface`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/claude history preserve readable surface",
          payload: {
            workspaceId,
            threadId,
            reason: "selected-readable-surface",
          },
        });
        return true;
      }
      removeThreadFromCachedSummaries(workspaceId, threadId);
      dispatch({ type: "removeThread", workspaceId, threadId });
      return false;
    },
    [
      activeThreadIdByWorkspace,
      dispatch,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      removeThreadFromCachedSummaries,
    ],
  );

  const applySessionArchiveState = useCallback(
    (
      summaries: ThreadSummary[],
      archivedEvidence: ArchivedSessionMapResult | null,
    ): ThreadSummary[] => {
      const isVisibleSessionSummary = (summary: ThreadSummary) =>
        !isPendingThreadId(summary.id) &&
        (!summary.archivedAt || summary.archivedAt <= 0);
      if (!archivedEvidence) {
        return summaries.filter(isVisibleSessionSummary);
      }
      const { archivedAtBySessionId, isComplete } = archivedEvidence;
      const nextSummaries = summaries.map((summary) => {
        const archivedAt = archivedAtBySessionId.get(summary.id) ?? 0;
        if (archivedAt > 0) {
          return { ...summary, archivedAt };
        }
        if ((summary.archivedAt ?? 0) > 0) {
          return summary;
        }
        return isComplete ? { ...summary, archivedAt: undefined } : summary;
      });
      return nextSummaries.filter(isVisibleSessionSummary);
    },
    [],
  );

  const renameThreadTitleMapping = useMemo(
    () =>
      createRenameThreadTitleMappingAction({
        getCustomName,
        onRenameThreadTitleMapping,
      }),
    [getCustomName, onRenameThreadTitleMapping],
  );

  const resumeThreadForWorkspace = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      force = false,
      replaceLocal = false,
      options?: ResumeThreadForWorkspaceOptions,
    ) => {
      if (!threadId) {
        return null;
      }
      const localItems = itemsByThread[threadId] ?? [];
      const status = threadStatusById[threadId];
      if (!force && status?.isProcessing && localItems.length > 0) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-skipped`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/resume skipped",
          payload: { workspaceId, threadId, reason: "active-turn" },
        });
        return threadId;
      }
      const shouldPreserveLocalClaudeRealtimeItems =
        !force &&
        threadId.startsWith("claude:") &&
        localItems.length > 0 &&
        !replaceLocal &&
        replaceOnResumeRef.current[threadId] !== true;
      if (shouldPreserveLocalClaudeRealtimeItems) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-skipped`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/resume skipped",
          payload: {
            workspaceId,
            threadId,
            reason: "local-claude-realtime-items",
          },
        });
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      }
      if (useUnifiedHistoryLoader) {
        const createHistoryLoader = (targetThreadId: string) =>
          targetThreadId.startsWith("shared:")
            ? createSharedHistoryLoader({
                workspaceId,
                loadSharedSession: loadSharedSessionService,
              })
            : targetThreadId.startsWith("claude:")
              ? createClaudeHistoryLoader({
                  workspaceId,
                  workspacePath:
                    workspacePathsByIdRef.current[workspaceId] ?? resolveWorkspacePath?.(workspaceId) ?? null,
                  loadClaudeSession: loadClaudeSessionService,
                })
              : targetThreadId.startsWith("gemini:")
                ? createGeminiHistoryLoader({
                    workspaceId,
                    workspacePath:
                      workspacePathsByIdRef.current[workspaceId] ?? resolveWorkspacePath?.(workspaceId) ?? null,
                    loadGeminiSession: loadGeminiSessionService,
                  })
                : targetThreadId.startsWith("opencode:")
                  ? createOpenCodeHistoryLoader({
                      workspaceId,
                      resumeThread: resumeThreadService,
                    })
                  : createCodexHistoryLoader({
                      workspaceId,
                      resumeThread: resumeThreadService,
                      loadCodexSession: loadCodexSessionService,
                      preferLocalHistory:
                        options?.preferLocalCodexHistory === true,
                    });
        const hydrateHistorySnapshot = async (
          effectiveThreadId: string,
          snapshot: Awaited<
            ReturnType<ReturnType<typeof createHistoryLoader>["load"]>
          >,
        ) => {
          const assembledSnapshot = hydrateHistory(snapshot);
          const snapshotItems = assembledSnapshot.items;
          dispatch({
            type: "ensureThread",
            workspaceId,
            threadId: effectiveThreadId,
            engine: assembledSnapshot.meta.engine,
          });
          if (snapshotItems.length > 0) {
            dispatch({
              type: "setThreadItems",
              threadId: effectiveThreadId,
              items: snapshotItems,
            });
          }
          dispatch({
            type: "setThreadPlan",
            threadId: effectiveThreadId,
            plan: assembledSnapshot.plan,
          });
          dispatch({
            type: "setThreadHistoryRestoredAt",
            threadId: effectiveThreadId,
            timestamp: assembledSnapshot.meta.historyRestoredAtMs,
          });
          const effectiveLocalItems =
            effectiveThreadId === threadId
              ? localItems
              : (itemsByThread[effectiveThreadId] ?? []);
          if (snapshotItems.length === 0) {
            const reopenOutcome =
              effectiveLocalItems.length > 0 ? "degraded-readable" : "failed";
            onDebug?.(
              createThreadHistoryReadableSurfaceDebugEntry({
                workspaceId,
                threadId: effectiveThreadId,
                sourceThreadId: threadId,
                reopenOutcome,
                reasonCode:
                  effectiveLocalItems.length > 0
                    ? "last-good-local-items-preserved"
                    : "history-hydrate-empty",
                localItemCount: effectiveLocalItems.length,
                snapshotItemCount: snapshotItems.length,
                fallbackWarningCount: snapshot.fallbackWarnings.length,
              }),
            );
          } else {
            onDebug?.(
              createThreadHistoryReadableSurfaceDebugEntry({
                workspaceId,
                threadId: effectiveThreadId,
                sourceThreadId: threadId,
                reopenOutcome: "recovered",
                localItemCount: effectiveLocalItems.length,
                snapshotItemCount: snapshotItems.length,
                fallbackWarningCount: snapshot.fallbackWarnings.length,
              }),
            );
          }
          const hasLocalPendingQueue = userInputRequests.some(
            (request) =>
              request.workspace_id === workspaceId &&
              request.params.thread_id === effectiveThreadId,
          );
          const hasLocalPendingAskTool = effectiveLocalItems.some(
            (item) =>
              isAskUserQuestionToolItem(item) &&
              !isTerminalToolStatus(item.status),
          );
          if (
            shouldReplaceUserInputQueueFromSnapshot(
              snapshotItems,
              assembledSnapshot.userInputQueue.length,
              hasLocalPendingQueue || hasLocalPendingAskTool,
            )
          ) {
            dispatch({
              type: "clearUserInputRequestsForThread",
              workspaceId,
              threadId: effectiveThreadId,
            });
          }
          restoreThreadParentLinksFromSnapshot(
            effectiveThreadId,
            snapshotItems,
            updateThreadParent,
          );
          const relatedThreadIds = collectRelatedThreadIdsFromSnapshot(
            effectiveThreadId,
            snapshotItems,
          );
          relatedThreadIds.forEach((relatedThreadId) => {
            dispatch({
              type: "ensureThread",
              workspaceId,
              threadId: relatedThreadId,
              engine: "codex",
            });
          });
          const pendingRelatedThreadIds = relatedThreadIds.filter(
            (relatedThreadId) =>
              Boolean(relatedThreadId) &&
              relatedThreadId !== effectiveThreadId &&
              !loadedThreadsRef.current[relatedThreadId],
          );
          await mapWithConcurrency(
            pendingRelatedThreadIds,
            RELATED_THREAD_LOAD_CONCURRENCY,
            async (relatedThreadId) => {
              try {
                const relatedSnapshot =
                  await createHistoryLoader(relatedThreadId).load(
                    relatedThreadId,
                  );
                const relatedAssembledSnapshot =
                  hydrateHistory(relatedSnapshot);
                const relatedSnapshotItems = relatedAssembledSnapshot.items;
                if (relatedSnapshotItems.length > 0) {
                  dispatch({
                    type: "setThreadItems",
                    threadId: relatedThreadId,
                    items: relatedSnapshotItems,
                  });
                }
                dispatch({
                  type: "setThreadPlan",
                  threadId: relatedThreadId,
                  plan: relatedAssembledSnapshot.plan,
                });
                dispatch({
                  type: "setThreadHistoryRestoredAt",
                  threadId: relatedThreadId,
                  timestamp: relatedAssembledSnapshot.meta.historyRestoredAtMs,
                });
                restoreThreadParentLinksFromSnapshot(
                  relatedThreadId,
                  relatedSnapshotItems,
                  updateThreadParent,
                );
                loadedThreadsRef.current[relatedThreadId] = true;
              } catch (error) {
                onDebug?.({
                  id: `${Date.now()}-history-loader-related-error`,
                  timestamp: Date.now(),
                  source: "error",
                  label: "thread/history related loader error",
                  payload: {
                    workspaceId,
                    threadId: effectiveThreadId,
                    relatedThreadId,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                });
              }
              return relatedThreadId;
            },
          );
          assembledSnapshot.userInputQueue.forEach((request) => {
            dispatch({ type: "addUserInputRequest", request });
          });
          if (snapshot.fallbackWarnings.length > 0) {
            const partialHistoryDiagnostic = buildPartialHistoryDiagnostic(
              snapshot.fallbackWarnings
                .map((entry) => String(entry.code ?? "unknown"))
                .join(", "),
            );
            onDebug?.({
              id: `${Date.now()}-history-loader-fallback`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/history fallback",
              payload: {
                workspaceId,
                threadId: effectiveThreadId,
                warnings: snapshot.fallbackWarnings,
                diagnosticCategory: partialHistoryDiagnostic.category,
                diagnosticMessage: partialHistoryDiagnostic.rawMessage,
              },
            });
          }
          loadedThreadsRef.current[effectiveThreadId] = true;
        };
        const recoverReplacementThread = async (): Promise<{
          threadId: string;
          decision: ThreadRecoveryDecision;
          snapshot?: Awaited<
            ReturnType<ReturnType<typeof createHistoryLoader>["load"]>
          >;
        } | null> => {
          const existingSummaries =
            latestThreadsByWorkspaceRef.current[workspaceId] ??
            threadsByWorkspace[workspaceId] ??
            [];
          const recoveryBaselineSummaries =
            previousThreadsByWorkspaceRef.current[workspaceId] ??
            threadsByWorkspace[workspaceId] ??
            [];
          const staleSummary =
            existingSummaries.find((entry) => entry.id === threadId) ??
            (threadsByWorkspace[workspaceId] ?? []).find(
              (entry) => entry.id === threadId,
            );
          const engineSource = inferThreadEngineSource(threadId, staleSummary);
          const fallbackStaleActivityAt =
            (threadActivityRef.current[workspaceId] ?? {})[threadId] ?? 0;
          const effectiveStaleSummary =
            staleSummary ??
            (fallbackStaleActivityAt > 0
              ? {
                  id: threadId,
                  name: getCustomName(workspaceId, threadId) ?? "",
                  updatedAt: fallbackStaleActivityAt,
                  engineSource,
                  threadKind: "native",
                }
              : undefined);
          let nextSummaries = existingSummaries;
          let directRecoveredDecision: ThreadRecoveryDecision | null = null;
          if (engineSource === "codex") {
            const workspacePath = normalizeComparableWorkspacePath(
              workspacePathsByIdRef.current[workspaceId] ?? resolveWorkspacePath?.(workspaceId) ?? "",
            );
            if (workspacePath) {
              const activeThreadId =
                activeThreadIdByWorkspace[workspaceId] ?? "";
              const knownCodexThreadIds = collectKnownCodexThreadIds(
                existingSummaries,
                activeThreadId,
              );
              const matchingThreads: Record<string, unknown>[] = [];
              const recoveryStartedAt = Date.now();
              let pagesFetched = 0;
              let cursor: string | null = null;
              do {
                pagesFetched += 1;
                const response = (await listThreadsService(
                  workspaceId,
                  cursor,
                  THREAD_LIST_PAGE_SIZE,
                )) as Record<string, unknown>;
                const result = (response.result ?? response) as Record<
                  string,
                  unknown
                >;
                const data = Array.isArray(result.data)
                  ? (result.data as Record<string, unknown>[])
                  : [];
                const allowKnownCodexWithoutCwd =
                  isLocalSessionScanUnavailable(result);
                matchingThreads.push(
                  ...data.filter((entry) =>
                    shouldIncludeWorkspaceThreadEntry(
                      entry,
                      workspacePath,
                      knownCodexThreadIds,
                      allowKnownCodexWithoutCwd,
                    ),
                  ),
                );
                cursor = (result.nextCursor ?? result.next_cursor ?? null) as
                  | string
                  | null;
                const replacementCandidate = selectReplacementThreadDecision({
                  staleThreadId: threadId,
                  staleSummary: effectiveStaleSummary,
                  summaries: mergeRecoveredThreadSummaries(
                    existingSummaries,
                    matchingThreads
                      .map((entry, index) => {
                        const id = asString(entry.id).trim();
                        const preview = asString(entry.preview).trim();
                        const customName = getCustomName(workspaceId, id);
                        const fallbackName = `Agent ${index + 1}`;
                        return {
                          id,
                          name: customName
                            ? customName
                            : preview.length > 0
                              ? previewThreadName(preview, fallbackName)
                              : fallbackName,
                          updatedAt: getThreadTimestamp(entry),
                          sizeBytes: extractThreadSizeBytes(entry),
                          engineSource: "codex" as const,
                          threadKind: "native" as const,
                          ...resolveThreadSourceMeta(entry),
                        } satisfies ThreadSummary;
                      })
                      .filter((entry) => entry.id),
                    "codex",
                  ),
                });
                if (replacementCandidate.summary && (replacementCandidate.isPersistent || !cursor)) {
                  break;
                }
                if (pagesFetched >= THREAD_RECOVERY_MAX_PAGES) {
                  break;
                }
                if (
                  Date.now() - recoveryStartedAt >=
                  THREAD_RECOVERY_MAX_FETCH_DURATION_MS
                ) {
                  break;
                }
              } while (cursor);
              const refreshedCodexSummaries = matchingThreads
                .map((entry, index) => {
                  const id = asString(entry.id).trim();
                  const preview = asString(entry.preview).trim();
                  const customName = getCustomName(workspaceId, id);
                  const fallbackName = `Agent ${index + 1}`;
                  return {
                    id,
                    name: customName
                      ? customName
                      : preview.length > 0
                        ? previewThreadName(preview, fallbackName)
                        : fallbackName,
                    updatedAt: getThreadTimestamp(entry),
                    sizeBytes: extractThreadSizeBytes(entry),
                    engineSource: "codex" as const,
                    threadKind: "native" as const,
                    ...resolveThreadSourceMeta(entry),
                  } satisfies ThreadSummary;
                })
                .filter((entry) => entry.id);
              directRecoveredDecision = selectRecoveredNewThreadDecision({
                staleThreadId: threadId,
                previousSummaries: recoveryBaselineSummaries,
                summaries: refreshedCodexSummaries,
                staleSummary: effectiveStaleSummary,
              });
              nextSummaries = mergeRecoveredThreadSummaries(
                existingSummaries,
                refreshedCodexSummaries,
                "codex",
              );
            }
          } else if (engineSource === "opencode") {
            const sessions = await getOpenCodeSessionListService(
              workspaceId,
            ).catch(() => []);
            const refreshedOpenCodeSummaries = (
              Array.isArray(sessions) ? sessions : []
            )
              .map((session) => {
                const sessionUpdatedAt =
                  typeof session.updatedAt === "number" &&
                  Number.isFinite(session.updatedAt)
                    ? Math.max(0, session.updatedAt)
                    : 0;
                const id = `opencode:${session.sessionId}`;
                return {
                  id,
                  name:
                    getCustomName(workspaceId, id) ||
                    previewThreadName(session.title, "OpenCode Session"),
                  updatedAt: sessionUpdatedAt,
                  sizeBytes: extractThreadSizeBytes(
                    session as Record<string, unknown>,
                  ),
                  engineSource: "opencode" as const,
                  threadKind: "native" as const,
                } satisfies ThreadSummary;
              })
              .filter((entry) => entry.id);
            nextSummaries = mergeRecoveredThreadSummaries(
              existingSummaries,
              refreshedOpenCodeSummaries,
              "opencode",
            );
          }
          if (nextSummaries !== existingSummaries) {
            dispatch({
              type: "setThreads",
              workspaceId,
              threads: nextSummaries,
            });
            latestThreadsByWorkspaceRef.current = {
              ...latestThreadsByWorkspaceRef.current,
              [workspaceId]: nextSummaries,
            };
          }
          const summaryMatch = selectReplacementThreadDecision({
            staleThreadId: threadId,
            summaries: nextSummaries,
            staleSummary: effectiveStaleSummary,
          });
          if (summaryMatch.summary) {
            return { threadId: summaryMatch.summary.id, decision: summaryMatch };
          }
          const newlyRecoveredMatch = selectRecoveredNewThreadDecision({
            staleThreadId: threadId,
            previousSummaries: recoveryBaselineSummaries,
            summaries: nextSummaries,
            staleSummary: effectiveStaleSummary,
          });
          if (newlyRecoveredMatch.summary) {
            return {
              threadId: newlyRecoveredMatch.summary.id,
              decision: newlyRecoveredMatch,
            };
          }
          if (directRecoveredDecision?.summary) {
            return {
              threadId: directRecoveredDecision.summary.id,
              decision: directRecoveredDecision,
            };
          }

          const staleItems = itemsByThread[threadId] ?? [];
          if (staleItems.length === 0) {
            return null;
          }

          const historyCandidates = listReplacementThreadCandidates({
            staleThreadId: threadId,
            summaries: nextSummaries,
            staleSummary,
          })
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .slice(0, THREAD_RECOVERY_HISTORY_MATCH_CANDIDATES);
          if (historyCandidates.length === 0) {
            return null;
          }
          const historyCandidateById = new Map(
            historyCandidates.map((summary) => [summary.id, summary] as const),
          );

          const candidateSnapshots = await mapWithConcurrency(
            historyCandidates.map((summary) => summary.id),
            RELATED_THREAD_LOAD_CONCURRENCY,
            async (candidateThreadId) => {
              const summary = historyCandidateById.get(candidateThreadId);
              if (!summary) {
                return null;
              }
              try {
                const snapshot = await createHistoryLoader(summary.id).load(
                  summary.id,
                );
                return { summary, snapshot };
              } catch (candidateError) {
                const diagnostic = buildPartialHistoryDiagnostic(
                  candidateError instanceof Error
                    ? candidateError.message
                    : String(candidateError),
                );
                onDebug?.({
                  id: `${Date.now()}-history-loader-recovery-candidate-error`,
                  timestamp: Date.now(),
                  source: "error",
                  label: "thread/history recovery candidate error",
                  payload: {
                    workspaceId,
                    staleThreadId: threadId,
                    candidateThreadId: summary.id,
                    diagnosticCategory: diagnostic.category,
                    error:
                      candidateError instanceof Error
                        ? candidateError.message
                        : String(candidateError),
                  },
                });
                return null;
              }
            },
          );
          const historyMatch = selectReplacementThreadByMessageHistoryDecision({
            staleThreadId: threadId,
            staleItems,
            candidates: candidateSnapshots
              .filter(
                (
                  candidate,
                ): candidate is {
                  summary: (typeof historyCandidates)[number];
                  snapshot: Awaited<
                    ReturnType<ReturnType<typeof createHistoryLoader>["load"]>
                  >;
                } => candidate !== null,
              )
              .map(({ summary, snapshot }) => ({
                summary,
                items: snapshot.items,
              })),
          });
          if (!historyMatch.summary) {
            return null;
          }
          const matchedSnapshot = candidateSnapshots.find(
            (candidate) => candidate?.summary.id === historyMatch.summary?.id,
          )?.snapshot;
          return {
            threadId: historyMatch.summary.id,
            decision: historyMatch,
            ...(matchedSnapshot ? { snapshot: matchedSnapshot } : {}),
          };
        };
        try {
          const snapshot = await createHistoryLoader(threadId).load(threadId);
          await hydrateHistorySnapshot(threadId, snapshot);
          return threadId;
        } catch (error) {
          if (isThreadResumeNotFoundError(error)) {
            try {
              const recoveredThread = await recoverReplacementThread();
              if (recoveredThread) {
                const replacementThreadId = recoveredThread.threadId;
                const replacementSnapshot =
                  recoveredThread.snapshot ??
                  (await createHistoryLoader(replacementThreadId).load(
                    replacementThreadId,
                  ));
                await hydrateHistorySnapshot(
                  replacementThreadId,
                  replacementSnapshot,
                );
                onDebug?.(
                  createThreadHistoryContinuationDecisionDebugEntry({
                    workspaceId,
                    staleThreadId: threadId,
                    replacementThreadId,
                    decision: recoveredThread.decision,
                  }),
                );
                dispatch({
                  type: "clearUserInputRequestsForThread",
                  workspaceId,
                  threadId,
                });
                loadedThreadsRef.current[threadId] = false;
                if (recoveredThread.decision.isPersistent) {
                  rememberThreadAlias?.(threadId, replacementThreadId);
                } else {
                  clearThreadAlias?.(threadId);
                }
                dispatch({
                  type: "setActiveThreadId",
                  workspaceId,
                  threadId: replacementThreadId,
                });
                onDebug?.({
                  id: `${Date.now()}-history-loader-recovered-thread-alias`,
                  timestamp: Date.now(),
                  source: "client",
                  label: "thread/history recovered stale thread",
                  payload: {
                    workspaceId,
                    staleThreadId: threadId,
                    replacementThreadId,
                    recoveryStrategy: recoveredThread.decision.strategy,
                    recoveryConfidence: recoveredThread.decision.confidence,
                    recoveryScoreGap: recoveredThread.decision.scoreGap,
                    recoveryReasonCode: recoveredThread.decision.reasonCode,
                    recoveryFeatureSignals:
                      recoveredThread.decision.featureSignals,
                    aliasPersisted: recoveredThread.decision.isPersistent,
                  },
                });
                return replacementThreadId;
              }
            } catch (recoveryError) {
              const diagnostic = buildPartialHistoryDiagnostic(
                recoveryError instanceof Error
                  ? recoveryError.message
                  : String(recoveryError),
              );
              onDebug?.({
                id: `${Date.now()}-history-loader-recovery-error`,
                timestamp: Date.now(),
                source: "error",
                label: "thread/history recovery error",
                payload: {
                  diagnosticCategory: diagnostic.category,
                  error:
                    recoveryError instanceof Error
                      ? recoveryError.message
                      : String(recoveryError),
                },
              });
            }
          }
          const stabilityDiagnostic =
            error instanceof Error
              ? resolveThreadStabilityDiagnostic(error.message)
              : resolveThreadStabilityDiagnostic(String(error));
          onDebug?.({
            id: `${Date.now()}-history-loader-error`,
            timestamp: Date.now(),
            source: "error",
            label: "thread/history loader error",
            payload: {
              error: error instanceof Error ? error.message : String(error),
              diagnosticCategory:
                stabilityDiagnostic?.category ?? "partial_history",
              recoveryReason: stabilityDiagnostic?.reconnectReason ?? null,
            },
          });
          // Fallback to legacy path to preserve recovery.
        }
      }
      // Claude sessions don't use Codex thread/resume RPC —
      // load message history from JSONL and populate the thread
      const workspacePath = workspacePathsByIdRef.current[workspaceId] ?? resolveWorkspacePath?.(workspaceId) ?? "";
      if (threadId.startsWith("claude:")) {
        dispatch({
          type: "ensureThread",
          workspaceId,
          threadId,
          engine: "claude",
        });
        if (!workspacePath) {
          loadedThreadsRef.current[threadId] = false;
          return threadId;
        }
        if (force || !loadedThreadsRef.current[threadId]) {
          const realSessionId = threadId.slice("claude:".length);
          try {
            const result = await loadClaudeSessionService(
              workspacePath,
              realSessionId,
            );
            // Handle both new format { messages, usage } and old format (array)
            const messagesData =
              (result as { messages?: unknown }).messages ?? result;
            const usageData = (result as { usage?: unknown }).usage as
              | {
                  inputTokens?: number;
                  outputTokens?: number;
                  cacheCreationInputTokens?: number;
                  cacheReadInputTokens?: number;
                }
              | undefined;

            const items = parseClaudeHistoryMessages(messagesData);
            if (items.length > 0) {
              dispatch({ type: "setThreadItems", threadId, items });
              onDebug?.(
                createThreadHistoryReadableSurfaceDebugEntry({
                  workspaceId,
                  threadId,
                  reopenOutcome: "recovered",
                  snapshotItemCount: items.length,
                  localItemCount: localItems.length,
                }),
              );
            } else {
              onDebug?.(
                createThreadHistoryReadableSurfaceDebugEntry({
                  workspaceId,
                  threadId,
                  reopenOutcome:
                    localItems.length > 0 ? "degraded-readable" : "failed",
                  reasonCode:
                    localItems.length > 0
                      ? "last-good-local-items-preserved"
                      : "history-hydrate-empty",
                  snapshotItemCount: 0,
                  localItemCount: localItems.length,
                }),
              );
            }
            dispatch({
              type: "setThreadHistoryRestoredAt",
              threadId,
              timestamp: Date.now(),
            });

            // Dispatch usage data if available
            if (
              usageData &&
              (usageData.inputTokens || usageData.outputTokens)
            ) {
              const cachedTokens =
                (usageData.cacheCreationInputTokens ?? 0) +
                (usageData.cacheReadInputTokens ?? 0);
              dispatch({
                type: "setThreadTokenUsage",
                threadId,
                tokenUsage: {
                  total: {
                    inputTokens: usageData.inputTokens ?? 0,
                    outputTokens: usageData.outputTokens ?? 0,
                    cachedInputTokens: cachedTokens,
                    totalTokens:
                      (usageData.inputTokens ?? 0) +
                      (usageData.outputTokens ?? 0),
                    reasoningOutputTokens: 0,
                  },
                  last: {
                    inputTokens: usageData.inputTokens ?? 0,
                    outputTokens: usageData.outputTokens ?? 0,
                    cachedInputTokens: cachedTokens,
                    totalTokens:
                      (usageData.inputTokens ?? 0) +
                      (usageData.outputTokens ?? 0),
                    reasoningOutputTokens: 0,
                  },
                  modelContextWindow: DEFAULT_CLAUDE_CONTEXT_WINDOW,
                  contextUsageSource: "claude_history",
                  contextUsageFreshness: "estimated",
                },
              });
            }
          } catch (error) {
            loadedThreadsRef.current[threadId] = false;
            const diagnostic =
              error instanceof Error
                ? resolveThreadStabilityDiagnostic(error.message)
                : resolveThreadStabilityDiagnostic(String(error));
            onDebug?.({
              id: `${Date.now()}-claude-history-load-error`,
              timestamp: Date.now(),
              source: "error",
              label: "thread/claude history load error",
              payload: {
                workspaceId,
                threadId,
                error: error instanceof Error ? error.message : String(error),
                diagnosticCategory: diagnostic?.category ?? "partial_history",
                reopenOutcome: localItems.length > 0 ? "degraded-readable" : "failed",
              },
            });
            if (isThreadResumeNotFoundError(error)) {
              const preservedReadableSurface = reconcileMissingClaudeThread(
                workspaceId,
                threadId,
              );
              return preservedReadableSurface ? threadId : null;
            }
            return threadId;
          }
        }
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      }
      if (threadId.startsWith("opencode:")) {
        dispatch({
          type: "ensureThread",
          workspaceId,
          threadId,
          engine: "opencode",
        });
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      }
      if (threadId.startsWith("gemini:")) {
        dispatch({
          type: "ensureThread",
          workspaceId,
          threadId,
          engine: "gemini",
        });
        if (workspacePath && !loadedThreadsRef.current[threadId]) {
          const realSessionId = threadId.slice("gemini:".length);
          try {
            const result = await loadGeminiSessionService(
              workspacePath,
              realSessionId,
            );
            const messagesData =
              (result as { messages?: unknown }).messages ?? result;
            const items = parseGeminiHistoryMessages(messagesData);
            if (items.length > 0) {
              dispatch({ type: "setThreadItems", threadId, items });
            }
            dispatch({
              type: "setThreadHistoryRestoredAt",
              threadId,
              timestamp: Date.now(),
            });
          } catch {
            // Failed to load Gemini session history — not fatal
          }
        }
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      }
      if (!force && loadedThreadsRef.current[threadId]) {
        return threadId;
      }
      if (
        status?.isProcessing &&
        loadedThreadsRef.current[threadId] &&
        !force
      ) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-skipped`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/resume skipped",
          payload: { workspaceId, threadId, reason: "active-turn" },
        });
        return threadId;
      }
      onDebug?.({
        id: `${Date.now()}-client-thread-resume`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/resume",
        payload: { workspaceId, threadId },
      });
      try {
        const response = (await resumeThreadService(
          workspaceId,
          threadId,
        )) as Record<string, unknown> | null;
        onDebug?.({
          id: `${Date.now()}-server-thread-resume`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/resume response",
          payload: response,
        });
        const result = (response?.result ?? response) as Record<
          string,
          unknown
        > | null;
        const thread = (result?.thread ?? response?.thread ?? null) as Record<
          string,
          unknown
        > | null;
        if (thread) {
          dispatch({
            type: "ensureThread",
            workspaceId,
            threadId,
            engine: "codex",
          });
          applyCollabThreadLinksFromThread(threadId, thread);
          const items = buildItemsFromThread(thread);
          const localItems = itemsByThread[threadId] ?? [];
          const shouldReplace =
            replaceLocal || replaceOnResumeRef.current[threadId] === true;
          if (shouldReplace) {
            replaceOnResumeRef.current[threadId] = false;
          }
          if (localItems.length > 0 && !shouldReplace) {
            dispatch({
              type: "setThreadHistoryRestoredAt",
              threadId,
              timestamp: Date.now(),
            });
            loadedThreadsRef.current[threadId] = true;
            return threadId;
          }
          const hasOverlap =
            items.length > 0 &&
            localItems.length > 0 &&
            items.some((item) =>
              localItems.some((local) => local.id === item.id),
            );
          const mergedItems =
            items.length > 0
              ? shouldReplace
                ? items
                : localItems.length > 0 && !hasOverlap
                  ? localItems
                  : mergeThreadItems(items, localItems)
              : localItems;
          if (mergedItems.length > 0) {
            dispatch({
              type: "setThreadItems",
              threadId,
              items: mergedItems,
            });
          }
          dispatch({
            type: "setThreadHistoryRestoredAt",
            threadId,
            timestamp: Date.now(),
          });
          dispatch({
            type: "markReviewing",
            threadId,
            isReviewing: isReviewingFromThread(thread),
          });
          const preview = asString(thread?.preview ?? "");
          const customName = getCustomName(workspaceId, threadId);
          if (!customName && preview) {
            dispatch({
              type: "setThreadName",
              workspaceId,
              threadId,
              name: previewThreadName(preview, `Agent ${threadId.slice(0, 4)}`),
            });
          }
          const lastAgentMessage = [...mergedItems]
            .reverse()
            .find(
              (item) => item.kind === "message" && item.role === "assistant",
            ) as ConversationItem | undefined;
          const lastText =
            lastAgentMessage && lastAgentMessage.kind === "message"
              ? lastAgentMessage.text
              : preview;
          if (lastText) {
            dispatch({
              type: "setLastAgentMessage",
              threadId,
              text: lastText,
              timestamp: getThreadTimestamp(thread),
            });
          }
        }
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/resume error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [
      activeThreadIdByWorkspace,
      applyCollabThreadLinksFromThread,
      updateThreadParent,
      dispatch,
      getCustomName,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      clearThreadAlias,
      rememberThreadAlias,
      replaceOnResumeRef,
      reconcileMissingClaudeThread,
      resolveWorkspacePath,
      threadActivityRef,
      threadStatusById,
      threadsByWorkspace,
      userInputRequests,
      useUnifiedHistoryLoader,
    ],
  );

  const {
    startThreadForWorkspace,
    startSharedSessionForWorkspace,
    forkThreadForWorkspace,
    forkClaudeSessionFromMessageForWorkspace,
    forkSessionFromMessageForWorkspace,
  } = useThreadActionsSessionRuntime({
    activeThreadIdByWorkspace,
    dispatch,
    itemsByThread,
    loadedThreadsRef,
    onDebug,
    renameThreadTitleMapping,
    resumeThreadForWorkspace,
    threadsByWorkspace,
    workspacePathsByIdRef,
  });

  const refreshThread = useCallback(
    async (workspaceId: string, threadId: string) => {
      if (!threadId) {
        return null;
      }
      replaceOnResumeRef.current[threadId] = true;
      return resumeThreadForWorkspace(workspaceId, threadId, true, true);
    },
    [replaceOnResumeRef, resumeThreadForWorkspace],
  );

  const resetWorkspaceThreads = useCallback(
    (workspaceId: string) => {
      const threadIds = new Set<string>();
      const list = threadsByWorkspace[workspaceId] ?? [];
      list.forEach((thread) => threadIds.add(thread.id));
      const activeThread = activeThreadIdByWorkspace[workspaceId];
      if (activeThread) {
        threadIds.add(activeThread);
      }
      threadIds.forEach((threadId) => {
        loadedThreadsRef.current[threadId] = false;
      });
    },
    [activeThreadIdByWorkspace, loadedThreadsRef, threadsByWorkspace],
  );

  const listThreadsForWorkspace = useCallback(
    async (
      workspace: WorkspaceInfo,
      options?: {
        preserveState?: boolean;
        includeOpenCodeSessions?: boolean;
        recoverySource?: AutomaticRuntimeRecoverySource;
        allowRuntimeReconnect?: boolean;
        startupHydrationMode?: StartupThreadHydrationMode;
      },
    ) => {
      // Store workspace path for Claude session loading
      workspacePathsByIdRef.current[workspace.id] = workspace.path;
      const requestSeq =
        (threadListRequestSeqRef.current[workspace.id] ?? 0) + 1;
      threadListRequestSeqRef.current[workspace.id] = requestSeq;
      const isLatestThreadListRequest = () =>
        threadListRequestSeqRef.current[workspace.id] === requestSeq;
      const preserveState = options?.preserveState ?? false;
      const includeOpenCodeSessions = options?.includeOpenCodeSessions ?? true;
      const recoverySource = options?.recoverySource ?? "thread-list-live";
      const allowRuntimeReconnect = options?.allowRuntimeReconnect ?? true;
      let appliedThreadListUpdate = false;
      const workspacePath = normalizeComparableWorkspacePath(workspace.path);
      if (!preserveState) {
        dispatch({
          type: "setThreadListLoading",
          workspaceId: workspace.id,
          isLoading: true,
        });
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor: null,
        });
      }
      onDebug?.({
        id: `${Date.now()}-client-thread-list`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/list",
        payload: buildThreadDebugCorrelation(
          {
            workspaceId: workspace.id,
            action: "thread-list-refresh",
            engine: "multi",
          },
          { path: workspace.path },
        ),
      });
      const archivedSessionMapPromise = loadArchivedSessionMap(workspace.id);
      try {
        let degradedPartialSource: string | null = null;
        const partialSourcesSeen = new Set<string>();
        const rememberPartialSource = (value: unknown) => {
          const normalized = normalizeThreadListPartialSource(value);
          if (normalized) {
            partialSourcesSeen.add(normalized);
            if (!degradedPartialSource) {
              degradedPartialSource = normalized;
            }
          }
        };
        let mappedTitles: Record<string, string> = {};
        try {
          mappedTitles = await listThreadTitlesService(workspace.id);
          onThreadTitleMappingsLoaded?.(workspace.id, mappedTitles);
        } catch {
          mappedTitles = {};
        }
        const sharedSessions = normalizeSharedSessionSummaries(
          await listSharedSessionsService(workspace.id).catch(() => []),
        );
        const hiddenSharedBindingIds = new Set(
          sharedSessions.flatMap((session) => session.nativeThreadIds),
        );
        const existingThreads = threadsByWorkspace[workspace.id] ?? [];
        const activeThreadId = activeThreadIdByWorkspace[workspace.id] ?? "";
        const knownCodexThreadIds = collectKnownCodexThreadIds(
          existingThreads,
          activeThreadId,
        );
        const engineById = new Map(
          existingThreads.map((thread) => [thread.id, thread.engineSource]),
        );
        const hasGeminiSignal =
          existingThreads.some(
            (thread) =>
              thread.engineSource === "gemini" ||
              thread.id.startsWith("gemini:") ||
              thread.id.startsWith("gemini-pending-"),
          ) ||
          activeThreadId.startsWith("gemini:") ||
          activeThreadId.startsWith("gemini-pending-") ||
          Object.keys(mappedTitles).some((id) => id.startsWith("gemini:"));
        const cachedGemini = geminiSessionCacheRef.current[workspace.id];
        const hasFreshGeminiCache =
          !!cachedGemini &&
          Date.now() - cachedGemini.fetchedAt <= GEMINI_SESSION_CACHE_TTL_MS;
        const knownActivityByThread =
          threadActivityRef.current[workspace.id] ?? {};
        const hasKnownActivity = Object.keys(knownActivityByThread).length > 0;
        const matchingThreads: Record<string, unknown>[] = [];
        const targetCount = THREAD_LIST_TARGET_COUNT;
        const pageSize = THREAD_LIST_PAGE_SIZE;
        const maxPagesWithoutMatch = hasKnownActivity
          ? THREAD_LIST_MAX_EMPTY_PAGES_WITH_ACTIVITY
          : THREAD_LIST_MAX_EMPTY_PAGES;
        let pagesFetched = 0;
        const fetchStartedAt = Date.now();
        let cursor: string | null = null;
        do {
          pagesFetched += 1;
          let response: Record<string, unknown>;
          try {
            const liveResponse = await withTimeout(
              (async () => {
                try {
                  return await listThreadsService(
                    workspace.id,
                    cursor,
                    pageSize,
                  );
                } catch (error) {
                  if (
                    !isWorkspaceNotConnectedError(error) ||
                    !allowRuntimeReconnect
                  ) {
                    throw error;
                  }
                  const recovery = beginAutomaticRuntimeRecovery(
                    workspace.id,
                    recoverySource,
                  );
                  if (recovery.kind === "waiter") {
                    rememberPartialSource("guarded-recovery-waiter");
                    onDebug?.({
                      id: `${Date.now()}-client-workspace-recovery-waiter`,
                      timestamp: Date.now(),
                      source: "client",
                      label: "workspace/recovery waiter before thread list",
                      payload: buildThreadDebugCorrelation(
                        {
                          workspaceId: workspace.id,
                          action: "thread-list-refresh",
                          engine: "codex",
                          recoveryState: "degraded",
                        },
                        { recoverySource },
                      ),
                    });
                    throw error;
                  }
                  if (recovery.kind === "cooldown") {
                    rememberPartialSource("automatic-recovery-cooldown");
                    onDebug?.({
                      id: `${Date.now()}-client-workspace-recovery-cooldown`,
                      timestamp: Date.now(),
                      source: "client",
                      label: "workspace/recovery cooldown before thread list",
                      payload: buildThreadDebugCorrelation(
                        {
                          workspaceId: workspace.id,
                          action: "thread-list-refresh",
                          engine: "codex",
                          recoveryState: "degraded",
                        },
                        { recoverySource },
                      ),
                    });
                    throw error;
                  }
                  onDebug?.({
                    id: `${Date.now()}-client-workspace-reconnect-before-thread-list`,
                    timestamp: Date.now(),
                    source: "client",
                    label: "workspace/reconnect before thread list",
                    payload: buildThreadDebugCorrelation(
                      {
                        workspaceId: workspace.id,
                        action: "thread-list-refresh",
                        engine: "codex",
                        recoveryState: "recovering",
                      },
                      { recoverySource },
                    ),
                  });
                  await recovery.promise;
                  return await listThreadsService(
                    workspace.id,
                    cursor,
                    pageSize,
                  );
                }
              })(),
              THREAD_LIST_LIVE_REQUEST_TIMEOUT_MS,
            );
            if (liveResponse === null) {
              rememberPartialSource(
                getAutomaticRuntimeRecoveryPartialSource(workspace.id) ??
                  "thread-list-live-timeout",
              );
              onDebug?.({
                id: `${Date.now()}-client-thread-list-live-timeout`,
                timestamp: Date.now(),
                source: "error",
                label: "thread/list live timeout",
                payload: {
                  workspaceId: workspace.id,
                  cursor,
                  timeoutMs: THREAD_LIST_LIVE_REQUEST_TIMEOUT_MS,
                },
              });
              break;
            }
            response = liveResponse as Record<string, unknown>;
          } catch (error) {
            if (!isWorkspaceNotConnectedError(error)) {
              throw error;
            }
            rememberPartialSource("workspace-not-connected");
            onDebug?.({
              id: `${Date.now()}-client-thread-list-codex-unavailable`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list codex unavailable",
              payload: buildThreadDebugCorrelation(
                {
                  workspaceId: workspace.id,
                  action: "thread-list-codex-unavailable",
                  engine: "codex",
                  recoveryState: "recovering",
                },
                {
                  reason:
                    error instanceof Error ? error.message : String(error),
                },
              ),
            });
            break;
          }
          onDebug?.({
            id: `${Date.now()}-server-thread-list`,
            timestamp: Date.now(),
            source: "server",
            label: "thread/list response",
            payload: response,
          });
          const result = (response.result ?? response) as Record<
            string,
            unknown
          >;
          rememberPartialSource(result.partialSource ?? result.partial_source);
          const data = Array.isArray(result?.data)
            ? (result.data as Record<string, unknown>[])
            : [];
          const allowKnownCodexWithoutCwd =
            isLocalSessionScanUnavailable(result);
          const nextCursor = (result?.nextCursor ??
            result?.next_cursor ??
            null) as string | null;
          matchingThreads.push(
            ...data.filter((thread) =>
              shouldIncludeWorkspaceThreadEntry(
                thread,
                workspacePath,
                knownCodexThreadIds,
                allowKnownCodexWithoutCwd,
              ),
            ),
          );
          cursor = nextCursor;
          if (
            matchingThreads.length === 0 &&
            pagesFetched >= maxPagesWithoutMatch
          ) {
            onDebug?.({
              id: `${Date.now()}-client-thread-list-stop-empty-pages`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list stop",
              payload: {
                workspaceId: workspace.id,
                reason: "too-many-empty-pages",
                pagesFetched,
                maxPagesWithoutMatch,
              },
            });
            break;
          }
          if (pagesFetched >= THREAD_LIST_MAX_TOTAL_PAGES) {
            onDebug?.({
              id: `${Date.now()}-client-thread-list-stop-page-cap`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list stop",
              payload: {
                workspaceId: workspace.id,
                reason: "page-cap",
                pagesFetched,
                pageCap: THREAD_LIST_MAX_TOTAL_PAGES,
              },
            });
            break;
          }
          if (
            Date.now() - fetchStartedAt >=
            THREAD_LIST_MAX_FETCH_DURATION_MS
          ) {
            onDebug?.({
              id: `${Date.now()}-client-thread-list-stop-time-budget`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list stop",
              payload: {
                workspaceId: workspace.id,
                reason: "time-budget",
                pagesFetched,
                budgetMs: THREAD_LIST_MAX_FETCH_DURATION_MS,
              },
            });
            break;
          }
        } while (cursor && matchingThreads.length < targetCount);

        const uniqueById = new Map<string, Record<string, unknown>>();
        matchingThreads.forEach((thread) => {
          const id = String(thread?.id ?? "");
          if (id && !uniqueById.has(id)) {
            uniqueById.set(id, thread);
          }
        });
        const uniqueThreads = Array.from(uniqueById.values());
        const activityByThread = threadActivityRef.current[workspace.id] ?? {};
        const nextActivityByThread = { ...activityByThread };
        let didChangeActivity = false;
        uniqueThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          if (!threadId) {
            return;
          }
          const timestamp = getThreadTimestamp(thread);
          if (timestamp > (nextActivityByThread[threadId] ?? 0)) {
            nextActivityByThread[threadId] = timestamp;
            didChangeActivity = true;
          }
        });
        uniqueThreads.sort((a, b) => {
          const aId = String(a?.id ?? "");
          const bId = String(b?.id ?? "");
          const aCreated = getThreadTimestamp(a);
          const bCreated = getThreadTimestamp(b);
          const aActivity = Math.max(nextActivityByThread[aId] ?? 0, aCreated);
          const bActivity = Math.max(nextActivityByThread[bId] ?? 0, bCreated);
          return bActivity - aActivity;
        });
        const summaries = uniqueThreads
          .slice(0, targetCount)
          .map((thread, index) => {
            const id = String(thread?.id ?? "");
            const preview = asString(thread?.preview ?? "").trim();
            const mappedTitle = mappedTitles[id];
            const customName = getCustomName(workspace.id, id) || mappedTitle;
            const fallbackName = `Agent ${index + 1}`;
            const name = customName
              ? customName
              : preview.length > 0
                ? previewThreadName(preview, fallbackName)
                : fallbackName;
            const engineSource = engineById.get(id) ?? ("codex" as const);
            const sourceMeta = resolveThreadSourceMeta(thread);
            return {
              id,
              name,
              updatedAt: getThreadTimestamp(thread),
              sizeBytes: extractThreadSizeBytes(thread),
              engineSource,
              threadKind: "native" as const,
              folderId:
                typeof thread.folderId === "string" &&
                thread.folderId.trim().length > 0
                  ? thread.folderId.trim()
                  : null,
              ...sourceMeta,
            };
          })
          .filter((entry) => entry.id && !hiddenSharedBindingIds.has(entry.id));

        let allSummaries: ThreadSummary[] = summaries;
        const mergedById = new Map<string, ThreadSummary>();
        allSummaries.forEach((entry) => mergedById.set(entry.id, entry));
        const lastGoodThreadSummaries = getLastGoodThreadSummaries(
          workspace.id,
        );
        const nativeSessionListLimit = resolveNativeSessionListLimit(workspace);
        const opencodeSessionsPromise =
          includeOpenCodeSessions
            ? withTimeout(
                getOpenCodeSessionListService(workspace.id),
                NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
              )
            : Promise.resolve(
                [] as Awaited<ReturnType<typeof getOpenCodeSessionListService>>,
              );
        const projectCatalogSessionsPromise =
          canListWorkspaceSessions
            ? loadActiveProjectCatalogSessions(workspace.id)
            : Promise.resolve(null);
        const [claudeResult, opencodeResult, projectCatalogResult] =
          await Promise.allSettled([
            withTimeout(
              listClaudeSessionsForFallbackSeedService(
                workspace.path,
                nativeSessionListLimit,
              ),
              NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
            ),
            opencodeSessionsPromise,
            projectCatalogSessionsPromise,
          ]);
        const projectCatalogValue =
          projectCatalogResult.status === "fulfilled"
            ? projectCatalogResult.value
            : null;
        const catalogClaudeSourceStatus = findCatalogSourceStatusForEngine(
          projectCatalogValue?.sourceStatuses,
          "claude",
        );
        // Native Claude history is a legacy fallback/diagnostic seed here.
        // When catalog reports Claude source status, catalog projection owns
        // membership and native rows must not widen or erase that projection.
        const shouldMergeNativeClaudeSessions = !catalogClaudeSourceStatus;
        if (isIncompleteCatalogSourceStatus(catalogClaudeSourceStatus)) {
          rememberPartialSource(
            catalogClaudeSourceStatus?.reason ??
              `claude-${catalogClaudeSourceStatus?.completeness}`,
          );
        }
        const claudeSuccessfulEmpty =
          shouldMergeNativeClaudeSessions &&
          claudeResult.status === "fulfilled" &&
          Array.isArray(claudeResult.value) &&
          claudeResult.value.length === 0;
        if (claudeResult.status === "fulfilled") {
          if (shouldMergeNativeClaudeSessions && claudeResult.value === null) {
            rememberPartialSource("claude-session-timeout");
            onDebug?.({
              id: `${Date.now()}-client-claude-session-timeout`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list claude timeout",
              payload: {
                workspaceId: workspace.id,
                timeoutMs: NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
              },
            });
            // 在 partial-source merge 之前先 seed last-good Claude 条目，
            // 避免下游 catalog merge / archive merge 因看到空 Claude 子源而形成残缺基底。
            // 即便下游 partial-source 路径被绕过或将来重构，最终列表也不会丢失 Claude 历史。
            seedLastGoodClaudeIntoMerged(
              mergedById,
              getLastGoodThreadSummariesForEngine(workspace.id, "claude"),
              hiddenSharedBindingIds,
            );
          }
          const claudeSessions =
            shouldMergeNativeClaudeSessions && Array.isArray(claudeResult.value)
              ? claudeResult.value
              : [];
          claudeSessions.forEach(
            (session: {
              sessionId: string;
              firstMessage: string;
              updatedAt: number;
              fileSizeBytes?: number;
              parentSessionId?: string | null;
            }) => {
              const id = `claude:${session.sessionId}`;
              const parentThreadId = session.parentSessionId
                ? `claude:${session.parentSessionId}`
                : null;
              if (hiddenSharedBindingIds.has(id)) {
                return;
              }
              const prev = mergedById.get(id);
              const updatedAt = session.updatedAt;
              const mappedTitle = mappedTitles[id];
              const customTitle = getCustomName(workspace.id, id);
              const next: ThreadSummary = {
                id,
                name:
                  customTitle ||
                  mappedTitle ||
                  previewThreadName(session.firstMessage, "Claude Session"),
                updatedAt,
                sizeBytes: extractThreadSizeBytes(
                  session as Record<string, unknown>,
                ),
                engineSource: "claude",
                threadKind: "native",
                parentThreadId,
              };
              if (!prev || next.updatedAt >= prev.updatedAt) {
                mergedById.set(
                  id,
                  mergeThreadSummaryPreservingStableIdentity(prev, next),
                );
              }
            },
          );
        } else if (shouldMergeNativeClaudeSessions) {
          rememberPartialSource("claude-session-error");
          onDebug?.({
            id: `${Date.now()}-client-claude-session-error`,
            timestamp: Date.now(),
            source: "client",
            label: "thread/list claude error",
            payload: {
              workspaceId: workspace.id,
              error: String(claudeResult.reason ?? "unknown error"),
            },
          });
          // 同 timeout 路径：reject 时也 seed last-good Claude，确保兜底前置。
          seedLastGoodClaudeIntoMerged(
            mergedById,
            getLastGoodThreadSummariesForEngine(workspace.id, "claude"),
            hiddenSharedBindingIds,
          );
        }
        if (opencodeResult.status === "fulfilled") {
          if (opencodeResult.value === null) {
            rememberPartialSource("opencode-session-timeout");
            onDebug?.({
              id: `${Date.now()}-client-opencode-session-timeout`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list opencode timeout",
              payload: {
                workspaceId: workspace.id,
                timeoutMs: NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
              },
            });
            // 与 Claude timeout 分支对称：seed last-good OpenCode 条目，
            // 防止下游 catalog merge / archive merge 因看到空 OpenCode 子源而形成残缺基底。
            seedLastGoodOpenCodeIntoMerged(
              mergedById,
              getLastGoodThreadSummariesForEngine(workspace.id, "opencode"),
              hiddenSharedBindingIds,
            );
          }
          const opencodeSessions = Array.isArray(opencodeResult.value)
            ? opencodeResult.value
            : [];
          opencodeSessions.forEach((session) => {
            const id = `opencode:${session.sessionId}`;
            if (hiddenSharedBindingIds.has(id)) {
              return;
            }
            const prev = mergedById.get(id);
            const sessionUpdatedAt =
              typeof session.updatedAt === "number" &&
              Number.isFinite(session.updatedAt)
                ? Math.max(0, session.updatedAt)
                : 0;
            const updatedAt =
              sessionUpdatedAt ||
              nextActivityByThread[id] ||
              prev?.updatedAt ||
              0;
            if (updatedAt > (nextActivityByThread[id] ?? 0)) {
              nextActivityByThread[id] = updatedAt;
              didChangeActivity = true;
            }
            const next: ThreadSummary = {
              id,
              name:
                mappedTitles[id] ||
                getCustomName(workspace.id, id) ||
                previewThreadName(session.title, "OpenCode Session"),
              updatedAt,
              sizeBytes: extractThreadSizeBytes(
                session as Record<string, unknown>,
              ),
              engineSource: "opencode",
              threadKind: "native",
            };
            if (!prev || next.updatedAt >= prev.updatedAt) {
              mergedById.set(id, next);
            }
          });
        } else {
          // 与 Claude rejected 分支对称：补全此前缺失的 else，
          // 确保 OpenCode 子源抛错时仍发出可观测诊断并 seed last-good，避免静默吞错。
          rememberPartialSource("opencode-session-error");
          onDebug?.({
            id: `${Date.now()}-client-opencode-session-error`,
            timestamp: Date.now(),
            source: "client",
            label: "thread/list opencode error",
            payload: {
              workspaceId: workspace.id,
              error: String(opencodeResult.reason ?? "unknown error"),
            },
          });
          seedLastGoodOpenCodeIntoMerged(
            mergedById,
            getLastGoodThreadSummariesForEngine(workspace.id, "opencode"),
            hiddenSharedBindingIds,
          );
        }
        if (projectCatalogResult.status === "fulfilled") {
          if (projectCatalogValue === null) {
            rememberPartialSource("codex-catalog-timeout");
            onDebug?.({
              id: `${Date.now()}-client-codex-catalog-timeout`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list codex catalog timeout",
              payload: {
                workspaceId: workspace.id,
                timeoutMs: NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
              },
            });
          }
          rememberPartialSource(projectCatalogValue?.partialSource);
          const projectCatalogSessions = (
            projectCatalogValue?.sessions ?? []
          ).filter((entry) => !hiddenSharedBindingIds.has(entry.sessionId));
          if (claudeSuccessfulEmpty && projectCatalogValue?.partialSource) {
            onDebug?.({
              id: `${Date.now()}-client-claude-successful-empty-degraded`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list claude successful empty degraded",
              payload: {
                workspaceId: workspace.id,
                partialSource: projectCatalogValue.partialSource,
                lastGoodCount: lastGoodThreadSummaries.length,
                currentEngineCounts: countSummariesByEngine(
                  Array.from(mergedById.values()),
                ),
                catalogEngineCounts: countCatalogSessionsByEngine(
                  projectCatalogSessions,
                ),
              },
            });
          }
          allSummaries = mergeCodexCatalogSessionSummaries(
            Array.from(mergedById.values()).sort(
              (a, b) => b.updatedAt - a.updatedAt,
            ),
            projectCatalogSessions,
            workspace.id,
            mappedTitles,
            getCustomName,
          );
          mergedById.clear();
          allSummaries.forEach((entry) => mergedById.set(entry.id, entry));
        } else {
          rememberPartialSource("codex-catalog-error");
        }
        if (!includeOpenCodeSessions) {
          existingThreads.forEach((thread) => {
            if (
              thread.threadKind === "shared" ||
              hiddenSharedBindingIds.has(thread.id)
            ) {
              return;
            }
            const isOpenCodeThread =
              thread.engineSource === "opencode" ||
              thread.id.startsWith("opencode:") ||
              thread.id.startsWith("opencode-pending-");
            if (
              !isOpenCodeThread ||
              !isRetainableEngineContinuitySummary("opencode", thread)
            ) {
              return;
            }
            const prev = mergedById.get(thread.id);
            const threadUpdatedAt = Number.isFinite(thread.updatedAt)
              ? Math.max(0, thread.updatedAt)
              : 0;
            const updatedAt =
              threadUpdatedAt ||
              nextActivityByThread[thread.id] ||
              prev?.updatedAt ||
              0;
            if (updatedAt > (nextActivityByThread[thread.id] ?? 0)) {
              nextActivityByThread[thread.id] = updatedAt;
              didChangeActivity = true;
            }
            const next: ThreadSummary = {
              ...thread,
              updatedAt,
              engineSource: "opencode",
              threadKind: thread.threadKind ?? "native",
            };
            if (!prev || next.updatedAt >= prev.updatedAt) {
              mergedById.set(thread.id, next);
            }
          });
        }
        allSummaries = Array.from(mergedById.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        if (hasFreshGeminiCache && cachedGemini.sessions.length > 0) {
          allSummaries = mergeGeminiSessionSummaries(
            allSummaries,
            cachedGemini.sessions.filter(
              (session) =>
                !hiddenSharedBindingIds.has(`gemini:${session.sessionId}`),
            ),
            workspace.id,
            mappedTitles,
            getCustomName,
          );
        }
        if (sharedSessions.length > 0) {
          const sharedSummaries = sharedSessions.map(toSharedThreadSummary);
          const merged = new Map<string, ThreadSummary>();
          [...sharedSummaries, ...allSummaries].forEach((entry) => {
            const previous = merged.get(entry.id);
            if (!previous || entry.updatedAt >= previous.updatedAt) {
              merged.set(entry.id, entry);
            }
          });
          allSummaries = Array.from(merged.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt,
          );
        }
        const archivedSessionMap = await archivedSessionMapPromise;
        rememberPartialSource(archivedSessionMap?.partialSource);
        if (didChangeActivity) {
          const next = {
            ...threadActivityRef.current,
            [workspace.id]: nextActivityByThread,
          };
          threadActivityRef.current = next;
          saveThreadActivity(next);
        }

        if (!isLatestThreadListRequest()) {
          return { applied: false, stale: true };
        }

        let visibleSummaries = allSummaries;
        let lastGoodSnapshotCandidates: ThreadSummary[] | null = allSummaries;
        const hasAuthoritativeEmptyCatalog =
          visibleSummaries.length === 0 &&
          !degradedPartialSource &&
          hasAuthoritativeCatalogMembershipProof(
            projectCatalogValue?.sourceStatuses,
          );
        const emptyListFallbackSource =
          visibleSummaries.length === 0 && !hasAuthoritativeEmptyCatalog
            ? (degradedPartialSource ?? "empty-thread-list")
            : null;
        if (emptyListFallbackSource) {
          lastGoodSnapshotCandidates = null;
          const fallbackThreads = filterRetainableContinuitySummaries(
            getLastGoodThreadSummaries(workspace.id),
            hiddenSharedBindingIds,
          );
          if (fallbackThreads.length > 0) {
            visibleSummaries = markThreadSummariesDegraded(
              fallbackThreads,
              emptyListFallbackSource,
              "last-good-fallback",
            );
            const diagnostic = buildPartialHistoryDiagnostic(
              `thread list fallback: ${emptyListFallbackSource}`,
            );
            onDebug?.({
              id: `${Date.now()}-client-thread-list-fallback`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/list fallback",
              payload: buildThreadDebugCorrelation(
                {
                  workspaceId: workspace.id,
                  action: "thread-list-fallback",
                  engine: "multi",
                  diagnosticCategory: diagnostic.category,
                  recoveryState: "degraded",
                },
                {
                  partialSource: emptyListFallbackSource,
                  fallbackCount: visibleSummaries.length,
                  diagnosticMessage: diagnostic.rawMessage,
                },
              ),
            });
          }
        } else if (degradedPartialSource) {
          if (shouldApplyClaudeSidebarContinuity(degradedPartialSource)) {
            visibleSummaries = mergeDegradedClaudeContinuitySummaries(
              visibleSummaries,
              getLastGoodThreadSummariesForEngine(workspace.id, "claude"),
              hiddenSharedBindingIds,
            );
          }
          if (shouldApplyCodexSidebarContinuity(degradedPartialSource)) {
            visibleSummaries = mergeDegradedCodexContinuitySummaries(
              visibleSummaries,
              getLastGoodThreadSummariesForEngine(workspace.id, "codex"),
            );
          }
          lastGoodSnapshotCandidates = visibleSummaries;
          visibleSummaries = markThreadSummariesDegraded(
            visibleSummaries,
            degradedPartialSource,
            "partial-thread-list",
          );
        }
        visibleSummaries = applySessionArchiveState(
          visibleSummaries,
          archivedSessionMap,
        );
        if (lastGoodSnapshotCandidates) {
          rememberLastGoodThreadSummariesByEngine(
            workspace.id,
            applySessionArchiveState(lastGoodSnapshotCandidates, archivedSessionMap),
            buildLastGoodSnapshotBlockedEngines(
              projectCatalogValue?.sourceStatuses,
              partialSourcesSeen,
            ),
          );
        }

        dispatch({
          type: "setThreads",
          workspaceId: workspace.id,
          threads: visibleSummaries,
        });
        appliedThreadListUpdate = true;
        if (hasHealthyThreadSummaries(visibleSummaries)) {
          latestThreadsByWorkspaceRef.current = {
            ...latestThreadsByWorkspaceRef.current,
            [workspace.id]: visibleSummaries,
          };
        }
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor: resolveThreadListCursorForDisplay({
            catalogCursor: projectCatalogValue?.nextCursor ?? null,
            catalogPartialSource: projectCatalogValue?.partialSource ?? null,
            runtimeCursor: cursor,
          }),
        });
        uniqueThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          const preview = asString(thread?.preview ?? "").trim();
          if (!threadId || !preview) {
            return;
          }
          dispatch({
            type: "setLastAgentMessage",
            threadId,
            text: preview,
            timestamp: getThreadTimestamp(thread),
          });
        });

        const hasAttemptedGeminiRefresh =
          geminiRefreshAttemptedRef.current[workspace.id] === true;
        const shouldRefreshGeminiSessions =
          hasGeminiSignal || !!cachedGemini || !hasAttemptedGeminiRefresh;
        if (shouldRefreshGeminiSessions) {
          void (async () => {
            geminiRefreshAttemptedRef.current[workspace.id] = true;
            const geminiResult = await withTimeout(
              listGeminiSessionsService(workspace.path, 50),
              GEMINI_SESSION_FETCH_TIMEOUT_MS,
            );
            if (threadListRequestSeqRef.current[workspace.id] !== requestSeq) {
              return;
            }
            if (geminiResult === null) {
              onDebug?.({
                id: `${Date.now()}-client-gemini-session-timeout`,
                timestamp: Date.now(),
                source: "client",
                label: "thread/list gemini timeout",
                payload: {
                  workspaceId: workspace.id,
                  timeoutMs: GEMINI_SESSION_FETCH_TIMEOUT_MS,
                },
              });
              return;
            }
            const normalizedGeminiSessions =
              normalizeGeminiSessionSummaries(geminiResult);
            geminiSessionCacheRef.current[workspace.id] = {
              fetchedAt: Date.now(),
              sessions: normalizedGeminiSessions,
            };
            const currentSnapshot =
              latestThreadsByWorkspaceRef.current[workspace.id] ?? [];
            const baselineSummaries =
              currentSnapshot.length > 0 ? currentSnapshot : allSummaries;
            const nextSummaries = mergeGeminiSessionSummaries(
              baselineSummaries,
              normalizedGeminiSessions.filter(
                (session) =>
                  !hiddenSharedBindingIds.has(`gemini:${session.sessionId}`),
              ),
              workspace.id,
              mappedTitles,
              getCustomName,
            );
            const visibleNextSummaries = applySessionArchiveState(
              nextSummaries,
              await archivedSessionMapPromise,
            );
            const unchanged =
              visibleNextSummaries.length === baselineSummaries.length &&
              visibleNextSummaries.every((entry, index) => {
                const prev = baselineSummaries[index];
                return (
                  !!prev &&
                  prev.id === entry.id &&
                  prev.name === entry.name &&
                  prev.updatedAt === entry.updatedAt &&
                  prev.engineSource === entry.engineSource &&
                  prev.threadKind === entry.threadKind
                );
              });
            if (!unchanged) {
              dispatch({
                type: "setThreads",
                workspaceId: workspace.id,
                threads: visibleNextSummaries,
              });
              latestThreadsByWorkspaceRef.current = {
                ...latestThreadsByWorkspaceRef.current,
                [workspace.id]: visibleNextSummaries,
              };
            }
          })();
        }
      } catch (error) {
        const fallbackThreads = filterRetainableContinuitySummaries(
          getLastGoodThreadSummaries(workspace.id),
        );
        if (isLatestThreadListRequest() && fallbackThreads.length > 0) {
          const fallbackMessage =
            error instanceof Error ? error.message : String(error);
          const archivedSessionMap = await archivedSessionMapPromise.catch(
            () => null,
          );
          const degradedThreads = markThreadSummariesDegraded(
            applySessionArchiveState(fallbackThreads, archivedSessionMap),
            fallbackMessage,
            "last-good-fallback",
          );
          dispatch({
            type: "setThreads",
            workspaceId: workspace.id,
            threads: degradedThreads,
          });
          appliedThreadListUpdate = true;
          const diagnostic = buildPartialHistoryDiagnostic(
            `thread list error fallback: ${fallbackMessage}`,
          );
          onDebug?.({
            id: `${Date.now()}-client-thread-list-error-fallback`,
            timestamp: Date.now(),
            source: "client",
            label: "thread/list error fallback",
            payload: buildThreadDebugCorrelation(
              {
                workspaceId: workspace.id,
                action: "thread-list-error-fallback",
                engine: "multi",
                diagnosticCategory: diagnostic.category,
                recoveryState: "degraded",
              },
              {
                fallbackCount: degradedThreads.length,
                diagnosticMessage: diagnostic.rawMessage,
              },
            ),
          });
        }
        onDebug?.({
          id: `${Date.now()}-client-thread-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/list error",
          payload: buildThreadDebugCorrelation(
            {
              workspaceId: workspace.id,
              action: "thread-list-error",
              engine: "multi",
              recoveryState: "recovering",
            },
            {
              error: error instanceof Error ? error.message : String(error),
            },
          ),
        });
      } finally {
        if (!preserveState && isLatestThreadListRequest()) {
          dispatch({
            type: "setThreadListLoading",
            workspaceId: workspace.id,
            isLoading: false,
          });
        }
      }
      return { applied: appliedThreadListUpdate };
    },
    [
      applySessionArchiveState,
      beginAutomaticRuntimeRecovery,
      canListWorkspaceSessions,
      dispatch,
      getCustomName,
      getAutomaticRuntimeRecoveryPartialSource,
      getLastGoodThreadSummaries,
      getLastGoodThreadSummariesForEngine,
      loadActiveProjectCatalogSessions,
      loadArchivedSessionMap,
      onDebug,
      onThreadTitleMappingsLoaded,
      rememberLastGoodThreadSummariesByEngine,
      activeThreadIdByWorkspace,
      threadActivityRef,
      threadsByWorkspace,
    ],
  );

  const loadOlderThreadsForWorkspace = useLoadOlderThreadsForWorkspace({
    activeThreadIdByWorkspace,
    applySessionArchiveState,
    canListWorkspaceSessions,
    dispatch,
    getCustomName,
    latestThreadsByWorkspaceRef,
    listWorkspaceSessionsService,
    loadArchivedSessionMap,
    onDebug,
    onThreadTitleMappingsLoaded,
    threadListCursorByWorkspace,
    threadsByWorkspace,
    workspacePathsByIdRef,
  });

  const archiveThread = useMemo(
    () => createArchiveThreadAction({ onDebug }),
    [onDebug],
  );

  const archiveClaudeThread = useMemo(
    () => createArchiveClaudeThreadAction({ onDebug, workspacePathsByIdRef }),
    [onDebug, workspacePathsByIdRef],
  );

  const deleteThreadForWorkspace = useMemo(() => {
    const deleteThread = createDeleteThreadForWorkspaceAction({
      archiveClaudeThread,
      threadsByWorkspace,
      workspacePathsByIdRef,
    });
    return async (workspaceId: string, threadId: string) => {
      await deleteThread(workspaceId, threadId);
      removeThreadFromCachedSummaries(workspaceId, threadId);
    };
  }, [
    archiveClaudeThread,
    removeThreadFromCachedSummaries,
    threadsByWorkspace,
    workspacePathsByIdRef,
  ]);

  return {
    startThreadForWorkspace,
    startSharedSessionForWorkspace,
    forkThreadForWorkspace,
    forkSessionFromMessageForWorkspace,
    forkClaudeSessionFromMessageForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
    archiveClaudeThread,
    deleteThreadForWorkspace,
    renameThreadTitleMapping,
    setThreadHistoryLoading,
    historyLoadingByThreadId,
  };
}
