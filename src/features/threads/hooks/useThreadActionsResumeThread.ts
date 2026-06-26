import { useCallback, type MutableRefObject } from "react";
import type { ConversationItem, ThreadSummary } from "../../../types";
import {
  listThreads as listThreadsService,
  getOpenCodeSessionList as getOpenCodeSessionListService,
  loadClaudeSession as loadClaudeSessionService,
  loadGeminiSession as loadGeminiSessionService,
  resumeThread as resumeThreadService,
} from "../../../services/tauri";
import {
  buildItemsFromThread,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import { parseClaudeHistoryMessagesWithShadowRecovery } from "../loaders/claudeHistoryLoader";
import { parseGeminiHistoryMessages } from "../loaders/geminiHistoryParser";
import { hydrateHistory } from "../assembly/conversationAssembler";
import { asString } from "../utils/threadNormalize";
import {
  collectKnownCodexThreadIds,
  normalizeComparableWorkspacePath,
} from "./useThreadActions.workspacePath";
import {
  createThreadHistoryContinuationDecisionDebugEntry,
  createThreadHistoryReadableSurfaceDebugEntry,
} from "./useThreadActions.recoveryDiagnostics";
import {
  collectRelatedThreadIdsFromSnapshot,
  extractThreadSizeBytes,
  inferThreadEngineSource,
  isAskUserQuestionToolItem,
  shouldIncludeWorkspaceThreadEntry,
  isLocalSessionScanUnavailable,
  isTerminalToolStatus,
  isThreadResumeNotFoundError,
  listReplacementThreadCandidates,
  mapWithConcurrency,
  mergeRecoveredThreadSummaries,
  resolveThreadSourceMeta,
  restoreThreadParentLinksFromSnapshot,
  selectRecoveredNewThreadDecision,
  selectReplacementThreadByMessageHistoryDecision,
  selectReplacementThreadDecision,
  shouldReplaceUserInputQueueFromSnapshot,
  type ThreadRecoveryDecision,
} from "./useThreadActions.helpers";
import {
  buildPartialHistoryDiagnostic,
  resolveThreadStabilityDiagnostic,
} from "../utils/stabilityDiagnostics";
import { createThreadHistoryLoaderForThread } from "./useThreadActions.historyLoaderFactory";
import {
  DEFAULT_CLAUDE_CONTEXT_WINDOW,
  RELATED_THREAD_LOAD_CONCURRENCY,
  THREAD_LIST_PAGE_SIZE,
  THREAD_RECOVERY_HISTORY_MATCH_CANDIDATES,
  THREAD_RECOVERY_MAX_FETCH_DURATION_MS,
  THREAD_RECOVERY_MAX_PAGES,
} from "./useThreadActions.threadList";
import { type UseThreadActionsOptions } from "./useThreadActions.types";

export type ResumeThreadForWorkspaceOptions = {
  preferLocalCodexHistory?: boolean;
};

type ResumeThreadForWorkspaceContext = UseThreadActionsOptions & {
  reconcileMissingClaudeThread: (workspaceId: string, threadId: string) => boolean;
  workspacePathsByIdRef: MutableRefObject<Record<string, string>>;
  latestThreadsByWorkspaceRef: MutableRefObject<Record<string, ThreadSummary[]>>;
  previousThreadsByWorkspaceRef: MutableRefObject<Record<string, ThreadSummary[]>>;
};

type ResumeThreadForWorkspaceCallback = (
  workspaceId: string,
  threadId: string,
  force?: boolean,
  replaceLocal?: boolean,
  options?: { preferLocalCodexHistory?: boolean },
) => Promise<string | null>;

export function useThreadActionsResumeThreadForWorkspace(
  deps: ResumeThreadForWorkspaceContext,
): ResumeThreadForWorkspaceCallback {
  const {
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
    useUnifiedHistoryLoader = false,
    workspacePathsByIdRef,
    latestThreadsByWorkspaceRef,
    previousThreadsByWorkspaceRef,
  } = deps;

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
          createThreadHistoryLoaderForThread({
            targetThreadId,
            workspaceId,
            workspacePath:
              workspacePathsByIdRef.current[workspaceId] ??
              resolveWorkspacePath?.(workspaceId) ??
              null,
            preferLocalCodexHistory: options?.preferLocalCodexHistory === true,
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
          if (relatedThreadIds.length > 0) {
            onDebug?.({
              id: `${Date.now()}-history-loader-related-deferred`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/history related deferred",
              payload: {
                workspaceId,
                threadId: effectiveThreadId,
                relatedThreadCount: relatedThreadIds.length,
              },
            });
          }
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
              workspacePathsByIdRef.current[workspaceId] ??
                resolveWorkspacePath?.(workspaceId) ??
                "",
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
                if (
                  replacementCandidate.summary &&
                  (replacementCandidate.isPersistent || !cursor)
                ) {
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
            return {
              threadId: summaryMatch.summary.id,
              decision: summaryMatch,
            };
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
      const workspacePath =
        workspacePathsByIdRef.current[workspaceId] ??
        resolveWorkspacePath?.(workspaceId) ??
        "";
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

            const items = parseClaudeHistoryMessagesWithShadowRecovery({
              messagesData,
              workspacePath,
              workspaceId,
              threadId,
            });
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
                reopenOutcome:
                  localItems.length > 0 ? "degraded-readable" : "failed",
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
      latestThreadsByWorkspaceRef,
      loadedThreadsRef,
      onDebug,
      clearThreadAlias,
      previousThreadsByWorkspaceRef,
      rememberThreadAlias,
      replaceOnResumeRef,
      reconcileMissingClaudeThread,
      resolveWorkspacePath,
      threadActivityRef,
      threadStatusById,
      threadsByWorkspace,
      userInputRequests,
      useUnifiedHistoryLoader,
      workspacePathsByIdRef,
    ],
  );
  return resumeThreadForWorkspace;
}
