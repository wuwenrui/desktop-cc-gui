import { useCallback, useMemo, useRef } from "react";
import type {
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
} from "../../../services/tauri";
import * as tauriServices from "../../../services/tauri";
import {
  getThreadTimestamp,
  previewThreadName,
} from "../../../utils/threadItems";
import { listSharedSessions as listSharedSessionsService } from "../../shared-session/services/sharedSessions";
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
  extractThreadSizeBytes,
  filterRetainableContinuitySummaries,
  hasHealthyThreadSummaries,
  isLocalSessionScanUnavailable,
  isRetainableEngineContinuitySummary,
  isWorkspaceNotConnectedError,
  markThreadSummariesDegraded,
  mergeCodexCatalogSessionSummaries,
  mergeDegradedCodexContinuitySummaries,
  mergeDegradedClaudeContinuitySummaries,
  mergeGeminiSessionSummaries,
  mergeThreadSummaryPreservingStableIdentity,
  normalizeGeminiSessionSummaries,
  normalizeThreadListPartialSource,
  resolveThreadSourceMeta,
  seedLastGoodClaudeIntoMerged,
  seedLastGoodOpenCodeIntoMerged,
  shouldIncludeWorkspaceThreadEntry,
  shouldApplyCodexSidebarContinuity,
  shouldApplyClaudeSidebarContinuity,
  withTimeout,
  type GeminiSessionSummary,
} from "./useThreadActions.helpers";
import {
  buildPartialHistoryDiagnostic,
} from "../utils/stabilityDiagnostics";
import { buildThreadDebugCorrelation } from "../utils/threadDebugCorrelation";
import { useThreadActionsSessionRuntime } from "./useThreadActionsSessionRuntime";
import { useThreadActionsSessionCatalog } from "./useThreadActionsSessionCatalog";
import {
  applySessionArchiveState,
  useReconcileMissingClaudeThread,
} from "./useThreadActions.localState";
import {
  useThreadActionsResumeThreadForWorkspace,
} from "./useThreadActionsResumeThread";
import { useLoadOlderThreadsForWorkspace } from "./useThreadActionsLoadOlder";
import { useThreadHistoryLoadingState } from "./useThreadHistoryLoadingState";
import {
  GEMINI_SESSION_CACHE_TTL_MS,
  GEMINI_SESSION_FETCH_TIMEOUT_MS,
  NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
  THREAD_LIST_LIVE_REQUEST_TIMEOUT_MS,
  THREAD_LIST_MAX_EMPTY_PAGES,
  THREAD_LIST_MAX_EMPTY_PAGES_WITH_ACTIVITY,
  THREAD_LIST_MAX_FETCH_DURATION_MS,
  THREAD_LIST_MAX_TOTAL_PAGES,
  THREAD_LIST_PAGE_SIZE,
  THREAD_LIST_TARGET_COUNT,
  countCatalogSessionsByEngine,
  countSummariesByEngine,
  resolveNativeSessionListLimit,
  resolveThreadListCursorForDisplay,
  type StartupThreadHydrationMode,
} from "./useThreadActions.threadList";
import {
  buildLastGoodSnapshotBlockedEngines,
  findCatalogSourceStatusForEngine,
  hasAuthoritativeCatalogMembershipProof,
  isIncompleteCatalogSourceStatus,
  type ThreadEngineSource,
  type LastGoodThreadSummariesByEngine,
  useThreadActionsLastGoodSnapshots,
} from "./useThreadActions.lastGoodSnapshots";
import type { UseThreadActionsOptions } from "./useThreadActions.types";

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
  const {
    getLastGoodThreadSummaries,
    getLastGoodThreadSummariesForEngine,
    rememberLastGoodThreadSummariesByEngine,
    removeThreadFromCachedSummaries,
  } = useThreadActionsLastGoodSnapshots({
    latestThreadsByWorkspaceRef,
    previousThreadsByWorkspaceRef,
    lastGoodThreadSummariesByWorkspaceEngineRef,
    threadsByWorkspace,
  });

  const reconcileMissingClaudeThread = useReconcileMissingClaudeThread({
    activeThreadIdByWorkspace,
    dispatch,
    itemsByThread,
    loadedThreadsRef,
    onDebug,
    removeThreadFromCachedSummaries,
  });

  const renameThreadTitleMapping = useMemo(
    () =>
      createRenameThreadTitleMappingAction({
        getCustomName,
        onRenameThreadTitleMapping,
      }),
    [getCustomName, onRenameThreadTitleMapping],
  );

  const resumeThreadForWorkspace = useThreadActionsResumeThreadForWorkspace({
    activeThreadIdByWorkspace,
    applyCollabThreadLinksFromThread,
    dispatch,
    getCustomName,
    itemsByThread,
    loadedThreadsRef,
    onDebug,
    rememberThreadAlias,
    clearThreadAlias,
    replaceOnResumeRef,
    reconcileMissingClaudeThread,
    resolveWorkspacePath,
    threadActivityRef,
    threadStatusById,
    threadsByWorkspace,
    updateThreadParent,
    userInputRequests,
    useUnifiedHistoryLoader,
    workspacePathsByIdRef,
    latestThreadsByWorkspaceRef,
    previousThreadsByWorkspaceRef,
    threadListCursorByWorkspace,
  });

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
        deletedThreadIds?: string[];
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
      const deletedThreadIds = [
        ...new Set(
          (options?.deletedThreadIds ?? [])
            .map((threadId) => threadId.trim())
            .filter(Boolean),
        ),
      ];
      const deletedThreadIdSet = new Set(deletedThreadIds);
      const filterDeletedSummaries = (summaries: ThreadSummary[]) =>
        deletedThreadIdSet.size === 0
          ? summaries
          : summaries.filter((summary) => !deletedThreadIdSet.has(summary.id));
      const filterRootVisibleAutomaticSummaries = (summaries: ThreadSummary[]) =>
        summaries.filter(
          (summary) => summary.autoSession?.visibility !== "hidden",
        );
      const getLastGoodThreadSummariesWithoutDeleted = () =>
        filterRootVisibleAutomaticSummaries(
          filterDeletedSummaries(getLastGoodThreadSummaries(workspace.id)),
        );
      const getLastGoodThreadSummariesForEngineWithoutDeleted = (
        engine: ThreadEngineSource,
      ) =>
        filterRootVisibleAutomaticSummaries(
          filterDeletedSummaries(
            getLastGoodThreadSummariesForEngine(workspace.id, engine),
          ),
        );
      const recoverySource = options?.recoverySource ?? "thread-list-live";
      const allowRuntimeReconnect = options?.allowRuntimeReconnect ?? true;
      let appliedThreadListUpdate = false;
      const workspacePath = normalizeComparableWorkspacePath(workspace.path);
      deletedThreadIds.forEach((threadId) => {
        loadedThreadsRef.current[threadId] = false;
        removeThreadFromCachedSummaries(workspace.id, threadId);
        dispatch({ type: "removeThread", workspaceId: workspace.id, threadId });
      });
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
        const existingThreads = filterDeletedSummaries(
          threadsByWorkspace[workspace.id] ?? [],
        );
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
        const opencodeSessionsPromise = includeOpenCodeSessions
          ? withTimeout(
              getOpenCodeSessionListService(workspace.id),
              NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS,
            )
          : Promise.resolve(
              [] as Awaited<ReturnType<typeof getOpenCodeSessionListService>>,
            );
        const projectCatalogSessionsPromise = canListWorkspaceSessions
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
              getLastGoodThreadSummariesForEngineWithoutDeleted("claude"),
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
            getLastGoodThreadSummariesForEngineWithoutDeleted("claude"),
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
              getLastGoodThreadSummariesForEngineWithoutDeleted("opencode"),
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
            getLastGoodThreadSummariesForEngineWithoutDeleted("opencode"),
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
          ).filter(
            (entry) =>
              !hiddenSharedBindingIds.has(entry.sessionId) &&
              !deletedThreadIdSet.has(entry.sessionId),
          );
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
            getLastGoodThreadSummariesWithoutDeleted(),
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
              getLastGoodThreadSummariesForEngineWithoutDeleted("claude"),
              hiddenSharedBindingIds,
            );
          }
          if (shouldApplyCodexSidebarContinuity(degradedPartialSource)) {
            visibleSummaries = mergeDegradedCodexContinuitySummaries(
              visibleSummaries,
              getLastGoodThreadSummariesForEngineWithoutDeleted("codex"),
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
          filterRootVisibleAutomaticSummaries(
            filterDeletedSummaries(visibleSummaries),
          ),
          archivedSessionMap,
        );
        if (lastGoodSnapshotCandidates) {
          rememberLastGoodThreadSummariesByEngine(
            workspace.id,
            applySessionArchiveState(
              filterRootVisibleAutomaticSummaries(
                filterDeletedSummaries(lastGoodSnapshotCandidates),
              ),
              archivedSessionMap,
            ),
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
      beginAutomaticRuntimeRecovery,
      canListWorkspaceSessions,
      dispatch,
      getCustomName,
      getAutomaticRuntimeRecoveryPartialSource,
      getLastGoodThreadSummaries,
      getLastGoodThreadSummariesForEngine,
      loadActiveProjectCatalogSessions,
      loadArchivedSessionMap,
      loadedThreadsRef,
      onDebug,
      onThreadTitleMappingsLoaded,
      rememberLastGoodThreadSummariesByEngine,
      removeThreadFromCachedSummaries,
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
