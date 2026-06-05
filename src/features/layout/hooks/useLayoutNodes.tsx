import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState, type DragEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { Sidebar } from "../../app/components/Sidebar";
import { HomeChat } from "../../home/components/HomeChat";
import { MainHeader } from "../../app/components/MainHeader";
import { TopbarSessionTabs } from "../../app/components/TopbarSessionTabs";
import { Messages } from "../../messages/components/Messages";
import { MessageForkConfirmDialog } from "../../messages/components/MessageForkConfirmDialog";
import { UpdateToast } from "../../update/components/UpdateToast";
import { ErrorToasts } from "../../notifications/components/ErrorToasts";
import { GlobalRuntimeNoticeDock } from "../../notifications/components/GlobalRuntimeNoticeDock";
import {
  Composer,
  type ComposerRewindDialogRequest,
} from "../../composer/components/Composer";
import { GitDiffViewer } from "../../git/components/GitDiffViewer";
import { buildCanonicalGitChanges } from "../../git/utils/gitChangeModel";
import { FileTreePanel } from "../../files/components/FileTreePanel";
import {
  clampRendererContextMenuPosition,
  RendererContextMenu,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";
import { WorkspaceSearchPanel } from "../../search/components/WorkspaceSearchPanel";
import { PromptPanel } from "../../prompts/components/PromptPanel";
import { ProjectMemoryPanel } from "../../project-memory/components/ProjectMemoryPanel";
import { ProjectMapPanel, type ProjectMapDatasetController } from "../../project-map";
import { buildGitStatusProjectMapImpactInput } from "../../project-map/utils/impactSources";
import {
  OrchestrationCenterView,
  applyOrchestrationReviewAction,
  archiveOrchestrationTask,
  collectCoreOrchestrationProviderSnapshots,
  createManualOrchestrationTaskDraft,
  projectLinkedTaskRunsToOrchestrationStore,
  OPEN_ORCHESTRATION_TASK_EVENT,
  patchOrchestrationTask,
  readOpenOrchestrationTaskEvent,
  readSpecHubOrchestrationCandidates,
  saveOrchestrationTaskStore,
  upsertOrchestrationTask,
  useOrchestrationTaskStore,
} from "../../agent-orchestration";
import type {
  OrchestrationCancelRunRequest,
  OrchestrationDispatchConfirmation,
  OrchestrationManualTaskDraftRequest,
  OrchestrationReviewActionRequest,
  OrchestrationSourceRef,
  OrchestrationTask,
} from "../../agent-orchestration";
import { useTaskRunStore } from "../../tasks/hooks/useTaskRunStore";
import { patchTaskRun, saveTaskRunStore } from "../../tasks/utils/taskRunStorage";
import { WorkspaceNoteCardPanel } from "../../note-cards/components/WorkspaceNoteCardPanel";
import { WorkspaceSessionActivityPanel } from "../../session-activity/components/WorkspaceSessionActivityPanel";
import { WorkspaceSessionRadarPanel } from "../../session-activity/components/WorkspaceSessionRadarPanel";
import { DebugPanel } from "../../debug/components/DebugPanel";
import { PanelTabs } from "../components/PanelTabs";
import { TabBar } from "../../app/components/TabBar";
import { TabletNav } from "../../app/components/TabletNav";
import { TerminalDock } from "../../terminal/components/TerminalDock";
import { TerminalPanel } from "../../terminal/components/TerminalPanel";
import { StatusPanel } from "../../status-panel/components/StatusPanel";
import { useStatusPanelData } from "../../status-panel/hooks/useStatusPanelData";
import { useGlobalRuntimeNoticeDock } from "../../notifications/hooks/useGlobalRuntimeNoticeDock";
import { buildSpecWorkspaceSnapshot } from "../../../lib/spec-core/runtime";
import type { SpecWorkspaceSnapshot } from "../../../lib/spec-core/types";
import type { AgentTaskScrollRequest } from "../../messages/types";
import type { SubagentInfo, TabType } from "../../status-panel/types";
import type {
  EditorHighlightTarget,
  EditorNavigationLocation,
  EditorNavigationTarget,
  OpenFileOptions,
} from "../../app/hooks/useGitPanelController";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import type { WorkspaceLaunchScriptsState } from "../../app/hooks/useWorkspaceLaunchScripts";
import type {
  AccessMode,
  AppMode,
  ApprovalRequest,
  BranchInfo,
  CollaborationModeOption,
  ConversationItem,
  ComposerEditorSettings,
  CustomCommandOption,
  CustomPromptOption,
  AccountSnapshot,
  DebugEntry,
  DictationSessionState,
  DictationTranscript,
  EngineType,
  GitFileStatus,
  GitHubIssue,
  GitHubPullRequestComment,
  GitHubPullRequest,
  GitLogEntry,
  MessageSendOptions,
  ModelOption,
  OpenCodeAgentOption,
  OpenAppTarget,
  QueuedMessage,
  RateLimitSnapshot,
  RequestUserInputRequest,
  RequestUserInputResponse,
  RuntimeLifecycleState,
  RuntimePoolRow,
  SkillOption,
  SelectedAgentOption,
  ThreadSummary,
  ThreadTokenUsage,
  TurnPlan,
  WorkspaceInfo,
} from "../../../types";
import { getClientStoreSync } from "../../../services/clientStorage";
import {
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import { normalizeSpecRootInput } from "../../spec/pathUtils";
import type { EngineDisplayInfo } from "../../engine/hooks/useEngineController";
import type { UpdateState } from "../../update/hooks/useUpdater";
import type { TerminalSessionState } from "../../terminal/hooks/useTerminalSession";
import type { TerminalTab } from "../../terminal/hooks/useTerminalTabs";
import type { ErrorToast } from "../../../services/toasts";
import type { LoadingProgressDialogConfig } from "../../app/hooks/useLoadingProgressDialogState";
import type { WorkspaceDirectoryEntry } from "../../../services/tauri";
import type {
  CodeAnnotationBridgeProps,
  CodeAnnotationDraftInput,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import {
  buildCodeAnnotationDedupeKey,
  createCodeAnnotationSelection,
} from "../../code-annotations/utils/codeAnnotations";
import type {
  ConversationEngine,
  ConversationState,
} from "../../threads/contracts/conversationCurtainContracts";
import type { RuntimeReconnectRecoveryCallbackResult } from "../../messages/components/runtimeReconnect";
import { resolveDiffPathFromWorkspacePath } from "../../../utils/workspacePaths";
import { resolvePresentationProfile } from "../../messages/presentation/presentationProfile";
import {
  appendQueuedHandoffBubbleIfNeeded,
  type QueuedHandoffBubble,
} from "../../threads/utils/queuedHandoffBubble";
import { isBackgroundRenderGatingEnabled } from "../../threads/utils/realtimePerfFlags";
import { useWorkspaceSessionActivity } from "../../session-activity/hooks/useWorkspaceSessionActivity";
import { useClientUiVisibility } from "../../client-ui-visibility/hooks/useClientUiVisibility";
import type { SessionRadarEntry } from "../../session-activity/hooks/useSessionRadarFeed";
import {
  getHomeWorkspaceOptions,
  resolveHomeWorkspaceId,
} from "../../home/utils/homeWorkspaceOptions";
import { deriveRewindWorkspaceGitState } from "./rewindWorkspaceGitState";
import {
  TOPBAR_SESSION_TAB_MAX,
  buildTopbarSessionTabItems,
  createEmptyTopbarSessionWindows,
  dismissAllTopbarSessionTabs,
  dismissCompletedTopbarSessionTabs,
  dismissTopbarSessionTab,
  dismissTopbarSessionTabsToLeft,
  dismissTopbarSessionTabsToRight,
  pickAdjacentOpenSessionTab,
  pickAdjacentTopbarSessionFallbackTab,
  pruneTopbarSessionWindows,
  recordTopbarSessionActivation,
  type TopbarSessionWindows,
} from "./topbarSessionTabs";
import { buildWorkspaceHeaderGroups } from "./workspaceHeaderGroups";

const GitDiffPanel = lazy(() =>
  import("../../git/components/GitDiffPanel").then((m) => ({ default: m.GitDiffPanel })),
);
const FileViewPanel = lazy(() =>
  import("../../files/components/FileViewPanel").then((m) => ({ default: m.FileViewPanel })),
);

function HeavyPanelFallback() {
  return <div className="heavy-panel-fallback" aria-hidden="true" />;
}

type ThreadActivityStatus = {
  isProcessing: boolean;
  hasUnread: boolean;
  isReviewing: boolean;
  isContextCompacting?: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  heartbeatPulse?: number;
  codexCompactionSource?: "auto" | "manual" | null;
  codexCompactionLifecycleState?: "idle" | "compacting" | "completed";
  codexCompactionCompletedAt?: number | null;
  lastTokenUsageUpdatedAt?: number | null;
  codexSilentSuspectedAt?: number | null;
  codexSilentSuspectedSource?: string | null;
};

type GitDiffViewerItem = {
  path: string;
  status: string;
  diff: string;
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

const MESSAGE_JUMP_EVENT_NAME = "ccgui:jump-to-message";

function dispatchMessageJumpEvent(messageId: string) {
  if (!messageId || typeof document === "undefined") {
    return;
  }
  document.dispatchEvent(
    new CustomEvent<string>(MESSAGE_JUMP_EVENT_NAME, {
      detail: messageId,
    }),
  );
}

function focusUserInputRequestCard(request: RequestUserInputRequest) {
  if (typeof document === "undefined") {
    return false;
  }
  const candidates = document.querySelectorAll<HTMLElement>("[data-request-user-input-id]");
  const card = Array.from(candidates).find(
    (candidate) =>
      candidate.dataset.requestUserInputId === String(request.request_id) &&
      candidate.dataset.workspaceId === request.workspace_id &&
      candidate.dataset.threadId === request.params.thread_id,
  );
  if (!card) {
    return false;
  }
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.focus({ preventScroll: true });
  return true;
}

function resolveRuntimeLifecycleForComposer(
  rows: readonly RuntimePoolRow[] | undefined,
  workspaceId: string | null,
  engine: EngineType | undefined,
): RuntimeLifecycleState | null {
  if (!workspaceId || !engine || !rows) {
    return null;
  }
  return (
    rows.find((row) => row.workspaceId === workspaceId && row.engine === engine)
      ?.lifecycleState ?? null
  );
}

type GitDiffListView = "flat" | "tree";

type WorktreeRenameState = {
  name: string;
  error: string | null;
  notice: string | null;
  isSubmitting: boolean;
  isDirty: boolean;
  upstream?: {
    oldBranch: string;
    newBranch: string;
    error: string | null;
    isSubmitting: boolean;
    onConfirm: () => void;
  } | null;
  onFocus: () => void;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
};

type LayoutNodesOptions = {
  workspaces: WorkspaceInfo[];
  groupedWorkspaces: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  hasWorkspaceGroups: boolean;
  deletingWorktreeIds: Set<string>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadParentById: Record<string, string>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  historyLoadingByThreadId: Record<string, boolean>;
  historyRestoredAtMsByThread?: Record<string, number | null | undefined>;
  runningSessionCountByWorkspaceId: Record<string, number>;
  recentCompletedSessionCountByWorkspaceId: Record<string, number>;
  hydratedThreadListWorkspaceIds: ReadonlySet<string>;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeTurnId?: string | null;
  systemProxyEnabled?: boolean;
  systemProxyUrl?: string | null;
  activeItems: ConversationItem[];
  activeQueuedHandoffBubble: QueuedHandoffBubble | null;
  threadItemsByThread: Record<string, ConversationItem[]>;
  sessionRadarRunningSessions: SessionRadarEntry[];
  sessionRadarRecentCompletedSessions: SessionRadarEntry[];
  activeRateLimits: RateLimitSnapshot | null;
  usageShowRemaining: boolean;
  onRefreshAccountRateLimits?: () => Promise<void> | void;
  showMessageAnchors: boolean;
  accountInfo: AccountSnapshot | null;
  onSwitchAccount: () => void;
  onCancelSwitchAccount: () => void;
  accountSwitching: boolean;
  codeBlockCopyUseModifier: boolean;
  openAppTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  handleApprovalDecision: (
    request: ApprovalRequest,
    decision: "accept" | "decline" | "dismiss",
  ) => void;
  handleApprovalBatchAccept: (requests: ApprovalRequest[]) => void;
  handleApprovalRemember: (
    request: ApprovalRequest,
    command: string[],
  ) => void;
  handleUserInputSubmit: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse,
  ) => Promise<void> | void;
  handleUserInputDismiss: (request: RequestUserInputRequest) => void;
  onRecoverThreadRuntime?: (
    workspaceId: string,
    threadId: string,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onRecoverThreadRuntimeAndResend?: (
    workspaceId: string,
    threadId: string,
    message: Pick<QueuedMessage, "text" | "images">,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onThreadRecoveryFork?: () => Promise<void> | void;
  handleExitPlanModeExecute?: (
    mode: Extract<AccessMode, "default" | "full-access">,
  ) => Promise<void> | void;
  onOpenSettings: () => void;
  onOpenExperimentalSettings: () => void;
  onOpenDictationSettings?: () => void;
  onOpenDebug: () => void;
  showDebugButton: boolean;
  onAddWorkspace: () => void;
  onSelectHome: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  onAddAgent: (
    workspace: WorkspaceInfo,
    engine?: EngineType,
    options?: { folderId?: string | null },
  ) => Promise<string | null>;
  engineOptions?: EngineDisplayInfo[];
  enabledEngines?: Partial<Record<EngineType, boolean>>;
  onRefreshEngineOptions?: () =>
    | Promise<import("../../engine/hooks/useEngineController").EngineRefreshResult | void>
    | import("../../engine/hooks/useEngineController").EngineRefreshResult
    | void;
  onAddSharedAgent: (workspace: WorkspaceInfo) => Promise<string | null>;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => Promise<void>;
  onAddCloneAgent: (workspace: WorkspaceInfo) => Promise<void>;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onArchiveThread: (workspaceId: string, threadId: string) => void;
  deleteConfirmThreadId?: string | null;
  deleteConfirmWorkspaceId?: string | null;
  deleteConfirmBusy?: boolean;
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  pinThread: (workspaceId: string, threadId: string) => boolean;
  unpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
  pinnedThreadsVersion: number;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onAutoNameThread: (workspaceId: string, threadId: string) => void;
  onOpenClaudeTui?: (input: {
    workspaceId: string;
    workspacePath: string;
    sessionId: string;
  }) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
  onRenameWorkspaceAlias: (workspace: WorkspaceInfo) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  onQuickReloadWorkspaceThreads?: (workspaceId: string) => void;
  workspaceDropTargetRef: RefObject<HTMLElement | null>;
  isWorkspaceDropActive: boolean;
  workspaceDropText: string;
  onWorkspaceDragOver: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDragEnter: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDragLeave: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDrop: (event: DragEvent<HTMLElement>) => void;
  appMode: AppMode;
  isPhone: boolean;
  isTablet: boolean;
  onAppModeChange: (mode: AppMode) => void;
  onOpenHomeChat: () => void;
  onOpenMemory: () => void;
  onOpenProjectMemory: () => void;
  onOpenContextLedgerMemory?: (memoryId: string) => void;
  onOpenContextLedgerNote?: (noteId: string) => void;
  onOpenReleaseNotes: () => void;
  onOpenGlobalSearch: () => void;
  globalSearchShortcut: string | null;
  openChatShortcut: string | null;
  openKanbanShortcut: string | null;
  showLoadingProgressDialog?: (config: LoadingProgressDialogConfig) => string;
  hideLoadingProgressDialog?: (requestId: string) => void;
  cycleOpenSessionPrevShortcut: string | null;
  cycleOpenSessionNextShortcut: string | null;
  closeCurrentSessionShortcut: string | null;
  saveFileShortcut: string | null;
  findInFileShortcut: string | null;
  toggleGitDiffListViewShortcut: string | null;
  onOpenSpecHub: () => void;
  onOpenWorkspaceHome: () => void;
  updaterState: UpdateState;
  onUpdate: () => void;
  onDismissUpdate: () => void;
  errorToasts: ErrorToast[];
  onDismissErrorToast: (id: string) => void;
  latestAgentRuns: Array<{
    threadId: string;
    message: string;
    timestamp: number;
    projectName: string;
    groupName?: string | null;
    workspaceId: string;
    isProcessing: boolean;
  }>;
  isLoadingLatestAgents: boolean;
  onSelectHomeThread: (workspaceId: string, threadId: string) => void;
  onSelectHomeWorkspace: (workspaceId: string) => void;
  activeWorkspace: WorkspaceInfo | null;
  activeParentWorkspace: WorkspaceInfo | null;
  worktreeLabel: string | null;
  worktreeRename?: WorktreeRenameState;
  isWorktreeWorkspace: boolean;
  branchName: string;
  branches: BranchInfo[];
  onCheckoutBranch: (name: string) => Promise<void>;
  onCreateBranch: (name: string) => Promise<void>;
  onCopyThread: () => void | Promise<void>;
  onLockPanel?: () => void;
  onToggleTerminal: () => void;
  showTerminalButton: boolean;
  launchScript: string | null;
  launchScriptEditorOpen: boolean;
  launchScriptDraft: string;
  launchScriptSaving: boolean;
  launchScriptError: string | null;
  onRunLaunchScript: () => void;
  onOpenLaunchScriptEditor: () => void;
  onCloseLaunchScriptEditor: () => void;
  onLaunchScriptDraftChange: (value: string) => void;
  onSaveLaunchScript: () => void;
  launchScriptsState?: WorkspaceLaunchScriptsState;
  mainHeaderActionsNode?: ReactNode;
  browserDockOpen?: boolean;
  onCloseBrowserDock?: () => void;
  centerMode: "chat" | "diff" | "editor" | "memory" | "projectMap";
  setCenterMode: (mode: "chat" | "diff" | "editor" | "memory" | "projectMap") => void;
  editorSplitCompanion: "chat" | "projectMap";
  setEditorSplitCompanion: (companion: "chat" | "projectMap") => void;
  editorSplitLayout: "vertical" | "horizontal";
  onToggleEditorSplitLayout: () => void;
  isEditorFileMaximized: boolean;
  onToggleEditorFileMaximized: () => void;
  editorFilePath: string | null;
  editorNavigationTarget: EditorNavigationTarget | null;
  editorHighlightTarget: EditorHighlightTarget | null;
  openEditorTabs: string[];
  onActivateEditorTab: (path: string) => void;
  onCloseEditorTab: (path: string) => void;
  onCloseAllEditorTabs: () => void;
  onActiveEditorLineRangeChange: (range: { startLine: number; endLine: number } | null) => void;
  onOpenFile: (
    path: string,
    location?: EditorNavigationLocation,
    options?: OpenFileOptions,
  ) => void;
    externalChangeMonitoringEnabled?: boolean;
    externalChangeTransportMode?: "watcher" | "polling";
    externalChangeApplyMode?: "auto" | "manual";
    externalChangeAutoApplyDebounceMs?: number;
    liveEditPreviewEnabled?: boolean;
  onToggleLiveEditPreview?: () => void;
  onExitEditor: () => void;
  onExitDiff: () => void;
  activeTab: "projects" | "codex" | "spec" | "git" | "log";
  onSelectTab: (tab: "projects" | "codex" | "spec" | "git" | "log") => void;
  tabletNavTab: "codex" | "spec" | "git" | "log";
  gitPanelMode: "diff" | "log" | "issues" | "prs";
  onGitPanelModeChange: (mode: "diff" | "log" | "issues" | "prs") => void;
  onOpenGitHistoryPanel: () => void;
  onOpenProjectMap: () => void;
  gitDiffViewStyle: "split" | "unified";
  gitDiffListView: GitDiffListView;
  onGitDiffListViewChange: (view: "flat" | "tree") => void;
  worktreeApplyLabel: string;
  worktreeApplyTitle: string | null;
  worktreeApplyLoading: boolean;
  worktreeApplyError: string | null;
  worktreeApplySuccess: boolean;
  onApplyWorktreeChanges?: () => void | Promise<void>;
  filePanelMode: "git" | "files" | "search" | "notes" | "prompts" | "memory" | "activity" | "radar";
  onFilePanelModeChange: (mode: "git" | "files" | "search" | "notes" | "prompts" | "memory" | "activity" | "radar") => void;
  focusedProjectMemoryId?: string | null;
  focusedProjectMemoryRequestKey?: number;
  focusedWorkspaceNoteId?: string | null;
  focusedWorkspaceNoteRequestKey?: number;
  fileTreeLoading: boolean;
  fileTreeLoadError?: string | null;
  onRefreshFiles?: () => void;
  onOpenDetachedFileExplorer?: (initialFilePath?: string | null) => void;
  onToggleRuntimeConsole: () => void;
  runtimeConsoleVisible: boolean;
  gitStatus: {
    branchName: string;
    files: GitFileStatus[];
    stagedFiles: GitFileStatus[];
    unstagedFiles: GitFileStatus[];
    totalAdditions: number;
    totalDeletions: number;
    error: string | null;
  };
  fileStatus: string;
  selectedDiffPath: string | null;
  diffScrollRequestId: number;
  onSelectDiff: (path: string | null) => void;
  gitLogEntries: GitLogEntry[];
  gitLogTotal: number;
  gitLogAhead: number;
  gitLogBehind: number;
  gitLogAheadEntries: GitLogEntry[];
  gitLogBehindEntries: GitLogEntry[];
  gitLogUpstream: string | null;
  selectedCommitSha: string | null;
  onSelectCommit: (entry: GitLogEntry) => void;
  gitLogError: string | null;
  gitLogLoading: boolean;
  refreshGitDiffs: () => void;
  queueGitStatusRefresh: () => void;
  gitIssues: GitHubIssue[];
  gitIssuesTotal: number;
  gitIssuesLoading: boolean;
  gitIssuesError: string | null;
  gitPullRequests: GitHubPullRequest[];
  gitPullRequestsTotal: number;
  gitPullRequestsLoading: boolean;
  gitPullRequestsError: string | null;
  selectedPullRequestNumber: number | null;
  selectedPullRequest: GitHubPullRequest | null;
  selectedPullRequestComments: GitHubPullRequestComment[];
  selectedPullRequestCommentsLoading: boolean;
  selectedPullRequestCommentsError: string | null;
  onSelectPullRequest: (pullRequest: GitHubPullRequest) => void;
  gitRemoteUrl: string | null;
  gitRoot: string | null;
  gitRootCandidates: string[];
  gitRootScanDepth: number;
  gitRootScanLoading: boolean;
  gitRootScanError: string | null;
  gitRootScanHasScanned: boolean;
  onGitRootScanDepthChange: (depth: number) => void;
  onScanGitRoots: () => void;
  onSelectGitRoot: (path: string) => void;
  onClearGitRoot: () => void;
  onPickGitRoot: () => void | Promise<void>;
  onStageGitAll: () => Promise<void>;
  onStageGitFile: (path: string) => Promise<void>;
  onUnstageGitFile: (path: string) => Promise<void>;
  onRevertGitFile: (path: string) => Promise<void>;
  onRevertAllGitChanges: () => Promise<void>;
  gitDiffs: GitDiffViewerItem[];
  gitDiffLoading: boolean;
  gitDiffError: string | null;
  onDiffActivePathChange?: (path: string) => void;
  onGitDiffViewStyleChange: (style: "split" | "unified") => void;
  commitMessage: string;
  commitMessageLoading: boolean;
  commitMessageError: string | null;
  onCommitMessageChange: (value: string) => void;
  onGenerateCommitMessage: (
    language?: "zh" | "en",
    engine?: "codex" | "claude" | "gemini" | "opencode",
    selectedPaths?: string[],
  ) => void | Promise<void>;
  onCommit?: (selectedPaths?: string[]) => void | Promise<void>;
  onCommitAndPush?: (selectedPaths?: string[]) => void | Promise<void>;
  onCommitAndSync?: (selectedPaths?: string[]) => void | Promise<void>;
  onPush?: () => void | Promise<void>;
  onSync?: () => void | Promise<void>;
  commitLoading?: boolean;
  pushLoading?: boolean;
  syncLoading?: boolean;
  commitError?: string | null;
  pushError?: string | null;
  syncError?: string | null;
  commitsAhead?: number;
  onSendPrompt: (text: string) => void | Promise<void>;
  onSendPromptToNewAgent: (text: string) => void | Promise<void>;
  onCreatePrompt: (data: {
    scope: "workspace" | "global";
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onUpdatePrompt: (data: {
    path: string;
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onDeletePrompt: (path: string) => void | Promise<void>;
  onMovePrompt: (data: { path: string; scope: "workspace" | "global" }) => void | Promise<void>;
  onRevealWorkspacePrompts: () => void | Promise<void>;
  onRevealGeneralPrompts: () => void | Promise<void>;
  canRevealGeneralPrompts: boolean;
  onSend: (
    text: string,
    images: string[],
    options?: MessageSendOptions,
  ) => void | Promise<void>;
  onQueue: (
    text: string,
    images: string[],
    options?: MessageSendOptions,
  ) => void | Promise<void>;
  onRequestContextCompaction?: () => Promise<void> | void;
  onStop: () => void;
  completionEmailSelected?: boolean;
  completionEmailDisabled?: boolean;
  onToggleCompletionEmail?: () => void;
  onRewind?: (
    userMessageId: string,
    options?: { mode?: "messages-and-files" | "messages-only" | "files-only" },
  ) => void | Promise<void>;
  onForkFromMessage?: (userMessageId: string) => void | Promise<void>;
  canStop: boolean;
  isReviewing: boolean;
  isProcessing: boolean;
  steerEnabled: boolean;
  reviewPrompt: ReviewPromptState;
  onReviewPromptClose: () => void;
  onReviewPromptShowPreset: () => void;
  onReviewPromptChoosePreset: (
    preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted",
  ) => void;
  highlightedPresetIndex: number;
  onReviewPromptHighlightPreset: (index: number) => void;
  highlightedBranchIndex: number;
  onReviewPromptHighlightBranch: (index: number) => void;
  highlightedCommitIndex: number;
  onReviewPromptHighlightCommit: (index: number) => void;
  onReviewPromptKeyDown: (event: {
    key: string;
    shiftKey?: boolean;
    preventDefault: () => void;
  }) => boolean;
  onReviewPromptSelectBranch: (value: string) => void;
  onReviewPromptSelectBranchAtIndex: (index: number) => void;
  onReviewPromptConfirmBranch: () => Promise<void>;
  onReviewPromptSelectCommit: (sha: string, title: string) => void;
  onReviewPromptSelectCommitAtIndex: (index: number) => void;
  onReviewPromptConfirmCommit: () => Promise<void>;
  onReviewPromptUpdateCustomInstructions: (value: string) => void;
  onReviewPromptConfirmCustom: () => Promise<void>;
  activeTokenUsage: ThreadTokenUsage | null;
  contextDualViewEnabled?: boolean;
  codexAutoCompactionEnabled?: boolean;
  codexAutoCompactionThresholdPercent?: number;
  onCodexAutoCompactionSettingsChange?: (patch: {
    enabled?: boolean;
    thresholdPercent?: number;
  }) => Promise<void> | void;
  activeQueue: QueuedMessage[];
  draftText: string;
  onDraftChange: (next: string) => void;
  activeImages: string[];
  onPickImages: () => void | Promise<void>;
  onAttachImages: (paths: string[]) => void;
  onRemoveImage: (path: string) => void;
  prefillDraft: QueuedMessage | null;
  onPrefillHandled: (id: string) => void;
  insertText: QueuedMessage | null;
  onInsertHandled: (id: string) => void;
  onEditQueued: (item: QueuedMessage) => void;
  onDeleteQueued: (id: string) => void;
  onFuseQueued: (id: string) => void | Promise<void>;
  canFuseActiveQueue: boolean;
  activeFusingMessageId: string | null;
  collaborationModes: CollaborationModeOption[];
  collaborationModesEnabled: boolean;
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  // Engine props
  engines?: EngineDisplayInfo[];
  selectedEngine?: EngineType;
  usePresentationProfile?: boolean;
  onSelectEngine?: (engine: EngineType) => void;
  // Model props
  models: ModelOption[];
  selectedModelId: string | null;
  projectMapDatasetController?: ProjectMapDatasetController;
  onSelectModel: (id: string | null) => void;
  onDispatchOrchestrationTask?: (
    confirmation: OrchestrationDispatchConfirmation,
  ) => Promise<{ ok: boolean; taskId?: string | null; reason?: string }> | { ok: boolean; taskId?: string | null; reason?: string };
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string | null) => void;
  claudeThinkingVisible?: boolean;
  onResolvedClaudeThinkingVisibleChange?: (enabled: boolean) => void;
  reasoningSupported: boolean;
  opencodeAgents: OpenCodeAgentOption[];
  selectedOpenCodeAgent: string | null;
  onSelectOpenCodeAgent: (agentId: string | null) => void;
  selectedAgent: SelectedAgentOption | null;
  onSelectAgent: (agent: SelectedAgentOption | null) => void;
  onOpenAgentSettings: () => void;
  onOpenPromptSettings: () => void;
  onOpenModelSettings: (providerId?: string) => void;
  onRefreshModelConfig?: (providerId?: string) => Promise<void> | void;
  isModelConfigRefreshing?: boolean;
  opencodeVariantOptions: string[];
  selectedOpenCodeVariant: string | null;
  onSelectOpenCodeVariant: (variant: string | null) => void;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  skills: SkillOption[];
  customSkillDirectories?: string[];
  prompts: CustomPromptOption[];
  commands?: CustomCommandOption[];
  files: string[];
  directories: string[];
  directoryMetadata: WorkspaceDirectoryEntry[];
  gitignoredFiles: Set<string>;
  gitignoredDirectories: Set<string>;
  onInsertComposerText: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  composerEditorSettings: ComposerEditorSettings;
  composerSendShortcut: "enter" | "cmdEnter";
  textareaHeight: number;
  onTextareaHeightChange: (height: number) => void;
  dictationEnabled: boolean;
  dictationState: DictationSessionState;
  dictationLevel: number;
  onToggleDictation: () => void;
  dictationTranscript: DictationTranscript | null;
  onDictationTranscriptHandled: (id: string) => void;
  dictationError: string | null;
  onDismissDictationError: () => void;
  dictationHint: string | null;
  onDismissDictationHint: () => void;
  showComposer: boolean;
  composerSendLabel?: string;
  composerLinkedKanbanPanels: {
    id: string;
    name: string;
    workspaceId: string;
    createdAt?: number;
  }[];
  selectedComposerKanbanPanelId: string | null;
  composerKanbanContextMode: "new" | "inherit";
  onSelectComposerKanbanPanel: (panelId: string | null) => void;
  onComposerKanbanContextModeChange: (mode: "new" | "inherit") => void;
  onOpenComposerKanbanPanel: (panelId: string) => void;
  activeComposerFilePath: string | null;
  activeComposerFileLineRange: { startLine: number; endLine: number } | null;
  fileReferenceMode: "path" | "none";
  onFileReferenceModeChange: (mode: "path" | "none") => void;
  plan: TurnPlan | null;
  isPlanMode: boolean;
  onOpenPlanPanel: () => void;
  onClosePlanPanel: () => void;
  bottomStatusPanelExpanded: boolean;
  agentTaskScrollRequest?: AgentTaskScrollRequest | null;
  onSelectSubagent?: (agent: SubagentInfo) => void;
  debugEntries: DebugEntry[];
  debugOpen: boolean;
  terminalOpen: boolean;
  terminalTabs: TerminalTab[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (terminalId: string) => void;
  terminalState: TerminalSessionState | null;
  onClearDebug: () => void;
  onCopyDebug: () => void;
  onResizeDebug: (event: MouseEvent<Element>) => void;
  onResizeTerminal: (event: MouseEvent<Element>) => void;
  onBackFromDiff: () => void;
  onGoProjects: () => void;
};

type LayoutNodesResult = {
  codeAnnotationBridgeProps: CodeAnnotationBridgeProps;
  sidebarNode: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  approvalToastsNode: ReactNode;
  updateToastNode: ReactNode;
  errorToastsNode: ReactNode;
  globalRuntimeNoticeDockNode: ReactNode;
  homeNode: ReactNode;
  mainHeaderNode: ReactNode;
  desktopTopbarLeftNode: ReactNode;
  tabletNavNode: ReactNode;
  tabBarNode: ReactNode;
  rightPanelToolbarNode: ReactNode;
  gitDiffPanelNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  fileViewPanelNode: ReactNode;
  projectMapPanelNode: ReactNode;
  browserDockNode: ReactNode;
  planPanelNode: ReactNode;
  debugPanelNode: ReactNode;
  debugPanelFullNode: ReactNode;
  terminalDockNode: ReactNode;
  compactEmptyCodexNode: ReactNode;
  compactEmptySpecNode: ReactNode;
  compactEmptyGitNode: ReactNode;
  compactGitBackNode: ReactNode;
};

type RightPanelTabSelection = LayoutNodesOptions["filePanelMode"] | "projectMap";

const EMPTY_COMMANDS: CustomCommandOption[] = [];

function toConversationEngine(engine: EngineType | undefined): ConversationEngine {
  if (engine === "claude" || engine === "gemini" || engine === "opencode") {
    return engine;
  }
  return "codex";
}

function inferConversationEngineFromThreadId(
  threadId: string | null | undefined,
): ConversationEngine | null {
  const normalizedThreadId = threadId?.trim().toLowerCase();
  if (!normalizedThreadId) {
    return null;
  }

  if (normalizedThreadId.startsWith("claude:") || normalizedThreadId.startsWith("claude-pending-")) {
    return "claude";
  }
  if (normalizedThreadId.startsWith("gemini:") || normalizedThreadId.startsWith("gemini-pending-")) {
    return "gemini";
  }
  if (normalizedThreadId.startsWith("opencode:") || normalizedThreadId.startsWith("opencode-pending-")) {
    return "opencode";
  }
  if (normalizedThreadId.startsWith("codex:") || normalizedThreadId.startsWith("codex-pending-")) {
    return "codex";
  }

  return null;
}

function resolveActiveConversationEngine(
  activeThreadSummary: ThreadSummary | null,
  activeThreadId: string | null,
  selectedEngine: EngineType | undefined,
): ConversationEngine {
  const threadEngine =
    activeThreadSummary?.selectedEngine ??
    activeThreadSummary?.engineSource ??
    inferConversationEngineFromThreadId(activeThreadId);
  return toConversationEngine(threadEngine ?? selectedEngine);
}

function toTopbarTabKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}::${threadId}`;
}

export function useLayoutNodes(options: LayoutNodesOptions): LayoutNodesResult {
  const { t } = useTranslation();
  const clientUiVisibility = useClientUiVisibility();
  const onOpenFile = options.onOpenFile;
  const [, forceTopbarSessionRender] = useReducer((value: number) => value + 1, 0);
  const [topbarTabContextMenu, setTopbarTabContextMenu] =
    useState<RendererContextMenuState | null>(null);
  const topbarSessionWindowsRef = useRef<TopbarSessionWindows>(
    createEmptyTopbarSessionWindows(),
  );
  const pendingTopbarSelectionRef = useRef<{
    workspaceId: string;
    threadId: string;
    setAt: number;
  } | null>(null);
  const dismissedTopbarTabKeysRef = useRef<Set<string>>(new Set());
  const lastActivationRef = useRef<{
    initialized: boolean;
    workspaceId: string | null;
    threadId: string | null;
  }>({
    initialized: false,
    workspaceId: null,
    threadId: null,
  });
  const [preferredDockStatusTab, setPreferredDockStatusTab] = useState<{
    tab: TabType;
    requestKey: number;
  } | null>(null);
  const [rewindDialogRequest, setRewindDialogRequest] =
    useState<ComposerRewindDialogRequest | null>(null);
  const [forkConfirmUserMessageId, setForkConfirmUserMessageId] =
    useState<string | null>(null);
  const rewindDialogRequestSerialRef = useRef(0);
  const activeThreadStatus = options.activeThreadId
    ? options.threadStatusById[options.activeThreadId] ?? null
    : null;
  const activeThreadSummary =
    options.activeWorkspaceId && options.activeThreadId
      ? (options.threadsByWorkspace[options.activeWorkspaceId] ?? []).find(
          (thread) => thread.id === options.activeThreadId,
        ) ?? null
      : null;
  const historyRestoredAtMsByThread = options.historyRestoredAtMsByThread ?? {};
  const activeHistoryRestoredAtMs = options.activeThreadId
    ? historyRestoredAtMsByThread[options.activeThreadId] ?? null
    : null;
  const activeThreadHistoryLoading = options.activeThreadId
    ? options.historyLoadingByThreadId[options.activeThreadId] === true
    : false;
  const showMessageAnchors =
    options.showMessageAnchors &&
    clientUiVisibility.isControlVisible("cornerStatus.messageAnchors");
  const showStickyUserBubble =
    clientUiVisibility.isControlVisible("curtain.stickyUserBubble");
  const showTopSessionTabs =
    clientUiVisibility.isPanelVisible("topSessionTabs");
  const showTopRunControls =
    clientUiVisibility.isControlVisible("topRun.start");
  const showOpenWorkspaceAppControl =
    clientUiVisibility.isControlVisible("topTool.openWorkspace");
  const showRightActivityToolbar =
    clientUiVisibility.isPanelVisible("rightActivityToolbar");
  const rightToolbarVisibleTabs = {
    activity: clientUiVisibility.isControlVisible("rightToolbar.activity"),
    projectMap: clientUiVisibility.isControlVisible("rightToolbar.projectMap"),
    radar: clientUiVisibility.isControlVisible("rightToolbar.radar"),
    git: clientUiVisibility.isControlVisible("rightToolbar.git"),
    files: clientUiVisibility.isControlVisible("rightToolbar.files"),
    search: clientUiVisibility.isControlVisible("rightToolbar.search"),
    notes: clientUiVisibility.isControlVisible("rightToolbar.notes"),
  };
  const hasVisibleRightToolbarControl =
    Object.values(rightToolbarVisibleTabs).some(Boolean);
  const showBottomActivityPanel =
    clientUiVisibility.isPanelVisible("bottomActivityPanel");
  const showGlobalRuntimeNoticeDock =
    clientUiVisibility.isPanelVisible("globalRuntimeNoticeDock");
  const bottomActivityVisibleTabs = {
    todo: clientUiVisibility.isControlVisible("bottomActivity.tasks"),
    subagent: clientUiVisibility.isControlVisible("bottomActivity.agents"),
    checkpoint: clientUiVisibility.isControlVisible("bottomActivity.checkpoint"),
    latestUserMessage: clientUiVisibility.isControlVisible(
      "bottomActivity.latestConversation",
    ),
  };
  const isThreadThinking = activeThreadStatus?.isProcessing ?? false;
  const fileRenderPressure = useMemo(
    () => ({
      engineProcessing: isThreadThinking,
      editorSplitChatVisible:
        options.centerMode === "editor" && !options.isEditorFileMaximized,
      activeSurface: "editor" as const,
    }),
    [isThreadThinking, options.centerMode, options.isEditorFileMaximized],
  );
  const conversationEngine = useMemo(
    () =>
      resolveActiveConversationEngine(
        activeThreadSummary,
        options.activeThreadId,
        options.selectedEngine,
      ),
    [activeThreadSummary, options.activeThreadId, options.selectedEngine],
  );
  // Keep heartbeatPulse in a ref so conversationState doesn't change
  // on every heartbeat tick — heartbeat only affects WorkingIndicator
  // which receives it as a separate prop via Messages.
  const heartbeatPulseRef = useRef(activeThreadStatus?.heartbeatPulse ?? null);
  heartbeatPulseRef.current = activeThreadStatus?.heartbeatPulse ?? null;
  const conversationItems = useMemo(
    () =>
      appendQueuedHandoffBubbleIfNeeded(
        options.activeItems,
        options.activeQueuedHandoffBubble,
      ),
    [options.activeItems, options.activeQueuedHandoffBubble],
  );
  const composerLiveInputs = useMemo(
    () => ({
      items: options.activeItems,
      threadItemsByThread: options.threadItemsByThread,
      threadStatusById: options.threadStatusById,
      tokenUsage: options.activeTokenUsage,
      rateLimits: options.activeRateLimits,
    }),
    [
      options.activeItems,
      options.threadItemsByThread,
      options.threadStatusById,
      options.activeTokenUsage,
      options.activeRateLimits,
    ],
  );
  const deferredComposerLiveInputs = useDeferredValue(composerLiveInputs);
  const backgroundRenderGatingEnabled = isBackgroundRenderGatingEnabled();
  const deferredThreadItemsByThreadValue = useDeferredValue(options.threadItemsByThread);
  const deferredThreadStatusByIdValue = useDeferredValue(options.threadStatusById);
  const deferredThreadItemsByThread = backgroundRenderGatingEnabled
    ? deferredThreadItemsByThreadValue
    : options.threadItemsByThread;
  const deferredThreadStatusById = backgroundRenderGatingEnabled
    ? deferredThreadStatusByIdValue
    : options.threadStatusById;
  const deferredComposerActiveThreadStatus = options.activeThreadId
    ? deferredComposerLiveInputs.threadStatusById[options.activeThreadId] ??
      activeThreadStatus
    : null;

  const conversationState = useMemo<ConversationState>(
    () => ({
      items: conversationItems,
      plan: options.plan,
      userInputQueue: options.userInputRequests,
      meta: {
        workspaceId: options.activeWorkspace?.id ?? "",
        threadId: options.activeThreadId ?? "",
        engine: conversationEngine,
        activeTurnId: options.activeTurnId ?? null,
        isThinking: activeThreadStatus?.isProcessing ?? false,
        heartbeatPulse: heartbeatPulseRef.current,
        historyRestoredAtMs: activeHistoryRestoredAtMs,
      },
    }),
    [
      conversationItems,
      options.plan,
      options.userInputRequests,
      options.activeWorkspace?.id,
      options.activeThreadId,
      options.activeTurnId,
      conversationEngine,
      activeThreadStatus?.isProcessing,
      activeHistoryRestoredAtMs,
    ],
  );
  const presentationProfile = useMemo(
    () =>
      options.usePresentationProfile
        ? resolvePresentationProfile(conversationEngine)
        : null,
    [options.usePresentationProfile, conversationEngine],
  );
  const activeWorkspacePath = options.activeWorkspace?.path ?? null;
  const gitDiffItems = options.gitDiffs;
  const canonicalGitPanelChanges = useMemo(
    () =>
      buildCanonicalGitChanges({
        files: options.gitStatus.files,
        stagedFiles: options.gitStatus.stagedFiles,
        unstagedFiles: options.gitStatus.unstagedFiles,
        diffs: options.gitDiffs,
      }),
    [
      options.gitDiffs,
      options.gitStatus.files,
      options.gitStatus.stagedFiles,
      options.gitStatus.unstagedFiles,
    ],
  );
  const onGitDiffListViewChange = options.onGitDiffListViewChange;
  const onSelectDiff = options.onSelectDiff;
  const handleOpenDiffPath = useCallback(
    (path: string) => {
      const availablePaths = gitDiffItems.map((entry) =>
        entry.path.replace(/\\/g, "/").replace(/^\.\/+/, "").trim(),
      );
      const resolvedPath = resolveDiffPathFromWorkspacePath(
        path,
        availablePaths,
        activeWorkspacePath,
      );
      onGitDiffListViewChange("tree");
      onSelectDiff(resolvedPath ?? null);
    },
    [gitDiffItems, activeWorkspacePath, onGitDiffListViewChange, onSelectDiff],
  );
  const workspaceActivity = useWorkspaceSessionActivity({
    activeThreadId: options.activeThreadId,
    threads: options.activeWorkspaceId
      ? options.threadsByWorkspace[options.activeWorkspaceId] ?? []
      : [],
    itemsByThread: deferredThreadItemsByThread,
    threadParentById: options.threadParentById,
    threadStatusById: deferredThreadStatusById,
  });
  const isEditorFileMaximized = options.isEditorFileMaximized;
  const onToggleEditorFileMaximized = options.onToggleEditorFileMaximized;
  const handleOpenDiffFromActivity = useCallback(
    (
      path: string,
      location?: EditorNavigationLocation,
      highlightOptions?: OpenFileOptions,
    ) => {
      onOpenFile(path, location, highlightOptions);
      if (!isEditorFileMaximized) {
        onToggleEditorFileMaximized();
      }
    },
    [isEditorFileMaximized, onOpenFile, onToggleEditorFileMaximized],
  );
  const handleOpenProjectMapEvidenceFile = useCallback(
    (path: string, location?: EditorNavigationLocation) => {
      onOpenFile(path, location, { editorSplitCompanion: "projectMap" });
      if (isEditorFileMaximized) {
        onToggleEditorFileMaximized();
      }
    },
    [isEditorFileMaximized, onOpenFile, onToggleEditorFileMaximized],
  );
  const groupedWorkspacesForHeader = useMemo(() => {
    return buildWorkspaceHeaderGroups(options.groupedWorkspaces, options.workspaces);
  }, [options.groupedWorkspaces, options.workspaces]);

  topbarSessionWindowsRef.current = pruneTopbarSessionWindows(
    topbarSessionWindowsRef.current,
    options.threadsByWorkspace,
  );
  const currentActivation = {
    workspaceId: options.activeWorkspaceId,
    threadId: options.activeThreadId,
  };
  if (!lastActivationRef.current.initialized) {
    lastActivationRef.current = {
      initialized: true,
      workspaceId: currentActivation.workspaceId,
      threadId: currentActivation.threadId,
    };
  } else {
    const isActivationChanged =
      currentActivation.workspaceId !== lastActivationRef.current.workspaceId ||
      currentActivation.threadId !== lastActivationRef.current.threadId;
    if (
      isActivationChanged &&
      currentActivation.workspaceId &&
      currentActivation.threadId
    ) {
      dismissedTopbarTabKeysRef.current.delete(
        toTopbarTabKey(
          currentActivation.workspaceId,
          currentActivation.threadId,
        ),
      );
      topbarSessionWindowsRef.current = recordTopbarSessionActivation(
        topbarSessionWindowsRef.current,
        currentActivation.workspaceId,
        currentActivation.threadId,
        options.threadsByWorkspace,
        TOPBAR_SESSION_TAB_MAX,
      );
    }
    lastActivationRef.current = {
      initialized: true,
      workspaceId: currentActivation.workspaceId,
      threadId: currentActivation.threadId,
    };
  }
  if (currentActivation.workspaceId && currentActivation.threadId) {
    const activeKey = toTopbarTabKey(
      currentActivation.workspaceId,
      currentActivation.threadId,
    );
    const activeExists = topbarSessionWindowsRef.current.tabs.some(
      (tab) =>
        tab.workspaceId === currentActivation.workspaceId &&
        tab.threadId === currentActivation.threadId,
    );
    if (!activeExists && !dismissedTopbarTabKeysRef.current.has(activeKey)) {
      topbarSessionWindowsRef.current = recordTopbarSessionActivation(
        topbarSessionWindowsRef.current,
        currentActivation.workspaceId,
        currentActivation.threadId,
        options.threadsByWorkspace,
        TOPBAR_SESSION_TAB_MAX,
      );
    }
  }
  const pendingSelection = pendingTopbarSelectionRef.current;
  if (
    pendingSelection &&
    pendingSelection.workspaceId === options.activeWorkspaceId &&
    pendingSelection.threadId === options.activeThreadId
  ) {
    pendingTopbarSelectionRef.current = null;
  } else if (
    pendingSelection &&
    Date.now() - pendingSelection.setAt > 1800
  ) {
    pendingTopbarSelectionRef.current = null;
  }
  const highlightedWorkspaceId =
    pendingTopbarSelectionRef.current?.workspaceId ?? options.activeWorkspaceId;
  const highlightedThreadId =
    pendingTopbarSelectionRef.current?.threadId ?? options.activeThreadId;
  const selectedWorkspaceId = options.activeWorkspaceId;
  const selectedThreadId = options.activeThreadId;
  const selectThread = options.onSelectThread;
  const selectWorkspace = options.onSelectWorkspace;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      const matchesNext = matchesShortcutForPlatform(
        event,
        options.cycleOpenSessionNextShortcut,
      );
      const matchesPrev = matchesShortcutForPlatform(
        event,
        options.cycleOpenSessionPrevShortcut,
      );
      if (!matchesNext && !matchesPrev) {
        return;
      }
      const targetTab = pickAdjacentOpenSessionTab(
        topbarSessionWindowsRef.current,
        options.activeWorkspaceId,
        options.activeThreadId,
        matchesNext ? "next" : "prev",
      );
      if (!targetTab) {
        return;
      }
      event.preventDefault();
      pendingTopbarSelectionRef.current = {
        workspaceId: targetTab.workspaceId,
        threadId: targetTab.threadId,
        setAt: Date.now(),
      };
      forceTopbarSessionRender();
      selectThread(targetTab.workspaceId, targetTab.threadId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    options.activeThreadId,
    options.activeWorkspaceId,
    options.cycleOpenSessionNextShortcut,
    options.cycleOpenSessionPrevShortcut,
    selectThread,
  ]);

  const topbarSessionTabItems = buildTopbarSessionTabItems(
    highlightedWorkspaceId,
    highlightedThreadId,
    options.threadsByWorkspace,
    topbarSessionWindowsRef.current,
    t("threads.untitledThread"),
    {
      codex: t("settings.projectSessionEngineCodex"),
      claude: t("settings.projectSessionEngineClaude"),
      gemini: t("settings.projectSessionEngineGemini"),
      opencode: t("settings.projectSessionEngineOpencode"),
    },
  );
  const applyTopbarWindowMutation = useCallback(
    (
      mutate: (windows: TopbarSessionWindows) => TopbarSessionWindows,
      fallbackWorkspaceId: string,
    ) => {
      const previousWindows = topbarSessionWindowsRef.current;
      const nextWindows = mutate(previousWindows);
      if (nextWindows === previousWindows) {
        return;
      }
      const previousTabKeys = new Set(
        previousWindows.tabs.map((tab) => toTopbarTabKey(tab.workspaceId, tab.threadId)),
      );
      const nextTabKeys = new Set(
        nextWindows.tabs.map((tab) => toTopbarTabKey(tab.workspaceId, tab.threadId)),
      );
      previousTabKeys.forEach((tabKey) => {
        if (!nextTabKeys.has(tabKey)) {
          dismissedTopbarTabKeysRef.current.add(tabKey);
        }
      });
      topbarSessionWindowsRef.current = nextWindows;
      if (pendingTopbarSelectionRef.current) {
        const pendingKey = toTopbarTabKey(
          pendingTopbarSelectionRef.current.workspaceId,
          pendingTopbarSelectionRef.current.threadId,
        );
        if (!nextTabKeys.has(pendingKey)) {
          pendingTopbarSelectionRef.current = null;
        }
      }
      const activeWorkspaceId = selectedWorkspaceId;
      const activeThreadId = selectedThreadId;
      const activeKey =
        activeWorkspaceId && activeThreadId
          ? toTopbarTabKey(activeWorkspaceId, activeThreadId)
          : null;
      const isActiveRemoved = Boolean(activeKey && !nextTabKeys.has(activeKey));
      forceTopbarSessionRender();
      if (!isActiveRemoved || !activeWorkspaceId || !activeThreadId) {
        return;
      }
      const fallbackTab = pickAdjacentTopbarSessionFallbackTab(
        previousWindows,
        nextWindows,
        activeWorkspaceId,
        activeThreadId,
      );
      if (fallbackTab) {
        pendingTopbarSelectionRef.current = {
          workspaceId: fallbackTab.workspaceId,
          threadId: fallbackTab.threadId,
          setAt: Date.now(),
        };
        forceTopbarSessionRender();
        selectThread(fallbackTab.workspaceId, fallbackTab.threadId);
        return;
      }
      selectWorkspace(activeWorkspaceId || fallbackWorkspaceId);
    },
    [selectedThreadId, selectedWorkspaceId, selectThread, selectWorkspace],
  );
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (!matchesShortcutForPlatform(event, options.closeCurrentSessionShortcut)) {
        return;
      }
      event.preventDefault();
      if (!options.activeWorkspaceId || !options.activeThreadId) {
        return;
      }
      applyTopbarWindowMutation(
        (windows) =>
          dismissTopbarSessionTab(
            windows,
            options.activeWorkspaceId ?? "",
            options.activeThreadId ?? "",
          ),
        options.activeWorkspaceId,
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    applyTopbarWindowMutation,
    options.activeThreadId,
    options.activeWorkspaceId,
    options.closeCurrentSessionShortcut,
  ]);
  const threadStatusById = options.threadStatusById;
  const showTopbarTabMenu = useCallback(
    (
      position: { x: number; y: number },
      workspaceId: string,
      threadId: string,
    ) => {
      const currentWindows = topbarSessionWindowsRef.current;
      const targetIndex = currentWindows.tabs.findIndex(
        (tab) => tab.workspaceId === workspaceId && tab.threadId === threadId,
      );
      if (targetIndex < 0) {
        return;
      }
      const hasLeftTabs = targetIndex > 0;
      const hasRightTabs = targetIndex < currentWindows.tabs.length - 1;
      const hasCompletedTabs = currentWindows.tabs.some(
        (tab) => threadStatusById[tab.threadId]?.isProcessing === false,
      );
      const clampedPosition = clampRendererContextMenuPosition(position.x, position.y, {
        width: 260,
        height: 220,
      });
      setTopbarTabContextMenu({
        ...clampedPosition,
        label: t("threads.topbarSessionTabsAriaLabel"),
        items: [
          {
            type: "item",
            id: "close-tab",
            label: t("threads.closeTab"),
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissTopbarSessionTab(windows, workspaceId, threadId),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-left-tabs",
            label: t("threads.closeLeftTabs"),
            disabled: !hasLeftTabs,
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissTopbarSessionTabsToLeft(windows, workspaceId, threadId),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-right-tabs",
            label: t("threads.closeRightTabs"),
            disabled: !hasRightTabs,
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissTopbarSessionTabsToRight(windows, workspaceId, threadId),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-all-tabs",
            label: t("threads.closeAllTabs"),
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissAllTopbarSessionTabs(windows),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-completed-tabs",
            label: t("threads.closeCompletedTabs"),
            disabled: !hasCompletedTabs,
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissCompletedTopbarSessionTabs(windows, threadStatusById),
                workspaceId,
              );
            },
          },
        ],
      });
    },
    [applyTopbarWindowMutation, t, threadStatusById],
  );
  const sessionTabsNode =
    !options.isPhone && !options.isTablet && showTopSessionTabs ? (
      <TopbarSessionTabs
        tabs={topbarSessionTabItems}
        ariaLabel={t("threads.topbarSessionTabsAriaLabel")}
        onSelectThread={(workspaceId, threadId) => {
          const isCurrentTab =
            workspaceId === options.activeWorkspaceId &&
            threadId === options.activeThreadId;
          if (isCurrentTab) {
            return;
          }
          pendingTopbarSelectionRef.current = {
            workspaceId,
            threadId,
            setAt: Date.now(),
          };
          forceTopbarSessionRender();
          options.onSelectThread(workspaceId, threadId);
        }}
        onCloseThread={(workspaceId, threadId) => {
          applyTopbarWindowMutation(
            (windows) => dismissTopbarSessionTab(windows, workspaceId, threadId),
            workspaceId,
          );
        }}
        onShowTabMenu={showTopbarTabMenu}
      />
    ) : null;

  const sidebarNode = (
    <Sidebar
      workspaces={options.workspaces}
      groupedWorkspaces={options.groupedWorkspaces}
      hasWorkspaceGroups={options.hasWorkspaceGroups}
      deletingWorktreeIds={options.deletingWorktreeIds}
      threadsByWorkspace={options.threadsByWorkspace}
      activeItems={options.activeItems}
      threadParentById={options.threadParentById}
      threadStatusById={options.threadStatusById}
      runningSessionCountByWorkspaceId={options.runningSessionCountByWorkspaceId}
      recentSessionCountByWorkspaceId={options.recentCompletedSessionCountByWorkspaceId}
      hydratedThreadListWorkspaceIds={options.hydratedThreadListWorkspaceIds}
      threadListLoadingByWorkspace={options.threadListLoadingByWorkspace}
      threadListPagingByWorkspace={options.threadListPagingByWorkspace}
      threadListCursorByWorkspace={options.threadListCursorByWorkspace}
      activeWorkspaceId={options.activeWorkspaceId}
      activeThreadId={options.activeThreadId}
      systemProxyEnabled={options.systemProxyEnabled}
      systemProxyUrl={options.systemProxyUrl}
      accountRateLimits={options.activeRateLimits}
      usageShowRemaining={options.usageShowRemaining}
      accountInfo={options.accountInfo}
      onSwitchAccount={options.onSwitchAccount}
      onCancelSwitchAccount={options.onCancelSwitchAccount}
      accountSwitching={options.accountSwitching}
      onOpenSettings={options.onOpenSettings}
      onOpenDebug={options.onOpenDebug}
      showDebugButton={options.showDebugButton}
      onAddWorkspace={options.onAddWorkspace}
      onSelectHome={options.onSelectHome}
      onSelectWorkspace={options.onSelectWorkspace}
      onConnectWorkspace={options.onConnectWorkspace}
      onAddAgent={options.onAddAgent}
      engineOptions={options.engineOptions}
      enabledEngines={options.enabledEngines}
      onRefreshEngineOptions={options.onRefreshEngineOptions}
      onAddSharedAgent={options.onAddSharedAgent}
      onAddWorktreeAgent={options.onAddWorktreeAgent}
      onAddCloneAgent={options.onAddCloneAgent}
      onToggleWorkspaceCollapse={options.onToggleWorkspaceCollapse}
      onSelectThread={options.onSelectThread}
      onDeleteThread={options.onDeleteThread}
      onArchiveThread={options.onArchiveThread}
      deleteConfirmThreadId={options.deleteConfirmThreadId}
      deleteConfirmWorkspaceId={options.deleteConfirmWorkspaceId}
      deleteConfirmBusy={options.deleteConfirmBusy}
      onCancelDeleteConfirm={options.onCancelDeleteConfirm}
      onConfirmDeleteConfirm={options.onConfirmDeleteConfirm}
      onSyncThread={options.onSyncThread}
      pinThread={options.pinThread}
      unpinThread={options.unpinThread}
      isThreadPinned={options.isThreadPinned}
      isThreadAutoNaming={options.isThreadAutoNaming}
      getPinTimestamp={options.getPinTimestamp}
      pinnedThreadsVersion={options.pinnedThreadsVersion}
      onRenameThread={options.onRenameThread}
      onAutoNameThread={options.onAutoNameThread}
      onOpenClaudeTui={options.onOpenClaudeTui}
      onDeleteWorkspace={options.onDeleteWorkspace}
      onDeleteWorktree={options.onDeleteWorktree}
      onRenameWorkspaceAlias={options.onRenameWorkspaceAlias}
      onLoadOlderThreads={options.onLoadOlderThreads}
      onReloadWorkspaceThreads={options.onReloadWorkspaceThreads}
      onQuickReloadWorkspaceThreads={options.onQuickReloadWorkspaceThreads}
      workspaceDropTargetRef={options.workspaceDropTargetRef}
      isWorkspaceDropActive={options.isWorkspaceDropActive}
      workspaceDropText={options.workspaceDropText}
      onWorkspaceDragOver={options.onWorkspaceDragOver}
      onWorkspaceDragEnter={options.onWorkspaceDragEnter}
      onWorkspaceDragLeave={options.onWorkspaceDragLeave}
      onWorkspaceDrop={options.onWorkspaceDrop}
      appMode={options.appMode}
      onAppModeChange={options.onAppModeChange}
      onOpenHomeChat={options.onOpenHomeChat}
      onLockPanel={options.onLockPanel}
      onOpenProjectMemory={options.onOpenProjectMemory}
      onOpenReleaseNotes={options.onOpenReleaseNotes}
      onOpenGlobalSearch={options.onOpenGlobalSearch}
      globalSearchShortcut={options.globalSearchShortcut}
      openChatShortcut={options.openChatShortcut}
      openKanbanShortcut={options.openKanbanShortcut}
      showLoadingProgressDialog={options.showLoadingProgressDialog}
      hideLoadingProgressDialog={options.hideLoadingProgressDialog}
      onOpenSpecHub={options.onOpenSpecHub}
      onOpenWorkspaceHome={options.onOpenWorkspaceHome}
      showTerminalButton={options.showTerminalButton}
      isTerminalOpen={options.terminalOpen}
      onToggleTerminal={options.onToggleTerminal}
    />
  );

  const [localClaudeThinkingVisible, setLocalClaudeThinkingVisible] = useState<boolean | undefined>(
    undefined,
  );
  const [selectedCodeAnnotations, setSelectedCodeAnnotations] = useState<CodeAnnotationSelection[]>([]);
  const handleCreateCodeAnnotation = useCallback(
    (annotation: CodeAnnotationDraftInput) => {
      const selection = createCodeAnnotationSelection(annotation);
      const dedupeKey = buildCodeAnnotationDedupeKey(annotation);
      if (!selection || !dedupeKey) {
        return;
      }
      setSelectedCodeAnnotations((current) => {
        const existingIndex = current.findIndex(
          (entry) => buildCodeAnnotationDedupeKey(entry) === dedupeKey,
        );
        if (existingIndex === -1) {
          return [...current, selection];
        }
        return current.map((entry, index) =>
          index === existingIndex ? selection : entry,
        );
      });
    },
    [],
  );
  const handleRemoveCodeAnnotation = useCallback((annotationId: string) => {
    setSelectedCodeAnnotations((current) =>
      current.filter((entry) => entry.id !== annotationId),
    );
  }, []);
  const handleClearCodeAnnotations = useCallback(() => {
    setSelectedCodeAnnotations((current) => (current.length === 0 ? current : []));
  }, []);
  const codeAnnotationBridgeProps = useMemo<CodeAnnotationBridgeProps>(
    () => ({
      onCreateCodeAnnotation: handleCreateCodeAnnotation,
      onRemoveCodeAnnotation: handleRemoveCodeAnnotation,
      codeAnnotations: selectedCodeAnnotations,
    }),
    [handleCreateCodeAnnotation, handleRemoveCodeAnnotation, selectedCodeAnnotations],
  );
  useEffect(() => {
    setSelectedCodeAnnotations((current) => (current.length === 0 ? current : []));
  }, [options.activeThreadId, options.activeWorkspace?.id]);
  const claudeThinkingVisible =
    typeof options.claudeThinkingVisible === "boolean"
      ? options.claudeThinkingVisible
      : localClaudeThinkingVisible;
  const onResolvedClaudeThinkingVisibleChange =
    options.onResolvedClaudeThinkingVisibleChange;
  const handleResolvedAlwaysThinkingChange = useCallback((enabled: boolean) => {
    setLocalClaudeThinkingVisible((previous) => (previous === enabled ? previous : enabled));
    onResolvedClaudeThinkingVisibleChange?.(enabled);
  }, [onResolvedClaudeThinkingVisibleChange]);
  const onForkFromMessage = options.onForkFromMessage;
  const handleOpenForkConfirmFromMessage = useCallback((messageId: string) => {
    const normalizedMessageId = messageId.trim();
    if (!normalizedMessageId) {
      return;
    }
    setForkConfirmUserMessageId(normalizedMessageId);
  }, []);
  const handleCancelForkConfirm = useCallback(() => {
    setForkConfirmUserMessageId(null);
  }, []);
  const handleConfirmForkFromMessage = useCallback(
    async (messageId: string) => {
      await onForkFromMessage?.(messageId);
    },
    [onForkFromMessage],
  );
  const handleOpenRewindDialogFromMessage = useCallback((messageId: string) => {
    const normalizedMessageId = messageId.trim();
    if (!normalizedMessageId) {
      return;
    }
    const nextRequestId = rewindDialogRequestSerialRef.current + 1;
    rewindDialogRequestSerialRef.current = nextRequestId;
    setRewindDialogRequest({
      requestId: nextRequestId,
      userMessageId: normalizedMessageId,
    });
  }, []);
  const handleRewindDialogRequestConsumed = useCallback((requestId: number) => {
    setRewindDialogRequest((current) =>
      current?.requestId === requestId ? null : current,
    );
  }, []);

  const messagesNode = useMemo(() => (
    <>
      <Messages
        items={options.activeItems}
        threadId={options.activeThreadId ?? null}
        workspaceId={options.activeWorkspace?.id ?? null}
        workspacePath={options.activeWorkspace?.path ?? null}
        openTargets={options.openAppTargets}
        selectedOpenAppId={options.selectedOpenAppId}
        showMessageAnchors={showMessageAnchors}
        showStickyUserBubble={showStickyUserBubble}
        codeBlockCopyUseModifier={options.codeBlockCopyUseModifier}
        userInputRequests={options.userInputRequests}
        approvals={options.approvals}
        workspaces={options.workspaces}
        onUserInputSubmit={options.handleUserInputSubmit}
        onUserInputDismiss={options.handleUserInputDismiss}
        onRecoverThreadRuntime={options.onRecoverThreadRuntime}
        onRecoverThreadRuntimeAndResend={options.onRecoverThreadRuntimeAndResend}
        onThreadRecoveryFork={options.onThreadRecoveryFork}
        onForkFromMessage={
          onForkFromMessage ? handleOpenForkConfirmFromMessage : undefined
        }
        onRewindFromMessage={
          options.onRewind ? handleOpenRewindDialogFromMessage : undefined
        }
        onApprovalDecision={options.handleApprovalDecision}
        onApprovalBatchAccept={options.handleApprovalBatchAccept}
        onApprovalRemember={options.handleApprovalRemember}
        conversationState={conversationState}
        presentationProfile={presentationProfile}
        activeEngine={conversationEngine}
        claudeThinkingVisible={claudeThinkingVisible}
        activeCollaborationModeId={options.selectedCollaborationModeId}
        plan={options.plan}
        isPlanMode={options.isPlanMode}
        isPlanProcessing={options.isProcessing}
        onOpenDiffPath={handleOpenDiffPath}
        onOpenPlanPanel={options.onOpenPlanPanel}
        onExitPlanModeExecute={options.handleExitPlanModeExecute}
        onOpenWorkspaceFile={options.onOpenFile}
        agentTaskScrollRequest={options.agentTaskScrollRequest}
        isThinking={isThreadThinking}
        isHistoryLoading={activeThreadHistoryLoading}
        isContextCompacting={activeThreadStatus?.isContextCompacting ?? false}
        proxyEnabled={options.systemProxyEnabled}
        proxyUrl={options.systemProxyUrl}
        processingStartedAt={activeThreadStatus?.processingStartedAt ?? null}
        lastDurationMs={activeThreadStatus?.lastDurationMs ?? null}
        heartbeatPulse={heartbeatPulseRef.current ?? 0}
        codexSilentSuspectedAt={activeThreadStatus?.codexSilentSuspectedAt ?? null}
      />
      <MessageForkConfirmDialog
        userMessageId={forkConfirmUserMessageId}
        onCancel={handleCancelForkConfirm}
        onConfirm={handleConfirmForkFromMessage}
      />
    </>
  ), [
    options.activeItems,
    options.activeThreadId,
    options.activeWorkspace?.id,
    options.activeWorkspace?.path,
    options.systemProxyEnabled,
    options.systemProxyUrl,
    options.openAppTargets,
    options.selectedOpenAppId,
    showMessageAnchors,
    showStickyUserBubble,
    options.codeBlockCopyUseModifier,
    options.userInputRequests,
    options.approvals,
    options.workspaces,
    options.handleUserInputSubmit,
    options.handleUserInputDismiss,
    options.onRecoverThreadRuntime,
    options.onRecoverThreadRuntimeAndResend,
    options.onThreadRecoveryFork,
    onForkFromMessage,
    handleOpenForkConfirmFromMessage,
    forkConfirmUserMessageId,
    handleCancelForkConfirm,
    handleConfirmForkFromMessage,
    options.onRewind,
    handleOpenRewindDialogFromMessage,
    options.handleApprovalDecision,
    options.handleApprovalBatchAccept,
    options.handleApprovalRemember,
    conversationState,
    presentationProfile,
    conversationEngine,
    claudeThinkingVisible,
    options.selectedCollaborationModeId,
    options.plan,
    options.isPlanMode,
    options.isProcessing,
    handleOpenDiffPath,
    options.onOpenPlanPanel,
    options.handleExitPlanModeExecute,
    options.onOpenFile,
    options.agentTaskScrollRequest,
    isThreadThinking,
    activeThreadHistoryLoading,
    activeThreadStatus?.isContextCompacting,
    activeThreadStatus?.processingStartedAt,
    activeThreadStatus?.lastDurationMs,
    activeThreadStatus?.codexSilentSuspectedAt,
    // heartbeatPulse removed from deps — uses ref to avoid
    // recreating messagesNode on every heartbeat tick
  ]
  );

  const composerSelectedAgent = useMemo(
    () =>
      options.selectedAgent
        ? {
            id: options.selectedAgent.id,
            name: options.selectedAgent.name,
            prompt: options.selectedAgent.prompt ?? undefined,
            icon: options.selectedAgent.icon ?? undefined,
          }
        : null,
    [options.selectedAgent],
  );
  const composerCommands = options.commands ?? EMPTY_COMMANDS;
  const isStatusPanelEngine =
    options.selectedEngine === "claude" ||
    options.selectedEngine === "codex" ||
    options.selectedEngine === "gemini" ||
    options.selectedEngine === "opencode";
  const isStatusPanelCodexEngine = options.selectedEngine === "codex";
  const {
    todoTotal,
    subagentTotal,
    fileChanges,
    commandTotal,
  } = useStatusPanelData(options.activeItems, {
    isCodexEngine: isStatusPanelCodexEngine,
    activeThreadId: options.activeThreadId,
    itemsByThread: deferredThreadItemsByThread,
    threadParentById: options.threadParentById,
    threadStatusById: deferredThreadStatusById,
  });
  const hasStatusPanelActivity =
    todoTotal > 0 ||
    subagentTotal > 0 ||
    fileChanges.length > 0 ||
    commandTotal > 0 ||
    options.isPlanMode ||
    Boolean(options.plan);
  const hasVisibleBaselineStatusTab =
    bottomActivityVisibleTabs.latestUserMessage ||
    bottomActivityVisibleTabs.checkpoint;
  const shouldMountBottomStatusPanel =
    showBottomActivityPanel &&
    isStatusPanelEngine &&
    (hasStatusPanelActivity ||
      options.bottomStatusPanelExpanded ||
      (hasVisibleBaselineStatusTab && Boolean(options.activeThreadId)));
  const showBottomStatusPanel =
    shouldMountBottomStatusPanel && options.bottomStatusPanelExpanded;
  const openBottomStatusPanel = options.onOpenPlanPanel;
  const handleExpandCheckpointToDock = useCallback(() => {
    openBottomStatusPanel();
    setPreferredDockStatusTab((previous) => ({
      tab: "checkpoint",
      requestKey: (previous?.requestKey ?? 0) + 1,
    }));
  }, [openBottomStatusPanel]);
  const globalRuntimeNoticeDock = useGlobalRuntimeNoticeDock(options.workspaces);
  const composerRuntimeLifecycleState = resolveRuntimeLifecycleForComposer(
    globalRuntimeNoticeDock.runtimeRows,
    options.activeWorkspaceId,
    options.selectedEngine,
  );
  const handleJumpToUserInputRequest = useCallback((request: RequestUserInputRequest) => {
    if (focusUserInputRequestCard(request)) {
      return;
    }
    dispatchMessageJumpEvent(request.params.item_id);
  }, []);
  const isSharedSession = activeThreadSummary?.threadKind === "shared";
  const rewindWorkspaceGitState = deriveRewindWorkspaceGitState(
    options.gitStatus,
  );

  const renderComposerNode = (
    showStatusPanelToggleOverride?: boolean,
  ) =>
    options.showComposer ? (
      <Composer
        items={deferredComposerLiveInputs.items}
        activeThreadId={options.activeThreadId}
        threadItemsByThread={deferredComposerLiveInputs.threadItemsByThread}
        threadParentById={options.threadParentById}
        threadStatusById={deferredComposerLiveInputs.threadStatusById}
        onSend={options.onSend}
        onQueue={options.onQueue}
        onRequestContextCompaction={options.onRequestContextCompaction}
        onStop={options.onStop}
        completionEmailSelected={options.completionEmailSelected}
        completionEmailDisabled={options.completionEmailDisabled}
        onToggleCompletionEmail={options.onToggleCompletionEmail}
        onRewind={options.onRewind}
        rewindDialogRequest={rewindDialogRequest}
        onRewindDialogRequestConsumed={handleRewindDialogRequestConsumed}
        canStop={options.canStop}
        disabled={options.isReviewing}
        contextUsage={deferredComposerLiveInputs.tokenUsage}
        contextDualViewEnabled={options.contextDualViewEnabled}
        codexAutoCompactionEnabled={options.codexAutoCompactionEnabled}
        codexAutoCompactionThresholdPercent={options.codexAutoCompactionThresholdPercent}
        onCodexAutoCompactionSettingsChange={options.onCodexAutoCompactionSettingsChange}
        isContextCompacting={
          deferredComposerActiveThreadStatus?.isContextCompacting ??
          activeThreadStatus?.isContextCompacting ??
          false
        }
        codexCompactionLifecycleState={
          deferredComposerActiveThreadStatus?.codexCompactionLifecycleState ??
          activeThreadStatus?.codexCompactionLifecycleState ??
          "idle"
        }
        codexCompactionSource={
          deferredComposerActiveThreadStatus?.codexCompactionSource ??
          activeThreadStatus?.codexCompactionSource ??
          null
        }
        codexCompactionCompletedAt={
          deferredComposerActiveThreadStatus?.codexCompactionCompletedAt ??
          activeThreadStatus?.codexCompactionCompletedAt ??
          null
        }
        lastTokenUsageUpdatedAt={
          deferredComposerActiveThreadStatus?.lastTokenUsageUpdatedAt ??
          activeThreadStatus?.lastTokenUsageUpdatedAt ??
          null
        }
        accountRateLimits={deferredComposerLiveInputs.rateLimits}
        usageShowRemaining={options.usageShowRemaining}
        onRefreshAccountRateLimits={options.onRefreshAccountRateLimits}
        queuedMessages={options.activeQueue}
        userInputRequests={options.userInputRequests}
        onJumpToUserInputRequest={handleJumpToUserInputRequest}
        runtimeLifecycleState={composerRuntimeLifecycleState}
        sendLabel={
          options.composerSendLabel ??
          (options.isProcessing && !options.steerEnabled ? t("messages.queue") : t("messages.send"))
        }
        steerEnabled={options.steerEnabled}
        isProcessing={options.isProcessing}
        draftText={options.draftText}
        onDraftChange={options.onDraftChange}
        attachedImages={options.activeImages}
        onPickImages={options.onPickImages}
        onAttachImages={options.onAttachImages}
        onRemoveImage={options.onRemoveImage}
        prefillDraft={options.prefillDraft}
        onPrefillHandled={options.onPrefillHandled}
        insertText={options.insertText}
        onInsertHandled={options.onInsertHandled}
        onEditQueued={options.onEditQueued}
        onDeleteQueued={options.onDeleteQueued}
        onFuseQueued={options.onFuseQueued}
        canFuseQueuedMessages={options.canFuseActiveQueue}
        fusingQueuedMessageId={options.activeFusingMessageId}
        collaborationModes={options.collaborationModes}
        collaborationModesEnabled={options.collaborationModesEnabled}
        selectedCollaborationModeId={options.selectedCollaborationModeId}
        onSelectCollaborationMode={options.onSelectCollaborationMode}
        isSharedSession={isSharedSession}
        engines={options.engines}
        selectedEngine={options.selectedEngine}
        onSelectEngine={options.onSelectEngine}
        models={options.models}
        selectedModelId={options.selectedModelId}
        onSelectModel={options.onSelectModel}
        reasoningOptions={options.reasoningOptions}
        selectedEffort={options.selectedEffort}
        onSelectEffort={options.onSelectEffort}
        reasoningSupported={options.reasoningSupported}
        onResolvedAlwaysThinkingChange={handleResolvedAlwaysThinkingChange}
        opencodeAgents={options.opencodeAgents}
        selectedOpenCodeAgent={options.selectedOpenCodeAgent}
        onSelectOpenCodeAgent={options.onSelectOpenCodeAgent}
        selectedAgent={composerSelectedAgent}
        onAgentSelect={options.onSelectAgent}
        onOpenAgentSettings={options.onOpenAgentSettings}
        onOpenPromptSettings={options.onOpenPromptSettings}
        onOpenModelSettings={options.onOpenModelSettings}
        onRefreshModelConfig={options.onRefreshModelConfig}
        isModelConfigRefreshing={options.isModelConfigRefreshing}
        opencodeVariantOptions={options.opencodeVariantOptions}
        selectedOpenCodeVariant={options.selectedOpenCodeVariant}
        onSelectOpenCodeVariant={options.onSelectOpenCodeVariant}
        accessMode={options.accessMode}
        onSelectAccessMode={options.onSelectAccessMode}
        skills={options.skills}
        customSkillDirectories={options.customSkillDirectories}
        prompts={options.prompts}
        commands={composerCommands}
        files={options.files}
        directories={options.directories}
        gitignoredFiles={options.gitignoredFiles}
        gitignoredDirectories={options.gitignoredDirectories}
        textareaRef={options.textareaRef}
        historyKey={options.activeWorkspace?.id ?? null}
        editorSettings={options.composerEditorSettings}
        sendShortcut={options.composerSendShortcut}
        textareaHeight={options.textareaHeight}
        onTextareaHeightChange={options.onTextareaHeightChange}
        dictationEnabled={options.dictationEnabled}
        dictationState={options.dictationState}
        dictationLevel={options.dictationLevel}
        onToggleDictation={options.onToggleDictation}
        onOpenDictationSettings={options.onOpenDictationSettings}
        onOpenExperimentalSettings={options.onOpenExperimentalSettings}
        dictationTranscript={options.dictationTranscript}
        onDictationTranscriptHandled={options.onDictationTranscriptHandled}
        dictationError={options.dictationError}
        onDismissDictationError={options.onDismissDictationError}
        dictationHint={options.dictationHint}
        onDismissDictationHint={options.onDismissDictationHint}
        linkedKanbanPanels={options.composerLinkedKanbanPanels}
        selectedLinkedKanbanPanelId={options.selectedComposerKanbanPanelId}
        onSelectLinkedKanbanPanel={options.onSelectComposerKanbanPanel}
        kanbanContextMode={options.composerKanbanContextMode}
        onKanbanContextModeChange={options.onComposerKanbanContextModeChange}
        onOpenLinkedKanbanPanel={options.onOpenComposerKanbanPanel}
        onOpenContextLedgerMemory={options.onOpenContextLedgerMemory}
        onOpenContextLedgerNote={options.onOpenContextLedgerNote}
        activeFilePath={options.activeComposerFilePath}
        activeFileLineRange={options.activeComposerFileLineRange}
        fileReferenceMode={options.fileReferenceMode}
        activeWorkspaceId={options.activeWorkspaceId}
        activeWorkspaceName={options.activeWorkspace?.name ?? null}
        activeWorkspacePath={options.activeWorkspace?.path ?? null}
        rewindWorkspaceGitState={rewindWorkspaceGitState}
        plan={options.plan}
        isPlanMode={options.isPlanMode}
        onOpenDiffPath={(path) => options.onOpenFile(path)}
        showStatusPanelToggleOverride={showStatusPanelToggleOverride}
        statusPanelExpandedOverride={showBottomStatusPanel}
        onToggleStatusPanelOverride={
          showBottomStatusPanel ? options.onClosePlanPanel : options.onOpenPlanPanel
        }
        selectedCodeAnnotations={selectedCodeAnnotations}
        onRemoveCodeAnnotation={handleRemoveCodeAnnotation}
        onClearCodeAnnotations={handleClearCodeAnnotations}
        reviewPrompt={options.reviewPrompt}
        onReviewPromptClose={options.onReviewPromptClose}
        onReviewPromptShowPreset={options.onReviewPromptShowPreset}
        onReviewPromptChoosePreset={options.onReviewPromptChoosePreset}
        highlightedPresetIndex={options.highlightedPresetIndex}
        onReviewPromptHighlightPreset={options.onReviewPromptHighlightPreset}
        highlightedBranchIndex={options.highlightedBranchIndex}
        onReviewPromptHighlightBranch={options.onReviewPromptHighlightBranch}
        highlightedCommitIndex={options.highlightedCommitIndex}
        onReviewPromptHighlightCommit={options.onReviewPromptHighlightCommit}
        onReviewPromptKeyDown={options.onReviewPromptKeyDown}
        onReviewPromptSelectBranch={options.onReviewPromptSelectBranch}
        onReviewPromptSelectBranchAtIndex={options.onReviewPromptSelectBranchAtIndex}
        onReviewPromptConfirmBranch={options.onReviewPromptConfirmBranch}
        onReviewPromptSelectCommit={options.onReviewPromptSelectCommit}
        onReviewPromptSelectCommitAtIndex={options.onReviewPromptSelectCommitAtIndex}
        onReviewPromptConfirmCommit={options.onReviewPromptConfirmCommit}
        onReviewPromptUpdateCustomInstructions={options.onReviewPromptUpdateCustomInstructions}
        onReviewPromptConfirmCustom={options.onReviewPromptConfirmCustom}
      />
    ) : null;
  const composerNode = renderComposerNode(false);
  const homeComposerNode = renderComposerNode(false);
  const approvalToastsNode = null;
  const topbarTabContextMenuNode = topbarTabContextMenu ? (
    <RendererContextMenu
      menu={topbarTabContextMenu}
      onClose={() => setTopbarTabContextMenu(null)}
      className="renderer-context-menu topbar-session-context-menu"
    />
  ) : null;

  const updateToastNode = (
    <UpdateToast
      state={options.updaterState}
      onUpdate={options.onUpdate}
      onDismiss={options.onDismissUpdate}
    />
  );

  const errorToastsNode = (
    <ErrorToasts toasts={options.errorToasts} onDismiss={options.onDismissErrorToast} />
  );
  const globalRuntimeNoticeDockNode = showGlobalRuntimeNoticeDock ? (
    <GlobalRuntimeNoticeDock
      notices={globalRuntimeNoticeDock.notices}
      visibility={globalRuntimeNoticeDock.visibility}
      status={globalRuntimeNoticeDock.status}
      onExpand={globalRuntimeNoticeDock.expand}
      onMinimize={globalRuntimeNoticeDock.minimize}
      onClear={globalRuntimeNoticeDock.clear}
    />
  ) : null;
  const homeWorkspaceOptions = getHomeWorkspaceOptions(
    options.groupedWorkspaces,
    options.workspaces,
  );

  const homeNode = (
    <HomeChat
      latestAgentRuns={options.latestAgentRuns}
      isLoadingLatestAgents={options.isLoadingLatestAgents}
      onSelectThread={options.onSelectHomeThread}
      workspaces={homeWorkspaceOptions}
      selectedWorkspaceId={resolveHomeWorkspaceId(
        options.activeWorkspace?.id ?? null,
        homeWorkspaceOptions,
      )}
      onSelectWorkspace={options.onSelectHomeWorkspace}
      onAddWorkspace={options.onAddWorkspace}
      composerNode={homeComposerNode}
      selectedEngine={options.selectedEngine}
      selectedBranchName={options.branchName}
    />
  );

  const mainHeaderNode = options.activeWorkspace ? (
    <MainHeader
      workspace={options.activeWorkspace}
      parentName={options.activeParentWorkspace?.name ?? null}
      worktreeLabel={options.worktreeLabel}
      worktreeRename={options.worktreeRename}
      disableBranchMenu={options.isWorktreeWorkspace}
      parentPath={options.activeParentWorkspace?.path ?? null}
      worktreePath={options.isWorktreeWorkspace ? options.activeWorkspace.path : null}
      openTargets={options.openAppTargets}
      openAppIconById={options.openAppIconById}
      selectedOpenAppId={options.selectedOpenAppId}
      onSelectOpenAppId={options.onSelectOpenAppId}
      branchName={options.branchName}
      branches={options.branches}
      onCheckoutBranch={options.onCheckoutBranch}
      onCreateBranch={options.onCreateBranch}
      sessionTabsNode={sessionTabsNode}
      canCopyThread={options.activeItems.length > 0}
      onCopyThread={options.onCopyThread}
      onLockPanel={options.onLockPanel}
      launchScript={options.launchScript}
      launchScriptEditorOpen={options.launchScriptEditorOpen}
      launchScriptDraft={options.launchScriptDraft}
      launchScriptSaving={options.launchScriptSaving}
      launchScriptError={options.launchScriptError}
      onRunLaunchScript={options.onRunLaunchScript}
      onOpenLaunchScriptEditor={options.onOpenLaunchScriptEditor}
      onCloseLaunchScriptEditor={options.onCloseLaunchScriptEditor}
      onLaunchScriptDraftChange={options.onLaunchScriptDraftChange}
      onSaveLaunchScript={options.onSaveLaunchScript}
      launchScriptsState={options.launchScriptsState}
      showLaunchScriptControls={showTopRunControls}
      showOpenAppMenu={showOpenWorkspaceAppControl}
      extraActionsNode={options.mainHeaderActionsNode}
      groupedWorkspaces={groupedWorkspacesForHeader}
      activeWorkspaceId={options.activeWorkspaceId}
      onSelectWorkspace={options.onSelectWorkspace}
    />
  ) : null;

  const desktopTopbarLeftNode = (
    <>
      {options.centerMode === "diff" && (
        <button
          className="icon-button back-button"
          onClick={options.onExitDiff}
          aria-label={t("files.backToChat")}
        >
          <ArrowLeft aria-hidden />
        </button>
      )}
      {mainHeaderNode}
      {topbarTabContextMenuNode}
    </>
  );

  const tabletNavNode = (
    <TabletNav activeTab={options.tabletNavTab} onSelect={options.onSelectTab} />
  );

  const tabBarNode = (
    <TabBar activeTab={options.activeTab} onSelect={options.onSelectTab} />
  );
  const activeWorkspaceCustomSpecRoot = useMemo(() => {
    if (!options.activeWorkspace?.id) {
      return null;
    }
    const value = getClientStoreSync<string | null>(
      "app",
      `specHub.specRoot.${options.activeWorkspace.id}`,
    );
    return normalizeSpecRootInput(value);
  }, [options.activeWorkspace?.id]);

  const sidebarSelectedDiffPath =
    options.centerMode === "diff" ? options.selectedDiffPath : null;
  const onFilePanelModeChange = options.onFilePanelModeChange;
  const onOpenProjectMap = options.onOpenProjectMap;
  const centerMode = options.centerMode;
  const setCenterMode = options.setCenterMode;
  const editorSplitCompanion = options.editorSplitCompanion;
  const setEditorSplitCompanion = options.setEditorSplitCompanion;
  const isProjectMapSurfaceActive =
    centerMode === "projectMap" ||
    (centerMode === "editor" && editorSplitCompanion === "projectMap");

  const handleRightPanelTabSelect = useCallback(
    (tabId: RightPanelTabSelection) => {
      if (tabId === "projectMap") {
        if (isProjectMapSurfaceActive) {
          if (centerMode === "editor") {
            setEditorSplitCompanion("chat");
            return;
          }
          setCenterMode("chat");
          return;
        }
        if (centerMode === "editor") {
          setEditorSplitCompanion("projectMap");
          if (isEditorFileMaximized) {
            onToggleEditorFileMaximized();
          }
          return;
        }
        onOpenProjectMap();
        return;
      }
      onFilePanelModeChange(tabId);
    },
    [
      isProjectMapSurfaceActive,
      centerMode,
      onFilePanelModeChange,
      onOpenProjectMap,
      isEditorFileMaximized,
      onToggleEditorFileMaximized,
      setCenterMode,
      setEditorSplitCompanion,
    ],
  );

  const rightPanelToolbarNode =
    showRightActivityToolbar && hasVisibleRightToolbarControl ? (
    <div className="right-panel-toolbar">
      <PanelTabs
        active={isProjectMapSurfaceActive ? "projectMap" : options.filePanelMode}
        onSelect={handleRightPanelTabSelect}
        liveStates={{
          activity: workspaceActivity.isProcessing,
          radar: options.sessionRadarRunningSessions.length > 0,
        }}
        visibleTabs={rightToolbarVisibleTabs}
      />
    </div>
  ) : null;

  let gitDiffPanelNode: ReactNode;
  if (options.filePanelMode === "files" && options.activeWorkspace) {
    gitDiffPanelNode = (
      <FileTreePanel
        workspaceId={options.activeWorkspace.id}
        workspaceName={options.activeWorkspace.name}
        workspacePath={options.activeWorkspace.path}
        gitRoot={options.gitRoot}
        files={options.files}
        directories={options.directories}
        directoryMetadata={options.directoryMetadata}
        isLoading={options.fileTreeLoading}
        loadError={options.fileTreeLoadError}
        filePanelMode={options.filePanelMode}
        onFilePanelModeChange={options.onFilePanelModeChange}
        onInsertText={options.onInsertComposerText}
        onOpenFile={options.onOpenFile}
        openTargets={options.openAppTargets}
        openAppIconById={options.openAppIconById}
        selectedOpenAppId={options.selectedOpenAppId}
        onSelectOpenAppId={options.onSelectOpenAppId}
        onToggleRuntimeConsole={options.onToggleRuntimeConsole}
        isRuntimeConsoleVisible={options.runtimeConsoleVisible}
        onOpenSpecHub={options.onOpenSpecHub}
        isSpecHubActive={options.activeTab === "spec"}
        onOpenDetachedExplorer={options.onOpenDetachedFileExplorer}
        gitStatusFiles={options.gitStatus.files}
        gitignoredFiles={options.gitignoredFiles}
        gitignoredDirectories={options.gitignoredDirectories}
        onRefreshFiles={options.onRefreshFiles}
      />
    );
  } else if (options.filePanelMode === "search") {
    gitDiffPanelNode = (
      <WorkspaceSearchPanel
        workspaceId={options.activeWorkspace?.id ?? null}
        filePanelMode={options.filePanelMode}
        onFilePanelModeChange={options.onFilePanelModeChange}
        onOpenFile={options.onOpenFile}
      />
    );
  } else if (options.filePanelMode === "notes") {
    gitDiffPanelNode = (
      <WorkspaceNoteCardPanel
        workspaceId={options.activeWorkspace?.id ?? null}
        workspaceName={options.activeWorkspace?.name ?? null}
        workspacePath={options.activeWorkspace?.path ?? null}
        focusNoteId={options.focusedWorkspaceNoteId ?? null}
        focusRequestKey={options.focusedWorkspaceNoteRequestKey ?? 0}
      />
    );
  } else if (options.filePanelMode === "prompts") {
    gitDiffPanelNode = (
      <PromptPanel
        prompts={options.prompts}
        workspacePath={options.activeWorkspace?.path ?? null}
        filePanelMode={options.filePanelMode}
        onFilePanelModeChange={options.onFilePanelModeChange}
        onSendPrompt={options.onSendPrompt}
        onSendPromptToNewAgent={options.onSendPromptToNewAgent}
        onCreatePrompt={options.onCreatePrompt}
        onUpdatePrompt={options.onUpdatePrompt}
        onDeletePrompt={options.onDeletePrompt}
        onMovePrompt={options.onMovePrompt}
        onRevealWorkspacePrompts={options.onRevealWorkspacePrompts}
        onRevealGeneralPrompts={options.onRevealGeneralPrompts}
        canRevealGeneralPrompts={options.canRevealGeneralPrompts}
      />
    );
  } else if (options.filePanelMode === "memory") {
    gitDiffPanelNode = (
      <ProjectMemoryPanel
        workspaceId={options.activeWorkspace?.id ?? null}
        workspaces={options.workspaces}
        onSelectWorkspace={options.onSelectWorkspace}
        filePanelMode={options.filePanelMode}
        onFilePanelModeChange={options.onFilePanelModeChange}
        focusMemoryId={options.focusedProjectMemoryId ?? null}
        focusRequestKey={options.focusedProjectMemoryRequestKey ?? 0}
      />
    );
  } else if (options.filePanelMode === "activity") {
    gitDiffPanelNode = (
      <WorkspaceSessionActivityPanel
        workspaceId={options.activeWorkspace?.id ?? null}
        workspacePath={options.activeWorkspace?.path ?? null}
        viewModel={workspaceActivity}
        onOpenDiffPath={handleOpenDiffFromActivity}
        onSelectThread={options.onSelectThread}
        liveEditPreviewEnabled={options.liveEditPreviewEnabled}
        onToggleLiveEditPreview={options.onToggleLiveEditPreview}
        onRefreshGitStatus={options.queueGitStatusRefresh}
        {...codeAnnotationBridgeProps}
      />
    );
  } else if (options.filePanelMode === "radar") {
    gitDiffPanelNode = (
      <WorkspaceSessionRadarPanel
        runningSessions={options.sessionRadarRunningSessions}
        recentCompletedSessions={options.sessionRadarRecentCompletedSessions}
        onSelectThread={options.onSelectThread}
      />
    );
  } else {
    gitDiffPanelNode = (
      <Suspense fallback={<HeavyPanelFallback />}>
      <GitDiffPanel
        workspaceId={options.activeWorkspace?.id ?? null}
        workspacePath={options.activeWorkspace?.path ?? null}
        mode={options.gitPanelMode}
        onModeChange={options.onGitPanelModeChange}
        onOpenGitHistoryPanel={options.onOpenGitHistoryPanel}
        isGitHistoryOpen={options.appMode === "gitHistory"}
        diffEntries={options.gitDiffs}
        gitDiffListView={options.gitDiffListView}
        onGitDiffListViewChange={options.onGitDiffListViewChange}
        toggleGitDiffListViewShortcut={options.toggleGitDiffListViewShortcut}
        filePanelMode={options.filePanelMode}
        onFilePanelModeChange={options.onFilePanelModeChange}
        worktreeApplyLabel={options.worktreeApplyLabel}
        worktreeApplyTitle={options.worktreeApplyTitle}
        worktreeApplyLoading={options.worktreeApplyLoading}
        worktreeApplyError={options.worktreeApplyError}
        worktreeApplySuccess={options.worktreeApplySuccess}
        onApplyWorktreeChanges={options.onApplyWorktreeChanges}
        branchName={options.gitStatus.branchName || t("workspace.unknownBranch")}
        totalAdditions={options.gitStatus.totalAdditions}
        totalDeletions={options.gitStatus.totalDeletions}
        fileStatus={options.fileStatus}
        diffViewStyle={options.gitDiffViewStyle}
        onDiffViewStyleChange={options.onGitDiffViewStyleChange}
        error={options.gitStatus.error}
        logError={options.gitLogError}
        logLoading={options.gitLogLoading}
        stagedFiles={canonicalGitPanelChanges.stagedFiles}
        unstagedFiles={canonicalGitPanelChanges.unstagedFiles}
        onSelectFile={options.onSelectDiff}
        onOpenFile={options.onOpenFile}
        selectedPath={sidebarSelectedDiffPath}
        logEntries={options.gitLogEntries}
        logTotal={options.gitLogTotal}
        logAhead={options.gitLogAhead}
        logBehind={options.gitLogBehind}
        logAheadEntries={options.gitLogAheadEntries}
        logBehindEntries={options.gitLogBehindEntries}
        logUpstream={options.gitLogUpstream}
        selectedCommitSha={options.selectedCommitSha}
        onSelectCommit={options.onSelectCommit}
        issues={options.gitIssues}
        issuesTotal={options.gitIssuesTotal}
        issuesLoading={options.gitIssuesLoading}
        issuesError={options.gitIssuesError}
        pullRequests={options.gitPullRequests}
        pullRequestsTotal={options.gitPullRequestsTotal}
        pullRequestsLoading={options.gitPullRequestsLoading}
        pullRequestsError={options.gitPullRequestsError}
        selectedPullRequest={options.selectedPullRequestNumber}
        onSelectPullRequest={options.onSelectPullRequest}
        gitRemoteUrl={options.gitRemoteUrl}
        gitRoot={options.gitRoot}
        gitRootCandidates={options.gitRootCandidates}
        gitRootScanDepth={options.gitRootScanDepth}
        gitRootScanLoading={options.gitRootScanLoading}
        gitRootScanError={options.gitRootScanError}
        gitRootScanHasScanned={options.gitRootScanHasScanned}
        onGitRootScanDepthChange={options.onGitRootScanDepthChange}
        onScanGitRoots={options.onScanGitRoots}
        onSelectGitRoot={options.onSelectGitRoot}
        onClearGitRoot={options.onClearGitRoot}
        onPickGitRoot={options.onPickGitRoot}
        onStageAllChanges={options.onStageGitAll}
        onStageFile={options.onStageGitFile}
        onUnstageFile={options.onUnstageGitFile}
        onRevertFile={options.onRevertGitFile}
        onRevertAllChanges={options.onRevertAllGitChanges}
        commitMessage={options.commitMessage}
        commitMessageLoading={options.commitMessageLoading}
        commitMessageError={options.commitMessageError}
        onCommitMessageChange={options.onCommitMessageChange}
        onGenerateCommitMessage={options.onGenerateCommitMessage}
        onCommit={options.onCommit}
        onCommitAndPush={options.onCommitAndPush}
        onCommitAndSync={options.onCommitAndSync}
        onPush={options.onPush}
        onSync={options.onSync}
        commitLoading={options.commitLoading}
        pushLoading={options.pushLoading}
        syncLoading={options.syncLoading}
        commitError={options.commitError}
        pushError={options.pushError}
        syncError={options.syncError}
        commitsAhead={options.commitsAhead}
        onRefreshGitStatus={options.queueGitStatusRefresh}
        onRefreshGitDiffs={options.refreshGitDiffs}
        onCreateCodeAnnotation={handleCreateCodeAnnotation}
        onRemoveCodeAnnotation={handleRemoveCodeAnnotation}
        codeAnnotations={selectedCodeAnnotations}
      />
      </Suspense>
    );
  }

  const gitDiffViewerNode = (
    <GitDiffViewer
      workspaceId={options.activeWorkspace?.id ?? null}
      diffs={options.gitDiffs}
      listView={options.gitDiffListView}
      selectedPath={options.selectedDiffPath}
      scrollRequestId={options.diffScrollRequestId}
      isLoading={options.gitDiffLoading}
      error={options.gitDiffError}
      diffStyle={options.gitDiffViewStyle}
      onDiffStyleChange={options.onGitDiffViewStyleChange}
      pullRequest={options.selectedPullRequest}
      pullRequestComments={options.selectedPullRequestComments}
      pullRequestCommentsLoading={options.selectedPullRequestCommentsLoading}
      pullRequestCommentsError={options.selectedPullRequestCommentsError}
      onActivePathChange={options.onDiffActivePathChange}
      onOpenFile={options.onOpenFile}
      onRequestClose={options.onExitDiff}
      onCreateCodeAnnotation={handleCreateCodeAnnotation}
      onRemoveCodeAnnotation={handleRemoveCodeAnnotation}
      codeAnnotations={selectedCodeAnnotations}
      codeAnnotationSurface="embedded-diff-view"
    />
  );

  const fileViewPanelNode =
    options.editorFilePath && options.activeWorkspace ? (
      <Suspense fallback={<HeavyPanelFallback />}>
      <FileViewPanel
        workspaceId={options.activeWorkspace.id}
        workspaceName={options.activeWorkspace.name}
        workspacePath={options.activeWorkspace.path}
        gitRoot={options.gitRoot}
        customSpecRoot={activeWorkspaceCustomSpecRoot}
        filePath={options.editorFilePath}
        navigationTarget={options.editorNavigationTarget}
        highlightMarkers={
          options.editorHighlightTarget?.path === options.editorFilePath
            ? options.editorHighlightTarget.markers
            : null
        }
        gitStatusFiles={options.gitStatus.files}
        openTabs={options.openEditorTabs}
        activeTabPath={options.editorFilePath}
        onActivateTab={options.onActivateEditorTab}
        onCloseTab={options.onCloseEditorTab}
        onCloseAllTabs={options.onCloseAllEditorTabs}
        fileReferenceMode={options.fileReferenceMode}
        onFileReferenceModeChange={options.onFileReferenceModeChange}
        activeFileLineRange={options.activeComposerFileLineRange}
        onActiveFileLineRangeChange={options.onActiveEditorLineRangeChange}
        openTargets={options.openAppTargets}
        openAppIconById={options.openAppIconById}
        selectedOpenAppId={options.selectedOpenAppId}
        onSelectOpenAppId={options.onSelectOpenAppId}
        editorSplitLayout={options.editorSplitLayout}
        onToggleEditorSplitLayout={options.onToggleEditorSplitLayout}
        isEditorFileMaximized={options.isEditorFileMaximized}
        onToggleEditorFileMaximized={options.onToggleEditorFileMaximized}
        onNavigateToLocation={options.onOpenFile}
        onClose={options.onExitEditor}
        onInsertText={options.onInsertComposerText}
        onCreateCodeAnnotation={handleCreateCodeAnnotation}
        onRemoveCodeAnnotation={handleRemoveCodeAnnotation}
        codeAnnotations={selectedCodeAnnotations}
          externalChangeMonitoringEnabled={options.externalChangeMonitoringEnabled}
          externalChangeTransportMode={options.externalChangeTransportMode}
          externalChangeApplyMode={options.externalChangeApplyMode}
          externalChangeAutoApplyDebounceMs={options.externalChangeAutoApplyDebounceMs}
          markdownPreviewSnapshotMode={options.liveEditPreviewEnabled ? "live" : "stable"}
          fileRenderPressure={fileRenderPressure}
        saveFileShortcut={options.saveFileShortcut}
        findInFileShortcut={options.findInFileShortcut}
      />
      </Suspense>
    ) : null;

  const projectMapImpactInput = useMemo(
    () => buildGitStatusProjectMapImpactInput(options.gitStatus.files),
    [options.gitStatus.files],
  );
  const orchestrationTaskStore = useOrchestrationTaskStore();
  const taskRunStore = useTaskRunStore();
  const [isOrchestrationCenterOpen, setIsOrchestrationCenterOpen] = useState(false);
  const [selectedOrchestrationTaskId, setSelectedOrchestrationTaskId] = useState<string | null>(null);
  const [projectMapSourceFocusNodeId, setProjectMapSourceFocusNodeId] = useState<string | null>(null);
  const projectMapDataset = options.projectMapDatasetController?.dataset ?? null;
  const orchestrationWorkspaceId =
    options.activeWorkspace?.id ??
    projectMapDataset?.manifest.storageKey ??
    null;
  const persistedOrchestrationTasks = orchestrationTaskStore.tasks;
  const [specWorkspaceSnapshot, setSpecWorkspaceSnapshot] = useState<SpecWorkspaceSnapshot | null>(null);
  useEffect(() => {
    if (!orchestrationWorkspaceId) {
      setSpecWorkspaceSnapshot(null);
      return;
    }
    let cancelled = false;
    buildSpecWorkspaceSnapshot({
      workspaceId: orchestrationWorkspaceId,
      files: options.files,
      directories: options.directories,
      customSpecRoot: activeWorkspaceCustomSpecRoot,
    })
      .then((snapshot) => {
        if (!cancelled) {
          setSpecWorkspaceSnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("[agent-orchestration] Failed to build SpecHub provider snapshot", error);
          setSpecWorkspaceSnapshot(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeWorkspaceCustomSpecRoot,
    orchestrationWorkspaceId,
    options.directories,
    options.files,
  ]);
  const orchestrationProviderSnapshots = useMemo(
    () => {
      if (!orchestrationWorkspaceId) {
        return [];
      }
      const coreSnapshots = collectCoreOrchestrationProviderSnapshots({
        workspaceId: orchestrationWorkspaceId,
        projectMapDataset,
        taskRuns: taskRunStore.runs,
      });
      if (
        !specWorkspaceSnapshot ||
        (specWorkspaceSnapshot.provider === "unknown" && specWorkspaceSnapshot.specRoot?.source !== "custom")
      ) {
        return coreSnapshots;
      }
      return [
        ...coreSnapshots,
        readSpecHubOrchestrationCandidates({
          workspaceId: orchestrationWorkspaceId,
          snapshot: specWorkspaceSnapshot,
        }),
      ];
    },
    [
      orchestrationWorkspaceId,
      projectMapDataset,
      specWorkspaceSnapshot,
      taskRunStore.runs,
    ],
  );
  useEffect(() => {
    if (orchestrationTaskStore.tasks.length === 0 || taskRunStore.runs.length === 0) {
      return;
    }

    const projectedStore = projectLinkedTaskRunsToOrchestrationStore({
      orchestrationStore: orchestrationTaskStore,
      taskRuns: taskRunStore.runs,
    });
    if (projectedStore !== orchestrationTaskStore) {
      saveOrchestrationTaskStore(projectedStore);
    }
  }, [orchestrationTaskStore, taskRunStore.runs]);
  const handleOpenOrchestrationTask = useCallback((taskId: string) => {
    setSelectedOrchestrationTaskId(taskId);
    setIsOrchestrationCenterOpen(true);
  }, []);
  useEffect(() => {
    const handleOpenOrchestrationTaskEvent = (event: Event) => {
      const taskId = readOpenOrchestrationTaskEvent(event);
      if (taskId) {
        handleOpenOrchestrationTask(taskId);
      }
    };

    window.addEventListener(OPEN_ORCHESTRATION_TASK_EVENT, handleOpenOrchestrationTaskEvent);
    return () => {
      window.removeEventListener(OPEN_ORCHESTRATION_TASK_EVENT, handleOpenOrchestrationTaskEvent);
    };
  }, [handleOpenOrchestrationTask]);
  const handleBackToProjectMapFromOrchestration = useCallback(() => {
    setIsOrchestrationCenterOpen(false);
  }, []);
  const handleOpenOrchestrationSourceRef = useCallback(
    (input: { task: OrchestrationTask; sourceRef: OrchestrationSourceRef }) => {
      const { sourceRef } = input;
      if (sourceRef.providerId === "project-map" && sourceRef.kind === "project_map_node") {
        setProjectMapSourceFocusNodeId(sourceRef.id);
        setIsOrchestrationCenterOpen(false);
        return;
      }

      const sourcePath = sourceRef.workspaceRelativePath ?? sourceRef.path;
      if (sourcePath) {
        handleOpenProjectMapEvidenceFile(sourcePath);
      }
    },
    [handleOpenProjectMapEvidenceFile],
  );
  const handleConfirmOrchestrationDispatch = useCallback(
    async (confirmation: OrchestrationDispatchConfirmation) => {
      const result = await options.onDispatchOrchestrationTask?.(confirmation);
      if (result?.taskId) {
        setSelectedOrchestrationTaskId(result.taskId);
      }
    },
    [options],
  );
  const handleCancelOrchestrationRun = useCallback(
    (request: OrchestrationCancelRunRequest) => {
      const now = Date.now();
      const nextTaskRunStore = patchTaskRun(taskRunStore, request.run.runId, {
        status: "canceled",
        currentStep: "canceled_before_runtime_start",
        latestOutputSummary: "Dispatch canceled before runtime start.",
        availableRecoveryActions: ["retry", "fork_new_run"],
        finishedAt: now,
        now,
      });
      const nextOrchestrationTaskStore = patchOrchestrationTask(
        orchestrationTaskStore,
        request.task.taskId,
        {
          status: "planned",
          now: new Date(now).toISOString(),
        },
      );
      saveTaskRunStore(nextTaskRunStore);
      saveOrchestrationTaskStore(nextOrchestrationTaskStore);
      setSelectedOrchestrationTaskId(request.task.taskId);
    },
    [orchestrationTaskStore, taskRunStore],
  );
  const handleOrchestrationReviewAction = useCallback(
    (request: OrchestrationReviewActionRequest) => {
      const result = applyOrchestrationReviewAction(request);
      setSelectedOrchestrationTaskId(result.followUpTask?.taskId ?? result.task.taskId);
    },
    [],
  );
  const handleArchiveOrchestrationTask = useCallback(
    (task: OrchestrationTask) => {
      const nextStore = archiveOrchestrationTask(orchestrationTaskStore, task.taskId);
      saveOrchestrationTaskStore(nextStore);
      setSelectedOrchestrationTaskId(null);
    },
    [orchestrationTaskStore],
  );
  const handleCreateManualOrchestrationTask = useCallback(
    (request: OrchestrationManualTaskDraftRequest) => {
      if (!orchestrationWorkspaceId) {
        return null;
      }
      const task = createManualOrchestrationTaskDraft({
        workspaceId: orchestrationWorkspaceId,
        title: request.title,
        scopeSummary: request.scopeSummary,
        acceptanceSummary: request.acceptanceSummary,
        promptSummary: request.promptSummary || null,
        preferredEngine: request.preferredEngine,
      });
      const nextStore = upsertOrchestrationTask(orchestrationTaskStore, task);
      saveOrchestrationTaskStore(nextStore);
      setSelectedOrchestrationTaskId(task.taskId);
      return task;
    },
    [orchestrationTaskStore, orchestrationWorkspaceId],
  );
  const handleOpenOrchestrationSession = useCallback(
    (_task: OrchestrationTask, sessionId: string) => {
      if (!options.activeWorkspace) {
        return;
      }
      options.onSelectThread(options.activeWorkspace.id, sessionId);
    },
    [options],
  );

  const projectMapPanelNode = isOrchestrationCenterOpen ? (
    <OrchestrationCenterView
      key={`${options.activeWorkspace?.id ?? "no-workspace"}:orchestration`}
      workspaceId={orchestrationWorkspaceId}
      workspaceName={options.activeWorkspace?.name ?? null}
      persistedTasks={persistedOrchestrationTasks}
      providerSnapshots={orchestrationProviderSnapshots}
      selectedTaskId={selectedOrchestrationTaskId}
      onOpenSourceRef={handleOpenOrchestrationSourceRef}
      onConfirmDispatch={handleConfirmOrchestrationDispatch}
      onCreateManualTask={handleCreateManualOrchestrationTask}
      onCancelRun={handleCancelOrchestrationRun}
      onReviewAction={handleOrchestrationReviewAction}
      onArchiveTask={handleArchiveOrchestrationTask}
      onOpenSession={handleOpenOrchestrationSession}
      taskRuns={taskRunStore.runs}
      modelOptions={options.models}
      defaultModelId={options.selectedModelId}
      onBackToProjectMap={handleBackToProjectMapFromOrchestration}
    />
  ) : (
    <ProjectMapPanel
      key={options.activeWorkspace?.id ?? "no-workspace"}
      activeWorkspace={options.activeWorkspace ?? null}
      workspaceName={options.activeWorkspace?.name ?? null}
      selectedEngine={options.selectedEngine ?? null}
      selectedModelId={options.selectedModelId}
      models={options.models}
      datasetController={options.projectMapDatasetController}
      changedFilePaths={projectMapImpactInput.filePaths}
      changedFileSource={projectMapImpactInput.source}
      sourceFocusNodeId={projectMapSourceFocusNodeId}
      onOpenEvidenceFile={handleOpenProjectMapEvidenceFile}
      onOpenOrchestrationTask={handleOpenOrchestrationTask}
    />
  );

  const planPanelNode = shouldMountBottomStatusPanel ? (
    <StatusPanel
      workspaceId={options.activeWorkspace?.id ?? null}
      workspacePath={options.activeWorkspace?.path ?? null}
      items={options.activeItems}
      isProcessing={options.isProcessing}
      expanded
      plan={options.plan}
      isPlanMode={options.isPlanMode}
      isCodexEngine={isStatusPanelCodexEngine}
      activeThreadId={options.activeThreadId}
      activeTurnId={options.activeTurnId ?? null}
      selectedEngine={options.selectedEngine}
      selectedModelId={options.selectedModelId}
      activeTokenUsage={options.activeTokenUsage}
      workspaceGitFiles={options.gitStatus.files}
      workspaceGitStagedFiles={options.gitStatus.stagedFiles}
      workspaceGitUnstagedFiles={options.gitStatus.unstagedFiles}
      workspaceGitTotals={{
        additions: options.gitStatus.totalAdditions,
        deletions: options.gitStatus.totalDeletions,
      }}
      workspaceGitDiffs={options.gitDiffs}
      itemsByThread={deferredThreadItemsByThread}
      threadParentById={options.threadParentById}
      threadStatusById={deferredThreadStatusById}
      onOpenDiffPath={handleOpenDiffPath}
      onOpenFilePath={handleOpenDiffFromActivity}
      onSelectSubagent={options.onSelectSubagent}
      onJumpToConversationMessage={dispatchMessageJumpEvent}
      variant="dock"
      visibleDockTabs={bottomActivityVisibleTabs}
      onRefreshGitStatus={options.queueGitStatusRefresh}
      commitMessage={options.commitMessage}
      commitMessageLoading={options.commitMessageLoading}
      commitMessageError={options.commitMessageError}
      onCommitMessageChange={options.onCommitMessageChange}
      onGenerateCommitMessage={options.onGenerateCommitMessage}
      onCommit={options.onCommit}
      commitLoading={options.commitLoading}
      commitError={options.commitError}
      preferredDockTab={preferredDockStatusTab?.tab ?? null}
      preferredDockTabRequestKey={preferredDockStatusTab?.requestKey ?? 0}
      dockCollapsed={!showBottomStatusPanel}
      onCollapseDock={options.onClosePlanPanel}
      onExpandDock={options.onOpenPlanPanel}
      onExpandToDock={handleExpandCheckpointToDock}
      {...codeAnnotationBridgeProps}
    />
  ) : null;

  const terminalPanelNode = options.terminalState ? (
    <TerminalPanel
      containerRef={options.terminalState.containerRef}
      status={options.terminalState.status}
      message={options.terminalState.message}
    />
  ) : null;

  const terminalDockNode = (
    <TerminalDock
      isOpen={options.terminalOpen}
      terminals={options.terminalTabs}
      activeTerminalId={options.activeTerminalId}
      onToggleOpen={options.onToggleTerminal}
      onSelectTerminal={options.onSelectTerminal}
      onNewTerminal={options.onNewTerminal}
      onCloseTerminal={options.onCloseTerminal}
      onResizeStart={options.onResizeTerminal}
      terminalNode={terminalPanelNode}
    />
  );

  const debugPanelNode = (
    <DebugPanel
      entries={options.debugEntries}
      isOpen={options.debugOpen}
      onClear={options.onClearDebug}
      onCopy={options.onCopyDebug}
      onResizeStart={options.onResizeDebug}
    />
  );

  const debugPanelFullNode = (
    <DebugPanel
      entries={options.debugEntries}
      isOpen
      onClear={options.onClearDebug}
      onCopy={options.onCopyDebug}
      variant="full"
    />
  );

  const compactEmptyCodexNode = (
    <div className="compact-empty">
      <h3>{t("workspace.noWorkspaceSelected")}</h3>
      <p>{t("workspace.chooseProjectToChat")}</p>
      <button className="ghost" onClick={options.onGoProjects}>
        {t("workspace.goToProjects")}
      </button>
    </div>
  );

  const compactEmptyGitNode = (
    <div className="compact-empty">
      <h3>{t("workspace.noWorkspaceSelected")}</h3>
      <p>{t("workspace.selectProjectToInspect")}</p>
      <button className="ghost" onClick={options.onGoProjects}>
        {t("workspace.goToProjects")}
      </button>
    </div>
  );

  const compactEmptySpecNode = (
    <div className="compact-empty">
      <h3>{t("workspace.noWorkspaceSelected")}</h3>
      <p>{t("workspace.selectProjectToReadSpecs")}</p>
      <button className="ghost" onClick={options.onGoProjects}>
        {t("workspace.goToProjects")}
      </button>
    </div>
  );

  const compactGitBackNode = (
    <div className="compact-git-back">
      <button onClick={options.onBackFromDiff}>&#8249; {t("workspace.back")}</button>
      <span className="workspace-title">{t("workspace.diff")}</span>
    </div>
  );
  const browserDockNode = null;

  return {
    codeAnnotationBridgeProps,
    sidebarNode,
    messagesNode,
    composerNode,
    approvalToastsNode,
    updateToastNode,
    errorToastsNode,
    globalRuntimeNoticeDockNode,
    homeNode,
    mainHeaderNode,
    desktopTopbarLeftNode,
    tabletNavNode,
    tabBarNode,
    rightPanelToolbarNode,
    gitDiffPanelNode,
    gitDiffViewerNode,
    fileViewPanelNode,
    projectMapPanelNode,
    browserDockNode,
    planPanelNode,
    debugPanelNode,
    debugPanelFullNode,
    terminalDockNode,
    compactEmptyCodexNode,
    compactEmptySpecNode,
    compactEmptyGitNode,
    compactGitBackNode,
  };
}
