import { useCallback } from "react";
import type { Dispatch } from "react";
import type { DebugEntry, ConversationItem, WorkspaceInfo } from "../../../types";
import {
  buildCodexLivenessDiagnostic,
  canUseLocalFirstSendCodexDraftReplacement,
  type CodexAcceptedTurnResolution,
} from "../utils/codexConversationLiveness";
import type { StaleThreadRecoveryClassification } from "../utils/stabilityDiagnostics";
import {
  isCodexMissingThreadBindingError,
  isInvalidReviewThreadIdError,
} from "./threadMessagingHelpers";
import type { ThreadAction } from "./threadReducerTypes";

type MessageItem = Extract<ConversationItem, { kind: "message" }>;

export type CodexMessageRecoveryAttemptDeps = {
  threadId: string;
  workspace: WorkspaceInfo;
  reboundThreadId: string | null;
  acceptedTurnResolution: CodexAcceptedTurnResolution;
  staleRecoveryClassification: StaleThreadRecoveryClassification | null;
  optimisticUserItem: MessageItem | null;
  moveOptimisticUserIntentToThread: (newThreadId: string) => void;
  retrySendOnThread: (threadId: string) => Promise<void>;
  startThreadForMessageSend: (
    workspace: WorkspaceInfo,
    provider: "codex",
    options?: { providerProfileId?: string | null },
  ) => Promise<string | null>;
  forkThreadForWorkspace: (
    workspaceId: string,
    threadId: string,
    options?: { activate?: boolean; providerProfileId?: string | null },
  ) => Promise<string | null>;
  dispatch: Dispatch<ThreadAction>;
  onDebug?: (event: DebugEntry) => void;
  errorMessage: string;
  refreshErrorMessage?: string | null;
  providerProfileId?: string | null;
};

export type CodexMessageRecoveryAttempt = {
  tryFreshDraftReplacement: (fallbackReason: string | null) => Promise<boolean>;
  tryForkFromMessage: (reason: string | null) => Promise<boolean>;
  canUseFreshDraftReplacement: boolean;
  isUnverifiedSameThreadMissingRebind: boolean;
};

export type UseCodexMessageRecoveryResult = {
  createRecoveryAttempt: (
    deps: CodexMessageRecoveryAttemptDeps,
  ) => CodexMessageRecoveryAttempt;
};

function normalizeRecoveryId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProviderProfileId(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useCodexMessageRecovery(): UseCodexMessageRecoveryResult {
  const createRecoveryAttempt = useCallback(
    (deps: CodexMessageRecoveryAttemptDeps): CodexMessageRecoveryAttempt => {
      const canUseFirstSendDraftReplacement =
        canUseLocalFirstSendCodexDraftReplacement({
          resolution: deps.acceptedTurnResolution,
          hasLocalUserIntent: Boolean(deps.optimisticUserItem),
        });
      const canUseFreshDraftReplacementForMalformedThreadId =
        isInvalidReviewThreadIdError(deps.errorMessage) &&
        canUseFirstSendDraftReplacement;
      const canUseFreshDraftReplacementForMissingThread =
        isCodexMissingThreadBindingError(deps.errorMessage) &&
        canUseFirstSendDraftReplacement;
      const canUseFreshDraftReplacement =
        canUseFreshDraftReplacementForMalformedThreadId ||
        canUseFreshDraftReplacementForMissingThread;
      const isUnverifiedSameThreadMissingRebind =
        deps.reboundThreadId === deps.threadId &&
        canUseFreshDraftReplacementForMissingThread;
      let freshDraftReplacementAttempted = false;
      const providerProfileId = normalizeProviderProfileId(deps.providerProfileId);
      const providerSelection = providerProfileId ? { providerProfileId } : undefined;

      const tryFreshDraftReplacement = async (
        fallbackReason: string | null,
      ): Promise<boolean> => {
        if (!canUseFreshDraftReplacement || freshDraftReplacementAttempted) {
          return false;
        }
        freshDraftReplacementAttempted = true;
        const freshThreadId = providerSelection
          ? await deps.startThreadForMessageSend(
              deps.workspace,
              "codex",
              providerSelection,
            )
          : await deps.startThreadForMessageSend(deps.workspace, "codex");
        if (!freshThreadId) {
          return false;
        }
        deps.onDebug?.({
          id: `${Date.now()}-client-turn-start-draft-fresh-fallback`,
          timestamp: Date.now(),
          source: "client",
          label: "turn/start draft fresh fallback",
          payload: {
            ...buildCodexLivenessDiagnostic({
              workspaceId: deps.workspace.id,
              threadId: deps.threadId,
              stage: "fresh-continuation",
              outcome: "fresh",
              acceptedTurnFact: deps.acceptedTurnResolution.fact,
              source: deps.acceptedTurnResolution.source,
              reason: fallbackReason
                ? `${deps.errorMessage}; ${fallbackReason}`
                : deps.errorMessage,
            }),
            providerProfileId,
            reasonCode: deps.staleRecoveryClassification?.reasonCode ?? null,
            staleReason: deps.staleRecoveryClassification?.staleReason ?? null,
            userAction: deps.staleRecoveryClassification?.userAction ?? null,
          },
        });
        deps.dispatch({
          type: "setActiveThreadId",
          workspaceId: deps.workspace.id,
          threadId: freshThreadId,
        });
        deps.moveOptimisticUserIntentToThread(freshThreadId);
        await deps.retrySendOnThread(freshThreadId);
        return true;
      };

      const tryForkFromMessage = async (
        reason: string | null,
      ): Promise<boolean> => {
        if (deps.reboundThreadId && !isUnverifiedSameThreadMissingRebind) {
          return false;
        }
        let forkedThreadId: string | null = null;
        let forkErrorMessage: string | null = null;
        try {
          forkedThreadId = await deps.forkThreadForWorkspace(
            deps.workspace.id,
            deps.threadId,
            {
              activate: true,
              ...(providerProfileId ? { providerProfileId } : {}),
            },
          );
        } catch (forkError) {
          forkErrorMessage = errorToMessage(forkError);
          forkedThreadId = null;
        }
        const normalizedForkedThreadId = normalizeRecoveryId(forkedThreadId);
        if (!normalizedForkedThreadId) {
          return tryFreshDraftReplacement(
            forkErrorMessage ? `fork failed: ${forkErrorMessage}` : null,
          );
        }
        deps.onDebug?.({
          id: `${Date.now()}-client-turn-start-stale-fork-continuation`,
          timestamp: Date.now(),
          source: "client",
          label: "turn/start stale fork continuation",
          payload: {
            ...buildCodexLivenessDiagnostic({
              workspaceId: deps.workspace.id,
              threadId: deps.threadId,
              stage: "fresh-continuation",
              outcome: "fresh",
              acceptedTurnFact: deps.acceptedTurnResolution.fact,
              source: deps.acceptedTurnResolution.source,
              reason: reason
                ? `${deps.errorMessage}; refresh failed: ${reason}`
                : deps.errorMessage,
            }),
            forkedThreadId: normalizedForkedThreadId,
            providerProfileId,
            reasonCode: deps.staleRecoveryClassification?.reasonCode ?? null,
            staleReason: deps.staleRecoveryClassification?.staleReason ?? null,
            userAction: "start-fresh-thread",
          },
        });
        deps.dispatch({
          type: "setActiveThreadId",
          workspaceId: deps.workspace.id,
          threadId: normalizedForkedThreadId,
        });
        deps.moveOptimisticUserIntentToThread(normalizedForkedThreadId);
        await deps.retrySendOnThread(normalizedForkedThreadId);
        return true;
      };

      return {
        tryFreshDraftReplacement,
        tryForkFromMessage,
        canUseFreshDraftReplacement,
        isUnverifiedSameThreadMissingRebind,
      };
    },
    [],
  );

  return { createRecoveryAttempt };
}
