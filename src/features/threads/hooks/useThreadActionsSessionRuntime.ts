import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, MutableRefObject } from "react";

import type { DebugEntry } from "../../../types";
import type { AutoSessionMetadata } from "../../../services/tauri";
import type { CodexProviderProfileOption } from "../constants/codexProviderProfiles";
import {
  connectWorkspace as connectWorkspaceService,
  deleteClaudeSession as deleteClaudeSessionService,
  deleteCodexSession as deleteCodexSessionService,
  forkClaudeSessionFromMessage as forkClaudeSessionFromMessageService,
  forkThread as forkThreadService,
  loadClaudeSession as loadClaudeSessionService,
  rewindCodexThread as rewindCodexThreadService,
  setThreadTitle as setThreadTitleService,
  startThread as startThreadService,
} from "../../../services/tauri";
import { parseClaudeHistoryMessagesWithShadowRecovery } from "../loaders/claudeHistoryLoader";
import {
  applyClaudeRewindWorkspaceRestore,
  findImpactedClaudeRewindItems,
  restoreClaudeRewindWorkspaceSnapshots,
} from "../utils/claudeRewindRestore";
import {
  isClaudeForkThreadId,
  isClaudeRuntimeThreadId,
} from "../utils/claudeForkThread";
import {
  findFirstHistoryUserMessageId,
  findLastUserMessageIndexById,
  findLatestHistoryUserMessageId,
  isUserConversationMessage,
  isWorkspaceNotConnectedError,
  normalizeComparableRewindText,
  resolveClaudeRewindMessageIdFromHistory,
  resolveRewindSupportedEngine,
} from "./useThreadActions.helpers";
import {
  createStartSharedSessionForWorkspace,
} from "./useThreadActions.sessionActions";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";
import {
  normalizeRewindMode,
  shouldRestoreWorkspaceFiles,
  shouldRewindMessages,
  type RewindMode,
} from "../utils/rewindMode";
import {
  buildClaudeForkThreadId,
  createSessionLifecycleThreadStarter,
  extractProviderBindingFromStartedThread,
  extractThreadId,
  providerBindingFromSelectedProfile,
  resolveClaudeForkThreadName,
} from "./sessionLifecycleController";

type OnDebug = (entry: DebugEntry) => void;

type ResumeThreadForWorkspace = (
  workspaceId: string,
  threadId: string,
  force?: boolean,
  replaceLocal?: boolean,
  options?: { preferLocalCodexHistory?: boolean },
) => Promise<string | null>;

type RewindFromMessageOptions = {
  activate?: boolean;
  mode?: RewindMode;
  providerProfileId?: string | null;
  providerProfile?: CodexProviderProfileOption | null;
};

type UseThreadActionsSessionRuntimeOptions = {
  activeThreadIdByWorkspace: ThreadState["activeThreadIdByWorkspace"];
  dispatch: Dispatch<ThreadAction>;
  itemsByThread: ThreadState["itemsByThread"];
  loadedThreadsRef: MutableRefObject<Record<string, boolean>>;
  onDebug?: OnDebug;
  renameThreadTitleMapping: (
    workspaceId: string,
    oldThreadId: string,
    newThreadId: string,
  ) => Promise<void>;
  resumeThreadForWorkspace: ResumeThreadForWorkspace;
  threadsByWorkspace: ThreadState["threadsByWorkspace"];
  workspacePathsByIdRef: MutableRefObject<Record<string, string>>;
};

export function useThreadActionsSessionRuntime({
  activeThreadIdByWorkspace,
  dispatch,
  itemsByThread,
  loadedThreadsRef,
  onDebug,
  renameThreadTitleMapping,
  resumeThreadForWorkspace,
  threadsByWorkspace,
  workspacePathsByIdRef,
}: UseThreadActionsSessionRuntimeOptions) {
  const claudeRewindInFlightByThreadRef = useRef<Record<string, boolean>>({});
  const codexStartInFlightByKeyRef = useRef<
    Record<string, Promise<string | null> | undefined>
  >({});

  const startThreadForWorkspace = useCallback(
    async (
      workspaceId: string,
      options?: {
        activate?: boolean;
        engine?: "claude" | "codex" | "gemini" | "opencode";
        folderId?: string | null;
        autoSession?: AutoSessionMetadata | null;
        providerProfileId?: string | null;
        providerProfile?: CodexProviderProfileOption | null;
      },
    ) => {
      const shouldActivate = options?.activate !== false;
      const engine = options?.engine;
      const folderId = options?.folderId?.trim() || null;
      const autoSession = options?.autoSession ?? null;
      const selectedProviderBinding = providerBindingFromSelectedProfile(
        options?.providerProfile,
        options?.providerProfileId,
      );
      const providerProfileId =
        selectedProviderBinding.providerProfileId?.trim() || null;
      const autoSessionPayload = autoSession ? { autoSession } : {};
      const providerProfilePayload = providerProfileId ? { providerProfileId } : {};
      const startThreadOptions =
        autoSession || providerProfileId
          ? { ...autoSessionPayload, ...providerProfilePayload }
          : undefined;
      const startThreadWithOptionalMetadata = () =>
        startThreadOptions
          ? startThreadService(workspaceId, startThreadOptions)
          : startThreadService(workspaceId);
      const autoSessionKey = options?.autoSession
        ? `${options.autoSession.sessionPurpose}:${options.autoSession.visibility}`
        : "user-visible";
      const providerProfileKey = providerProfileId ?? "__disk__";
      const codexStartInFlightKey = `${workspaceId}:codex:${providerProfileKey}:${folderId ?? "__root__"}:${autoSessionKey}`;
      const resolveStartedThread = createSessionLifecycleThreadStarter({
        dispatch,
        loadedThreadsRef,
        workspaceId,
        folderId,
        shouldActivate,
        autoSessionPayload,
        selectedProviderBinding,
      });

      if (engine === "claude" || engine === "gemini" || engine === "opencode") {
        const prefix = engine;
        const threadId = `${prefix}-pending-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        onDebug?.({
          id: `${Date.now()}-client-thread-start`,
          timestamp: Date.now(),
          source: "client",
          label: `thread/start (${engine})`,
          payload: { workspaceId, threadId, engine },
        });
        dispatch({
          type: "ensureThread",
          workspaceId,
          threadId,
          engine,
          ...(folderId ? { folderId } : {}),
          ...autoSessionPayload,
        });
        if (shouldActivate) {
          dispatch({ type: "setActiveThreadId", workspaceId, threadId });
        }
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      }

      const runCodexStart = async () => {
        onDebug?.({
          id: `${Date.now()}-client-thread-start`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/start",
          payload: { workspaceId, providerProfileId: providerProfileId ?? "__disk__" },
        });
        try {
          const response = await startThreadWithOptionalMetadata();
          onDebug?.({
            id: `${Date.now()}-server-thread-start`,
            timestamp: Date.now(),
            source: "server",
            label: "thread/start response",
            payload: response,
          });
          return resolveStartedThread(response);
        } catch (error) {
          if (isWorkspaceNotConnectedError(error)) {
            onDebug?.({
              id: `${Date.now()}-client-workspace-reconnect-before-thread-start`,
              timestamp: Date.now(),
              source: "client",
              label: "workspace/reconnect before thread start",
              payload: { workspaceId },
            });
            try {
              await connectWorkspaceService(workspaceId);
              const retryResponse = await startThreadWithOptionalMetadata();
              onDebug?.({
                id: `${Date.now()}-server-thread-start-retry`,
                timestamp: Date.now(),
                source: "server",
                label: "thread/start retry response",
                payload: retryResponse,
              });
              return resolveStartedThread(retryResponse);
            } catch (retryError) {
              onDebug?.({
                id: `${Date.now()}-client-thread-start-error`,
                timestamp: Date.now(),
                source: "error",
                label: "thread/start error",
                payload: retryError instanceof Error ? retryError.message : String(retryError),
              });
              throw retryError;
            }
          }
          onDebug?.({
            id: `${Date.now()}-client-thread-start-error`,
            timestamp: Date.now(),
            source: "error",
            label: "thread/start error",
            payload: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      };

      const existingStart = codexStartInFlightByKeyRef.current[codexStartInFlightKey];
      if (existingStart) {
        onDebug?.({
          id: `${Date.now()}-client-thread-start-reuse`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/start reuse",
          payload: { workspaceId, folderId, providerProfileId: providerProfileId ?? "__disk__" },
        });
        const threadId = await existingStart;
        if (threadId && shouldActivate) {
          dispatch({ type: "setActiveThreadId", workspaceId, threadId });
        }
        return threadId;
      }

      const startPromise = runCodexStart();
      codexStartInFlightByKeyRef.current[codexStartInFlightKey] = startPromise;
      try {
        return await startPromise;
      } finally {
        if (codexStartInFlightByKeyRef.current[codexStartInFlightKey] === startPromise) {
          delete codexStartInFlightByKeyRef.current[codexStartInFlightKey];
        }
      }
    },
    [dispatch, loadedThreadsRef, onDebug],
  );

  const startSharedSessionForWorkspace = useMemo(
    () => createStartSharedSessionForWorkspace({
      dispatch,
      extractThreadId,
      loadedThreadsRef,
      onDebug,
      threadsByWorkspace,
    }),
    [dispatch, loadedThreadsRef, onDebug, threadsByWorkspace],
  );

  const forkThreadForWorkspace = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      options?: {
        activate?: boolean;
        providerProfileId?: string | null;
        providerProfile?: CodexProviderProfileOption | null;
      },
    ) => {
      if (!threadId) {
        return null;
      }
      const shouldActivate = options?.activate !== false;
      const selectedProviderBinding = providerBindingFromSelectedProfile(
        options?.providerProfile,
        options?.providerProfileId,
      );
      const providerProfileId =
        selectedProviderBinding.providerProfileId?.trim() || null;
      onDebug?.({
        id: `${Date.now()}-client-thread-fork`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/fork",
        payload: { workspaceId, threadId, providerProfileId },
      });
      try {
        let response: Record<string, unknown> | null | undefined;
        if (threadId.startsWith("claude:")) {
          const sessionId = threadId.slice("claude:".length).trim();
          if (!sessionId) {
            return null;
          }
          response = {
            thread: {
              id: buildClaudeForkThreadId(sessionId),
            },
            parentSessionId: sessionId,
          };
        } else if (threadId.startsWith("claude-pending-")) {
          return null;
        } else if (
          threadId.startsWith("gemini:") ||
          threadId.startsWith("gemini-pending-")
        ) {
          return null;
        } else {
          response = await forkThreadService(workspaceId, threadId, null, {
            providerProfileId,
          });
        }
        onDebug?.({
          id: `${Date.now()}-server-thread-fork`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/fork response",
          payload: response,
        });
        const forkedThreadId = extractThreadId(response);
        if (!forkedThreadId) {
          return null;
        }
        const forkedEngine = isClaudeRuntimeThreadId(forkedThreadId)
          ? "claude"
          : forkedThreadId.startsWith("gemini:")
            ? "gemini"
            : "codex";
        dispatch({
          type: "ensureThread",
          workspaceId,
          threadId: forkedThreadId,
          engine: forkedEngine,
          ...extractProviderBindingFromStartedThread(response, selectedProviderBinding),
        });
        if (shouldActivate) {
          dispatch({
            type: "setActiveThreadId",
            workspaceId,
            threadId: forkedThreadId,
          });
        }
        if (isClaudeForkThreadId(forkedThreadId)) {
          const forkThreadName = resolveClaudeForkThreadName({
            workspaceId,
            parentThreadId: threadId,
            threadsByWorkspace,
            itemsByThread,
          });
          dispatch({
            type: "setThreadName",
            workspaceId,
            threadId: forkedThreadId,
            name: forkThreadName,
          });
          await setThreadTitleService(workspaceId, forkedThreadId, forkThreadName).catch(() => {
            // Best-effort only. The in-memory sidebar title is already set.
          });
          dispatch({
            type: "setThreadItems",
            threadId: forkedThreadId,
            items: itemsByThread[threadId] ?? [],
          });
          loadedThreadsRef.current[forkedThreadId] = true;
          return forkedThreadId;
        }
        loadedThreadsRef.current[forkedThreadId] = false;
        await resumeThreadForWorkspace(workspaceId, forkedThreadId, true, true);
        return forkedThreadId;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-fork-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/fork error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [
      dispatch,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      resumeThreadForWorkspace,
      threadsByWorkspace,
    ],
  );

  const forkClaudeSessionFromMessageForWorkspace = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      messageId: string,
      options?: RewindFromMessageOptions,
    ) => {
      if (!threadId.startsWith("claude:")) {
        return null;
      }
      const normalizedMessageId = messageId.trim();
      if (!normalizedMessageId) {
        return null;
      }
      const workspacePath = workspacePathsByIdRef.current[workspaceId];
      if (!workspacePath) {
        return null;
      }
      const sessionId = threadId.slice("claude:".length).trim();
      if (!sessionId) {
        return null;
      }
      const shouldActivate = options?.activate !== false;
      const rewindMode = normalizeRewindMode(options?.mode);
      const shouldRestoreFiles = shouldRestoreWorkspaceFiles(rewindMode);
      const shouldRewindSession = shouldRewindMessages(rewindMode);
      const rewindLockKey = `${workspaceId}:${threadId}`;
      if (claudeRewindInFlightByThreadRef.current[rewindLockKey]) {
        return null;
      }
      claudeRewindInFlightByThreadRef.current[rewindLockKey] = true;
      onDebug?.({
        id: `${Date.now()}-client-thread-fork-from-message`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/fork from message",
        payload: { workspaceId, threadId, messageId: normalizedMessageId },
      });
      let rewindRestoreState:
        | Awaited<ReturnType<typeof applyClaudeRewindWorkspaceRestore>>
        | null = null;
      try {
        const threadItems = itemsByThread[threadId] ?? [];
        const historyResponse = await loadClaudeSessionService(
          workspacePath,
          sessionId,
        );
        const historyRecord =
          historyResponse && typeof historyResponse === "object"
            ? (historyResponse as Record<string, unknown>)
            : {};
        const historyItems = parseClaudeHistoryMessagesWithShadowRecovery({
          messagesData: historyRecord.messages,
          workspacePath,
          workspaceId,
          threadId,
        });
        const firstHistoryMessageId = findFirstHistoryUserMessageId(historyItems);
        const latestHistoryMessageId = findLatestHistoryUserMessageId(historyItems);
        if (!latestHistoryMessageId) {
          return null;
        }
        const requestedHistoryMessageId = resolveClaudeRewindMessageIdFromHistory({
          requestedMessageId: normalizedMessageId,
          threadItems,
          historyItems,
        });
        const resolvedMessageId = requestedHistoryMessageId.trim();
        if (!resolvedMessageId) {
          return null;
        }
        const impactedItems = findImpactedClaudeRewindItems(
          threadItems,
          normalizedMessageId,
        );
        onDebug?.({
          id: `${Date.now()}-client-thread-fork-from-message-resolved`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/fork from message resolved",
          payload: {
            workspaceId,
            threadId,
            requestedMessageId: normalizedMessageId,
            resolvedMessageId,
            firstHistoryMessageId,
            latestHistoryMessageId,
          },
        });
        if (shouldRestoreFiles) {
          rewindRestoreState = await applyClaudeRewindWorkspaceRestore({
            workspaceId,
            workspacePath,
            impactedItems,
          });
          if ((rewindRestoreState?.ignoredCommittedPaths?.length ?? 0) > 0) {
            onDebug?.({
              id: `${Date.now()}-client-thread-fork-from-message-restore-committed-ignored`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/fork from message restore committed ignored",
              payload: {
                workspaceId,
                threadId,
                ignoredCommittedPaths:
                  rewindRestoreState?.ignoredCommittedPaths ?? [],
              },
            });
          }
          if ((rewindRestoreState?.skippedPaths?.length ?? 0) > 0) {
            onDebug?.({
              id: `${Date.now()}-client-thread-fork-from-message-restore-skipped`,
              timestamp: Date.now(),
              source: "error",
              label: "thread/fork from message restore skipped",
              payload: {
                workspaceId,
                threadId,
                skippedPaths: rewindRestoreState?.skippedPaths ?? [],
              },
            });
          }
        }
        if (!shouldRewindSession) {
          return threadId;
        }
        if (firstHistoryMessageId && resolvedMessageId === firstHistoryMessageId) {
          await deleteClaudeSessionService(workspacePath, sessionId);
          delete loadedThreadsRef.current[threadId];
          dispatch({
            type: "removeThread",
            workspaceId,
            threadId,
          });
          return threadId;
        }
        const response = await forkClaudeSessionFromMessageService(
          workspacePath,
          sessionId,
          resolvedMessageId,
        );
        onDebug?.({
          id: `${Date.now()}-server-thread-fork-from-message`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/fork from message response",
          payload: response,
        });
        const forkedThreadId = extractThreadId(response);
        if (!forkedThreadId) {
          if (shouldRestoreFiles && rewindRestoreState?.originalSnapshots?.length) {
            await restoreClaudeRewindWorkspaceSnapshots(
              workspaceId,
              rewindRestoreState.originalSnapshots,
            );
          }
          return null;
        }
        dispatch({
          type: "renameThreadId",
          workspaceId,
          oldThreadId: threadId,
          newThreadId: forkedThreadId,
        });
        dispatch({
          type: "hideThread",
          workspaceId,
          threadId,
        });
        await renameThreadTitleMapping(workspaceId, threadId, forkedThreadId);
        if (shouldActivate && !activeThreadIdByWorkspace[workspaceId]) {
          dispatch({
            type: "setActiveThreadId",
            workspaceId,
            threadId: forkedThreadId,
          });
        }
        delete loadedThreadsRef.current[threadId];
        loadedThreadsRef.current[forkedThreadId] = false;
        await resumeThreadForWorkspace(workspaceId, forkedThreadId, true, true);
        try {
          await deleteClaudeSessionService(workspacePath, sessionId);
        } catch (error) {
          onDebug?.({
            id: `${Date.now()}-client-thread-fork-from-message-delete-source-error`,
            timestamp: Date.now(),
            source: "error",
            label: "thread/fork from message delete source error",
            payload: error instanceof Error ? error.message : String(error),
          });
        }
        return forkedThreadId;
      } catch (error) {
        try {
          if (shouldRestoreFiles && rewindRestoreState?.originalSnapshots?.length) {
            await restoreClaudeRewindWorkspaceSnapshots(
              workspaceId,
              rewindRestoreState.originalSnapshots,
            );
          }
        } catch {
          // Best effort rollback is handled in the main rewind path below.
        }
        onDebug?.({
          id: `${Date.now()}-client-thread-fork-from-message-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/fork from message error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return null;
      } finally {
        delete claudeRewindInFlightByThreadRef.current[rewindLockKey];
      }
    },
    [
      activeThreadIdByWorkspace,
      dispatch,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      renameThreadTitleMapping,
      resumeThreadForWorkspace,
      workspacePathsByIdRef,
    ],
  );

  const forkSessionFromMessageForWorkspace = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      messageId: string,
      options?: RewindFromMessageOptions,
    ) => {
      const canonicalThreadId = threadId.trim();
      const rewindEngine = resolveRewindSupportedEngine(canonicalThreadId);
      if (!rewindEngine) {
        return null;
      }
      if (rewindEngine === "claude") {
        const claudeThreadId = canonicalThreadId.replace(/^claude:/i, "claude:");
        return forkClaudeSessionFromMessageForWorkspace(
          workspaceId,
          claudeThreadId,
          messageId,
          options,
        );
      }

      const normalizedMessageId = messageId.trim();
      if (!normalizedMessageId) {
        return null;
      }
      const workspacePath = workspacePathsByIdRef.current[workspaceId];
      if (!workspacePath) {
        return null;
      }
      const shouldActivate = options?.activate !== false;
      const selectedProviderBinding = providerBindingFromSelectedProfile(
        options?.providerProfile,
        options?.providerProfileId,
      );
      const providerProfileId =
        selectedProviderBinding.providerProfileId?.trim() || null;
      const rewindMode = normalizeRewindMode(options?.mode);
      const shouldRestoreFiles = shouldRestoreWorkspaceFiles(rewindMode);
      const shouldRewindSession = shouldRewindMessages(rewindMode);
      const rewindLockKey = `${workspaceId}:${canonicalThreadId}`;
      if (claudeRewindInFlightByThreadRef.current[rewindLockKey]) {
        return null;
      }
      claudeRewindInFlightByThreadRef.current[rewindLockKey] = true;
      onDebug?.({
        id: `${Date.now()}-client-thread-codex-fork-from-message`,
        timestamp: Date.now(),
        source: "client",
        label: "codex/thread/fork from message",
        payload: {
          workspaceId,
          threadId: canonicalThreadId,
          messageId: normalizedMessageId,
          providerProfileId,
        },
      });
      let rewindRestoreState:
        | Awaited<ReturnType<typeof applyClaudeRewindWorkspaceRestore>>
        | null = null;
      try {
        const threadItems = itemsByThread[canonicalThreadId] ?? [];
        const userThreadItems = threadItems.filter(isUserConversationMessage);
        const targetUserTurnIndex = findLastUserMessageIndexById(
          userThreadItems,
          normalizedMessageId,
        );
        if (targetUserTurnIndex < 0) {
          onDebug?.({
            id: `${Date.now()}-client-thread-codex-fork-from-message-target-missing`,
            timestamp: Date.now(),
            source: "client",
            label: "codex/thread/fork from message target missing",
            payload: {
              workspaceId,
              threadId: canonicalThreadId,
              messageId: normalizedMessageId,
              reason: "localTargetMissing",
            },
          });
          return null;
        }
        const targetUserMessageText = normalizeComparableRewindText(
          userThreadItems[targetUserTurnIndex]?.text ?? "",
        );
        const targetUserMessageOccurrence = targetUserMessageText
          ? userThreadItems.reduce((count, item, index) => {
              if (index > targetUserTurnIndex) {
                return count;
              }
              return normalizeComparableRewindText(item.text) === targetUserMessageText
                ? count + 1
                : count;
            }, 0) || 1
          : undefined;
        const impactedItems = findImpactedClaudeRewindItems(
          threadItems,
          normalizedMessageId,
        );
        if (shouldRestoreFiles) {
          rewindRestoreState = await applyClaudeRewindWorkspaceRestore({
            workspaceId,
            workspacePath,
            impactedItems,
          });
          if ((rewindRestoreState?.ignoredCommittedPaths?.length ?? 0) > 0) {
            onDebug?.({
              id: `${Date.now()}-client-thread-codex-fork-from-message-restore-committed-ignored`,
              timestamp: Date.now(),
              source: "client",
              label: "codex/thread/fork from message restore committed ignored",
              payload: {
                workspaceId,
                threadId: canonicalThreadId,
                ignoredCommittedPaths:
                  rewindRestoreState?.ignoredCommittedPaths ?? [],
              },
            });
          }
          if ((rewindRestoreState?.skippedPaths?.length ?? 0) > 0) {
            onDebug?.({
              id: `${Date.now()}-client-thread-codex-fork-from-message-restore-skipped`,
              timestamp: Date.now(),
              source: "error",
              label: "codex/thread/fork from message restore skipped",
              payload: {
                workspaceId,
                threadId: canonicalThreadId,
                skippedPaths: rewindRestoreState?.skippedPaths ?? [],
              },
            });
          }
        }
        if (!shouldRewindSession) {
          return canonicalThreadId;
        }

        if (providerProfileId) {
          const response = await forkThreadService(
            workspaceId,
            canonicalThreadId,
            normalizedMessageId,
            {
              providerProfileId,
              targetUserTurnIndex,
              targetUserMessageText:
                targetUserMessageText.length > 0
                  ? targetUserMessageText
                  : undefined,
              targetUserMessageOccurrence,
              localUserMessageCount: userThreadItems.length,
            },
          );
          onDebug?.({
            id: `${Date.now()}-server-thread-codex-provider-fork-from-message`,
            timestamp: Date.now(),
            source: "server",
            label: "codex/thread/provider fork from message response",
            payload: response,
          });
          const forkedThreadId = extractThreadId(response);
          if (!forkedThreadId) {
            if (shouldRestoreFiles && rewindRestoreState?.originalSnapshots?.length) {
              await restoreClaudeRewindWorkspaceSnapshots(
                workspaceId,
                rewindRestoreState.originalSnapshots,
              );
            }
            throw new Error("Codex provider fork did not return a child thread id.");
          }
          dispatch({
            type: "ensureThread",
            workspaceId,
            threadId: forkedThreadId,
            engine: "codex",
            ...extractProviderBindingFromStartedThread(response, selectedProviderBinding),
          });
          if (shouldActivate) {
            dispatch({
              type: "setActiveThreadId",
              workspaceId,
              threadId: forkedThreadId,
            });
          }
          loadedThreadsRef.current[forkedThreadId] = false;
          await resumeThreadForWorkspace(workspaceId, forkedThreadId, true, true);
          return forkedThreadId;
        }

        if (targetUserTurnIndex === 0) {
          await deleteCodexSessionService(workspaceId, canonicalThreadId);
          delete loadedThreadsRef.current[canonicalThreadId];
          dispatch({
            type: "removeThread",
            workspaceId,
            threadId: canonicalThreadId,
          });
          return canonicalThreadId;
        }

        const response = await rewindCodexThreadService(
          workspaceId,
          canonicalThreadId,
          targetUserTurnIndex,
          normalizedMessageId,
          {
            targetUserMessageText:
              targetUserMessageText.length > 0
                ? targetUserMessageText
                : undefined,
            targetUserMessageOccurrence,
            localUserMessageCount: userThreadItems.length,
          },
        );
        onDebug?.({
          id: `${Date.now()}-server-thread-codex-fork-from-message`,
          timestamp: Date.now(),
          source: "server",
          label: "codex/thread/fork from message response",
          payload: response,
        });
        const forkedThreadId = extractThreadId(response);
        if (!forkedThreadId) {
          if (shouldRestoreFiles && rewindRestoreState?.originalSnapshots?.length) {
            await restoreClaudeRewindWorkspaceSnapshots(
              workspaceId,
              rewindRestoreState.originalSnapshots,
            );
          }
          return null;
        }
        dispatch({
          type: "renameThreadId",
          workspaceId,
          oldThreadId: canonicalThreadId,
          newThreadId: forkedThreadId,
        });
        dispatch({
          type: "ensureThread",
          workspaceId,
          threadId: forkedThreadId,
          engine: "codex",
          ...extractProviderBindingFromStartedThread(response, selectedProviderBinding),
        });
        dispatch({
          type: "hideThread",
          workspaceId,
          threadId: canonicalThreadId,
        });
        await renameThreadTitleMapping(
          workspaceId,
          canonicalThreadId,
          forkedThreadId,
        );
        if (shouldActivate && !activeThreadIdByWorkspace[workspaceId]) {
          dispatch({
            type: "setActiveThreadId",
            workspaceId,
            threadId: forkedThreadId,
          });
        }
        delete loadedThreadsRef.current[canonicalThreadId];
        loadedThreadsRef.current[forkedThreadId] = false;
        await resumeThreadForWorkspace(workspaceId, forkedThreadId, true, true);
        return forkedThreadId;
      } catch (error) {
        try {
          if (shouldRestoreFiles && rewindRestoreState?.originalSnapshots?.length) {
            await restoreClaudeRewindWorkspaceSnapshots(
              workspaceId,
              rewindRestoreState.originalSnapshots,
            );
          }
        } catch {
          // Best effort rollback is handled in the main rewind path below.
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isStaleForkTarget = errorMessage.includes("[FORK_TARGET_NOT_FOUND]");
        onDebug?.({
          id: `${Date.now()}-client-thread-codex-fork-from-message-error`,
          timestamp: Date.now(),
          source: isStaleForkTarget ? "client" : "error",
          label: isStaleForkTarget
            ? "codex/thread/fork from message target missing"
            : "codex/thread/fork from message error",
          payload: isStaleForkTarget
            ? {
                workspaceId,
                threadId: canonicalThreadId,
                messageId: normalizedMessageId,
                reason: "runtimeTargetMissing",
                message: errorMessage,
              }
            : errorMessage,
        });
        if (providerProfileId) {
          throw error instanceof Error ? error : new Error(errorMessage);
        }
        return null;
      } finally {
        delete claudeRewindInFlightByThreadRef.current[rewindLockKey];
      }
    },
    [
      activeThreadIdByWorkspace,
      dispatch,
      forkClaudeSessionFromMessageForWorkspace,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      renameThreadTitleMapping,
      resumeThreadForWorkspace,
      workspacePathsByIdRef,
    ],
  );

  return {
    startThreadForWorkspace,
    startSharedSessionForWorkspace,
    forkThreadForWorkspace,
    forkClaudeSessionFromMessageForWorkspace,
    forkSessionFromMessageForWorkspace,
  };
}
