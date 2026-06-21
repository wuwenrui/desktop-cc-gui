import type { Dispatch, MutableRefObject } from "react";
import type { WorkspaceScopedMap } from "./workspaceScopedMap";
import type {
  CollaborationModeResolvedRequest,
  DebugEntry,
} from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";
import type { DomainEventRuntimeController } from "../domain-events";

export type ThreadEventHandlersOptions = {
  activeThreadId: string | null;
  dispatch: Dispatch<ThreadAction>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  resolveCanonicalThreadId?: (threadId: string) => string;
  resolveCollaborationUiMode?: (
    threadId: string,
  ) => "plan" | "code" | null;
  isAutoTitlePending: (workspaceId: string, threadId: string) => boolean;
  isThreadHidden: (workspaceId: string, threadId: string) => boolean;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  codexCompactionInFlightByThreadRef: MutableRefObject<Record<string, boolean>>;
  safeMessageActivity: () => void;
  recordThreadActivity: (
    workspaceId: string,
    threadId: string,
    timestamp?: number,
  ) => void;
  pushThreadErrorMessage: (
    workspaceId: string,
    threadId: string,
    message: string,
  ) => void;
  onDebug?: (entry: DebugEntry) => void;
  onWorkspaceConnected: (workspaceId: string) => void;
  applyCollabThreadLinks: (
    threadId: string,
    item: Record<string, unknown>,
  ) => void;
  approvalAllowlistRef: MutableRefObject<Record<string, string[][]>>;
  pendingInterruptsRef: MutableRefObject<WorkspaceScopedMap<true>>;
  interruptedThreadsRef: MutableRefObject<WorkspaceScopedMap<true>>;
  renameCustomNameKey: (
    workspaceId: string,
    oldThreadId: string,
    newThreadId: string,
  ) => void;
  renameAutoTitlePendingKey: (
    workspaceId: string,
    oldThreadId: string,
    newThreadId: string,
  ) => void;
  renameThreadTitleMapping: (
    workspaceId: string,
    oldThreadId: string,
    newThreadId: string,
  ) => Promise<void>;
  resolveClaudeContinuationThreadId?: (
    workspaceId: string,
    threadId: string,
    turnId?: string | null,
  ) => string | null;
  resolvePendingThreadForSession?: (
    workspaceId: string,
    engine: "claude" | "gemini" | "opencode",
  ) => string | null;
  resolvePendingThreadForTurn?: (
    workspaceId: string,
    engine: "claude" | "gemini" | "opencode",
    turnId: string | null | undefined,
  ) => string | null;
  getActiveTurnIdForThread?: (threadId: string) => string | null;
  renamePendingMemoryCaptureKey: (
    oldThreadId: string,
    newThreadId: string,
  ) => void;
  onAgentMessageCompletedExternal?: (payload: {
    workspaceId: string;
    threadId: string;
    turnId?: string | null;
    itemId: string;
    text: string;
  }) => void;
  onTurnCompletedExternal?: (payload: {
    workspaceId: string;
    threadId: string;
    turnId: string;
  }) => void;
  onTurnTerminalExternal?: (payload: {
    workspaceId: string;
    threadId: string;
    turnId: string;
    status: "completed" | "error" | "stalled";
  }) => void;
  onThreadTransientCleanupReady?: (
    cleanup: (workspaceId: string | null | undefined, threadId: string) => number,
  ) => () => void;
  onCollaborationModeResolved?: (
    event: CollaborationModeResolvedRequest,
  ) => void;
  onExitPlanModeToolCompleted?: (payload: {
    workspaceId: string;
    threadId: string;
    itemId: string;
  }) => void;
  domainEventController?: DomainEventRuntimeController | null;
};
