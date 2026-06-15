// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { ConversationItem, WorkspaceInfo } from "../../../types";
import { useLayoutNodes } from "./useLayoutNodes";
import type {
  LayoutNodesFlatOptions,
  LayoutNodesOptions,
} from "./layoutNodesTypes";
import { getCodexProviders } from "../../../services/tauri";

const clientUiVisibilityMock = vi.hoisted(() => ({
  visiblePanels: new Set<string>(),
  visibleControls: new Set<string>(),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../client-ui-visibility/hooks/useClientUiVisibility", () => ({
  useClientUiVisibility: () => ({
    preference: {
      panels: {
        topSessionTabs:
          clientUiVisibilityMock.visiblePanels.has("topSessionTabs"),
        topRunControls:
          clientUiVisibilityMock.visiblePanels.has("topRunControls"),
        topToolControls:
          clientUiVisibilityMock.visiblePanels.has("topToolControls"),
        rightActivityToolbar: clientUiVisibilityMock.visiblePanels.has(
          "rightActivityToolbar",
        ),
        bottomActivityPanel: clientUiVisibilityMock.visiblePanels.has(
          "bottomActivityPanel",
        ),
        cornerStatusIndicator: clientUiVisibilityMock.visiblePanels.has(
          "cornerStatusIndicator",
        ),
        globalRuntimeNoticeDock: clientUiVisibilityMock.visiblePanels.has(
          "globalRuntimeNoticeDock",
        ),
      },
      controls: {
        "topRun.start":
          clientUiVisibilityMock.visibleControls.has("topRun.start"),
        "topTool.openWorkspace": clientUiVisibilityMock.visibleControls.has(
          "topTool.openWorkspace",
        ),
        "topTool.runtimeConsole": clientUiVisibilityMock.visibleControls.has(
          "topTool.runtimeConsole",
        ),
        "topTool.terminal":
          clientUiVisibilityMock.visibleControls.has("topTool.terminal"),
        "topTool.focus":
          clientUiVisibilityMock.visibleControls.has("topTool.focus"),
        "topTool.rightPanel":
          clientUiVisibilityMock.visibleControls.has("topTool.rightPanel"),
        "topTool.clientDocumentation":
          clientUiVisibilityMock.visibleControls.has(
            "topTool.clientDocumentation",
          ),
        "rightToolbar.activity": clientUiVisibilityMock.visibleControls.has(
          "rightToolbar.activity",
        ),
        "rightToolbar.projectMap": clientUiVisibilityMock.visibleControls.has(
          "rightToolbar.projectMap",
        ),
        "rightToolbar.radar":
          clientUiVisibilityMock.visibleControls.has("rightToolbar.radar"),
        "rightToolbar.git":
          clientUiVisibilityMock.visibleControls.has("rightToolbar.git"),
        "rightToolbar.files":
          clientUiVisibilityMock.visibleControls.has("rightToolbar.files"),
        "rightToolbar.search": clientUiVisibilityMock.visibleControls.has(
          "rightToolbar.search",
        ),
        "bottomActivity.tasks": clientUiVisibilityMock.visibleControls.has(
          "bottomActivity.tasks",
        ),
        "bottomActivity.agents": clientUiVisibilityMock.visibleControls.has(
          "bottomActivity.agents",
        ),
        "bottomActivity.checkpoint": clientUiVisibilityMock.visibleControls.has(
          "bottomActivity.checkpoint",
        ),
        "bottomActivity.latestConversation":
          clientUiVisibilityMock.visibleControls.has(
            "bottomActivity.latestConversation",
          ),
        "curtain.stickyUserBubble": clientUiVisibilityMock.visibleControls.has(
          "curtain.stickyUserBubble",
        ),
        "cornerStatus.messageAnchors":
          clientUiVisibilityMock.visibleControls.has(
            "cornerStatus.messageAnchors",
          ),
      },
    },
    isPanelVisible: (id: string) =>
      clientUiVisibilityMock.visiblePanels.has(id),
    isControlVisible: (id: string) =>
      clientUiVisibilityMock.visibleControls.has(id),
    isControlPreferenceVisible: (id: string) =>
      clientUiVisibilityMock.visibleControls.has(id),
    setPanelVisible: vi.fn(),
    setControlVisible: vi.fn(),
    resetVisibility: vi.fn(),
  }),
}));

vi.mock("../../../services/tauri", () => ({
  getCodexProviders: vi.fn(async () => []),
}));

vi.mock("../../app/components/Sidebar", () => ({
  Sidebar: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <aside data-testid="sidebar">
      <button type="button" onClick={onOpenSettings}>
        settings
      </button>
    </aside>
  ),
}));

vi.mock("../../messages/components/Messages", () => ({
  Messages: ({
    showMessageAnchors,
    showStickyUserBubble,
    conversationState,
    activeEngine,
    onForkFromMessage,
  }: {
    showMessageAnchors: boolean;
    showStickyUserBubble: boolean;
    activeEngine?: string;
    onForkFromMessage?: (messageId: string) => void;
    conversationState?: {
      meta?: {
        engine?: string;
        historyRestoredAtMs?: number | null;
      };
    } | null;
  }) => (
    <section
      data-testid="messages"
      data-message-anchors={String(showMessageAnchors)}
      data-sticky-user-bubble={String(showStickyUserBubble)}
      data-active-engine={String(activeEngine ?? "")}
      data-conversation-engine={String(conversationState?.meta?.engine ?? "")}
      data-history-restored-at={String(
        conversationState?.meta?.historyRestoredAtMs ?? "",
      )}
    >
      {onForkFromMessage ? (
        <button
          type="button"
          onClick={() => onForkFromMessage("user-fork-anchor")}
        >
          open fork confirm
        </button>
      ) : null}
    </section>
  ),
}));

vi.mock("../../composer/components/Composer", () => ({
  Composer: ({
    draftText,
    onDraftChange,
    onSend,
    sendLabel,
    onOpenDiffPath,
    showStatusPanelToggleOverride,
  }: {
    draftText: string;
    onDraftChange: (next: string) => void;
    onSend: (text: string, images: string[]) => void;
    sendLabel: string;
    onOpenDiffPath?: (path: string) => void;
    showStatusPanelToggleOverride?: boolean;
  }) => (
    <form
      data-testid="composer"
      data-show-status-panel-toggle-override={String(
        showStatusPanelToggleOverride,
      )}
    >
      <textarea
        aria-label="composer input"
        value={draftText}
        onChange={(event) => onDraftChange(event.currentTarget.value)}
      />
      <button type="button" onClick={() => onSend(draftText, [])}>
        {sendLabel}
      </button>
      {onOpenDiffPath ? (
        <button type="button" onClick={() => onOpenDiffPath("src/App.tsx")}>
          open file reference
        </button>
      ) : null}
    </form>
  ),
}));

vi.mock("../../app/components/MainHeader", () => ({
  MainHeader: ({
    sessionTabsNode,
    extraActionsNode,
  }: {
    sessionTabsNode?: ReactNode;
    extraActionsNode?: ReactNode;
  }) => (
    <header data-testid="main-header">
      {sessionTabsNode}
      {extraActionsNode}
    </header>
  ),
}));

vi.mock("../../app/components/TopbarSessionTabs", () => ({
  TopbarSessionTabs: () => <div data-testid="topbar-session-tabs" />,
}));

vi.mock("../../home/components/HomeChat", () => ({
  HomeChat: ({ composerNode }: { composerNode?: ReactNode }) => (
    <section data-testid="home-chat">{composerNode}</section>
  ),
}));

vi.mock("../../update/components/UpdateToast", () => ({
  UpdateToast: () => <div data-testid="update-toast" />,
}));

vi.mock("../../notifications/components/ErrorToasts", () => ({
  ErrorToasts: () => <div data-testid="error-toasts" />,
}));

vi.mock("../../notifications/components/GlobalRuntimeNoticeDock", () => ({
  GlobalRuntimeNoticeDock: () => <div data-testid="runtime-notice-dock" />,
}));

vi.mock("../../git/components/GitDiffPanel", () => ({
  GitDiffPanel: () => <div data-testid="git-diff-panel" />,
}));

vi.mock("../../git/components/GitDiffViewer", () => ({
  GitDiffViewer: () => <div data-testid="git-diff-viewer" />,
}));

vi.mock("../../files/components/FileTreePanel", () => ({
  FileTreePanel: () => <div data-testid="file-tree-panel" />,
}));

vi.mock("../../search/components/WorkspaceSearchPanel", () => ({
  WorkspaceSearchPanel: () => <div data-testid="workspace-search-panel" />,
}));

vi.mock("../../files/components/FileViewPanel", () => ({
  FileViewPanel: () => <div data-testid="file-view-panel" />,
}));

vi.mock("../../prompts/components/PromptPanel", () => ({
  PromptPanel: () => <div data-testid="prompt-panel" />,
}));

vi.mock("../../project-memory/components/ProjectMemoryPanel", () => ({
  ProjectMemoryPanel: () => <div data-testid="project-memory-panel" />,
}));

vi.mock(
  "../../session-activity/components/WorkspaceSessionActivityPanel",
  () => ({
    WorkspaceSessionActivityPanel: () => (
      <div data-testid="workspace-session-activity-panel" />
    ),
  }),
);

vi.mock("../../session-activity/components/WorkspaceSessionRadarPanel", () => ({
  WorkspaceSessionRadarPanel: () => (
    <div data-testid="workspace-session-radar-panel" />
  ),
}));

vi.mock("../../debug/components/DebugPanel", () => ({
  DebugPanel: () => <div data-testid="debug-panel" />,
}));

vi.mock("../components/PanelTabs", () => ({
  PanelTabs: ({
    active,
    onSelect,
    visibleTabs,
  }: {
    active: string;
    onSelect: (id: string) => void;
    visibleTabs?: Partial<Record<string, boolean>>;
  }) => (
    <div data-testid="panel-tabs" data-active={active}>
      {visibleTabs?.projectMap !== false ? (
        <button type="button" onClick={() => onSelect("projectMap")}>
          projectMap
        </button>
      ) : null}
      {visibleTabs?.files !== false ? (
        <button type="button" onClick={() => onSelect("files")}>
          files
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../../app/components/TabBar", () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}));

vi.mock("../../app/components/TabletNav", () => ({
  TabletNav: () => <div data-testid="tablet-nav" />,
}));

vi.mock("../../terminal/components/TerminalDock", () => ({
  TerminalDock: () => <div data-testid="terminal-dock" />,
}));

vi.mock("../../terminal/components/TerminalPanel", () => ({
  TerminalPanel: () => <div data-testid="terminal-panel" />,
}));

vi.mock("../../status-panel/components/StatusPanel", () => ({
  StatusPanel: ({
    dockCollapsed,
    selectedEngine,
  }: {
    dockCollapsed?: boolean;
    selectedEngine?: string;
  }) => (
    <div
      data-testid="status-panel"
      data-dock-collapsed={String(dockCollapsed)}
      data-selected-engine={String(selectedEngine ?? "")}
    />
  ),
}));

vi.mock("../../status-panel/hooks/useStatusPanelData", () => ({
  useStatusPanelData: () => ({
    todoTotal: 0,
    subagentTotal: 0,
    fileChanges: [],
    commandTotal: 0,
  }),
}));

vi.mock("../../session-activity/hooks/useWorkspaceSessionActivity", () => ({
  useWorkspaceSessionActivity: () => ({ isProcessing: false }),
}));

vi.mock("../../notifications/hooks/useGlobalRuntimeNoticeDock", () => ({
  useGlobalRuntimeNoticeDock: () => ({
    notices: [],
    visibility: "hidden",
    status: "idle",
    expand: vi.fn(),
    minimize: vi.fn(),
    clear: vi.fn(),
  }),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: {},
} as WorkspaceInfo;

const activeItems: ConversationItem[] = [
  {
    id: "message-1",
    kind: "message",
    role: "user",
    text: "hello",
  },
];

const noop = vi.fn();
const asyncNoop = vi.fn(async () => undefined);
const asyncNull = vi.fn(async () => null);

function createGroupedLayoutNodesOptionsForTest(
  flatOptions: LayoutNodesFlatOptions,
): LayoutNodesOptions {
  return {
    workspace: flatOptions,
    runtime: flatOptions,
    chrome: flatOptions,
    editor: flatOptions,
    git: flatOptions,
    composer: flatOptions,
    panels: flatOptions,
  };
}

function createLayoutOptions(
  overrides: Partial<LayoutNodesFlatOptions> = {},
): Parameters<typeof useLayoutNodes>[0] {
  const baseOptions = {
    workspaces: [workspace],
    groupedWorkspaces: [
      { id: null, name: "Ungrouped", workspaces: [workspace] },
    ],
    hasWorkspaceGroups: false,
    deletingWorktreeIds: new Set(),
    threadsByWorkspace: {
      [workspace.id]: [{ id: "thread-1", name: "Thread", updatedAt: 1 }],
    },
    threadParentById: {},
    threadStatusById: {},
    historyLoadingByThreadId: {},
    historyRestoredAtMsByThread: {},
    runningSessionCountByWorkspaceId: {},
    recentCompletedSessionCountByWorkspaceId: {},
    hydratedThreadListWorkspaceIds: new Set(),
    threadListLoadingByWorkspace: {},
    threadListPagingByWorkspace: {},
    threadListCursorByWorkspace: {},
    activeWorkspaceId: workspace.id,
    activeThreadId: "thread-1",
    activeItems,
    activeQueuedHandoffBubble: null,
    threadItemsByThread: {},
    sessionRadarRunningSessions: [],
    sessionRadarRecentCompletedSessions: [],
    activeRateLimits: null,
    usageShowRemaining: false,
    showSidebarProviderLabels: false,
    showMessageAnchors: true,
    accountInfo: null,
    onSwitchAccount: noop,
    onCancelSwitchAccount: noop,
    accountSwitching: false,
    codeBlockCopyUseModifier: false,
    openAppTargets: [],
    openAppIconById: {},
    selectedOpenAppId: "",
    onSelectOpenAppId: noop,
    approvals: [],
    userInputRequests: [],
    handleApprovalDecision: noop,
    handleApprovalBatchAccept: noop,
    handleApprovalRemember: noop,
    handleUserInputDismiss: noop,
    handleUserInputSubmit: asyncNoop,
    onOpenSettings: noop,
    onOpenExperimentalSettings: noop,
    onOpenDebug: noop,
    showDebugButton: false,
    onAddWorkspace: noop,
    onSelectHome: noop,
    onSelectWorkspace: noop,
    onConnectWorkspace: asyncNoop,
    onAddAgent: asyncNull,
    onAddSharedAgent: asyncNull,
    onAddWorktreeAgent: asyncNoop,
    onAddCloneAgent: asyncNoop,
    onToggleWorkspaceCollapse: noop,
    onSelectThread: noop,
    onDeleteThread: noop,
    onArchiveThread: noop,
    onSyncThread: noop,
    pinThread: () => true,
    unpinThread: noop,
    isThreadPinned: () => false,
    isThreadAutoNaming: () => false,
    getPinTimestamp: () => null,
    pinnedThreadsVersion: 0,
    onRenameThread: noop,
    onAutoNameThread: noop,
    onDeleteWorkspace: noop,
    onDeleteWorktree: noop,
    onLoadOlderThreads: noop,
    onReloadWorkspaceThreads: noop,
    workspaceDropTargetRef: { current: null },
    isWorkspaceDropActive: false,
    workspaceDropText: "",
    onWorkspaceDragOver: noop,
    onWorkspaceDragEnter: noop,
    onWorkspaceDragLeave: noop,
    onWorkspaceDrop: noop,
    appMode: "chat",
    isPhone: false,
    isTablet: false,
    onAppModeChange: noop,
    onOpenHomeChat: noop,
    onOpenMemory: noop,
    onOpenProjectMemory: noop,
    onOpenReleaseNotes: noop,
    onOpenGlobalSearch: noop,
    globalSearchShortcut: null,
    openChatShortcut: null,
    openKanbanShortcut: null,
    cycleOpenSessionPrevShortcut: null,
    cycleOpenSessionNextShortcut: null,
    saveFileShortcut: null,
    findInFileShortcut: null,
    toggleGitDiffListViewShortcut: null,
    onOpenSpecHub: noop,
    onOpenWorkspaceHome: noop,
    updaterState: { stage: "idle" },
    onUpdate: noop,
    onDismissUpdate: noop,
    errorToasts: [],
    onDismissErrorToast: noop,
    latestAgentRuns: [],
    isLoadingLatestAgents: false,
    onSelectHomeThread: noop,
    onSelectHomeWorkspace: noop,
    activeWorkspace: workspace,
    activeParentWorkspace: null,
    worktreeLabel: null,
    isWorktreeWorkspace: false,
    branchName: "main",
    branches: [],
    onCheckoutBranch: asyncNoop,
    onCreateBranch: asyncNoop,
    onCopyThread: noop,
    onToggleTerminal: noop,
    showTerminalButton: true,
    launchScript: null,
    launchScriptEditorOpen: false,
    launchScriptDraft: "",
    launchScriptSaving: false,
    launchScriptError: null,
    onRunLaunchScript: noop,
    onOpenLaunchScriptEditor: noop,
    onCloseLaunchScriptEditor: noop,
    onLaunchScriptDraftChange: noop,
    onSaveLaunchScript: noop,
    centerMode: "chat",
    setCenterMode: noop,
    editorSplitCompanion: "chat",
    setEditorSplitCompanion: noop,
    editorSplitLayout: "vertical",
    onToggleEditorSplitLayout: noop,
    isEditorFileMaximized: false,
    onToggleEditorFileMaximized: noop,
    editorFilePath: null,
    editorNavigationTarget: null,
    editorHighlightTarget: null,
    openEditorTabs: [],
    onActivateEditorTab: noop,
    onCloseEditorTab: noop,
    onCloseAllEditorTabs: noop,
    onActiveEditorLineRangeChange: noop,
    onOpenFile: noop,
    onExitEditor: noop,
    onExitDiff: noop,
    activeTab: "codex",
    onSelectTab: noop,
    tabletNavTab: "codex",
    gitPanelMode: "diff",
    onGitPanelModeChange: noop,
    onOpenGitHistoryPanel: noop,
    onOpenProjectMap: noop,
    gitDiffViewStyle: "split",
    gitDiffListView: "flat",
    onGitDiffListViewChange: noop,
    worktreeApplyLabel: "Apply",
    worktreeApplyTitle: null,
    worktreeApplyLoading: false,
    worktreeApplyError: null,
    worktreeApplySuccess: false,
    filePanelMode: "files",
    onFilePanelModeChange: noop,
    fileTreeLoading: false,
    fileTreeLoadError: null,
    onToggleRuntimeConsole: noop,
    runtimeConsoleVisible: false,
    gitStatus: {
      branchName: "main",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
      error: null,
    },
    fileStatus: "",
    selectedDiffPath: null,
    diffScrollRequestId: 0,
    onSelectDiff: noop,
    gitLogEntries: [],
    gitLogTotal: 0,
    gitLogAhead: 0,
    gitLogBehind: 0,
    gitLogAheadEntries: [],
    gitLogBehindEntries: [],
    gitLogUpstream: null,
    selectedCommitSha: null,
    onSelectCommit: noop,
    gitLogError: null,
    gitLogLoading: false,
    gitIssues: [],
    gitIssuesTotal: 0,
    gitIssuesLoading: false,
    gitIssuesError: null,
    gitPullRequests: [],
    gitPullRequestsTotal: 0,
    gitPullRequestsLoading: false,
    gitPullRequestsError: null,
    selectedPullRequestNumber: null,
    selectedPullRequest: null,
    selectedPullRequestComments: [],
    selectedPullRequestCommentsLoading: false,
    selectedPullRequestCommentsError: null,
    onSelectPullRequest: noop,
    gitRemoteUrl: null,
    gitRoot: null,
    gitRootCandidates: [],
    gitRootScanDepth: 3,
    gitRootScanLoading: false,
    gitRootScanError: null,
    gitRootScanHasScanned: false,
    onGitRootScanDepthChange: noop,
    onScanGitRoots: noop,
    onSelectGitRoot: noop,
    onClearGitRoot: noop,
    onPickGitRoot: noop,
    onStageGitAll: asyncNoop,
    onStageGitFile: asyncNoop,
    onUnstageGitFile: asyncNoop,
    onRevertGitFile: asyncNoop,
    onRevertAllGitChanges: asyncNoop,
    gitDiffs: [],
    gitDiffLoading: false,
    gitDiffError: null,
    onGitDiffViewStyleChange: noop,
    commitMessage: "",
    commitMessageLoading: false,
    commitMessageError: null,
    onCommitMessageChange: noop,
    onGenerateCommitMessage: noop,
    onSendPrompt: noop,
    onSendPromptToNewAgent: noop,
    onCreatePrompt: noop,
    onUpdatePrompt: noop,
    onDeletePrompt: noop,
    onMovePrompt: noop,
    onRevealWorkspacePrompts: noop,
    onRevealGeneralPrompts: noop,
    canRevealGeneralPrompts: false,
    onSend: noop,
    onQueue: noop,
    onStop: noop,
    canStop: false,
    isReviewing: false,
    isProcessing: false,
    steerEnabled: false,
    reviewPrompt: null,
    onReviewPromptClose: noop,
    onReviewPromptShowPreset: noop,
    onReviewPromptChoosePreset: noop,
    highlightedPresetIndex: -1,
    onReviewPromptHighlightPreset: noop,
    highlightedBranchIndex: -1,
    onReviewPromptHighlightBranch: noop,
    highlightedCommitIndex: -1,
    onReviewPromptHighlightCommit: noop,
    onReviewPromptKeyDown: () => false,
    onReviewPromptSelectBranch: noop,
    onReviewPromptSelectBranchAtIndex: noop,
    onReviewPromptConfirmBranch: asyncNoop,
    onReviewPromptSelectCommit: noop,
    onReviewPromptSelectCommitAtIndex: noop,
    onReviewPromptConfirmCommit: asyncNoop,
    onReviewPromptUpdateCustomInstructions: noop,
    onReviewPromptConfirmCustom: asyncNoop,
    activeTokenUsage: null,
    activeQueue: [],
    draftText: "hello from maximum hidden mode",
    onDraftChange: noop,
    activeImages: [],
    onPickImages: noop,
    onAttachImages: noop,
    onRemoveImage: noop,
    prefillDraft: null,
    onPrefillHandled: noop,
    insertText: null,
    onInsertHandled: noop,
    onEditQueued: noop,
    onDeleteQueued: noop,
    onFuseQueued: noop,
    canFuseActiveQueue: false,
    activeFusingMessageId: null,
    collaborationModes: [],
    collaborationModesEnabled: false,
    selectedCollaborationModeId: null,
    onSelectCollaborationMode: noop,
    selectedEngine: "codex",
    models: [],
    selectedModelId: null,
    onSelectModel: noop,
    reasoningOptions: [],
    selectedEffort: null,
    onSelectEffort: noop,
    reasoningSupported: false,
    opencodeAgents: [],
    selectedOpenCodeAgent: null,
    onSelectOpenCodeAgent: noop,
    selectedAgent: null,
    onSelectAgent: noop,
    onOpenAgentSettings: noop,
    onOpenPromptSettings: noop,
    onOpenModelSettings: noop,
    opencodeVariantOptions: [],
    selectedOpenCodeVariant: null,
    onSelectOpenCodeVariant: noop,
    accessMode: "default",
    onSelectAccessMode: noop,
    skills: [],
    prompts: [],
    commands: [],
    files: [],
    directories: [],
    gitignoredFiles: new Set(),
    gitignoredDirectories: new Set(),
    onInsertComposerText: noop,
    textareaRef: { current: null },
    composerEditorSettings: {
      preset: "default",
      expandFenceOnSpace: false,
      expandFenceOnEnter: false,
      fenceLanguageTags: false,
      fenceWrapSelection: false,
      autoWrapPasteMultiline: false,
      autoWrapPasteCodeLike: false,
      continueListOnShiftEnter: false,
    },
    composerSendShortcut: "enter",
    textareaHeight: 120,
    onTextareaHeightChange: noop,
    dictationEnabled: false,
    dictationState: "idle",
    dictationLevel: 0,
    onToggleDictation: noop,
    dictationTranscript: null,
    onDictationTranscriptHandled: noop,
    dictationError: null,
    onDismissDictationError: noop,
    dictationHint: null,
    onDismissDictationHint: noop,
    showComposer: true,
    composerLinkedKanbanPanels: [],
    selectedComposerKanbanPanelId: null,
    composerKanbanContextMode: "new",
    onSelectComposerKanbanPanel: noop,
    onComposerKanbanContextModeChange: noop,
    onOpenComposerKanbanPanel: noop,
    activeComposerFilePath: null,
    activeComposerFileLineRange: null,
    fileReferenceMode: "none",
    onFileReferenceModeChange: noop,
    plan: null,
    isPlanMode: false,
    onOpenPlanPanel: noop,
    onClosePlanPanel: noop,
    bottomStatusPanelExpanded: true,
    debugEntries: [],
    debugOpen: false,
    terminalOpen: false,
    terminalTabs: [],
    activeTerminalId: null,
    onSelectTerminal: noop,
    onNewTerminal: noop,
    onCloseTerminal: noop,
    terminalState: null,
    onClearDebug: noop,
    onCopyDebug: noop,
    onResizeDebug: noop,
    onResizeTerminal: noop,
    onBackFromDiff: noop,
    onGoProjects: noop,
    activeTurnId: null,
    systemProxyEnabled: false,
    systemProxyUrl: "",
    onRefreshAccountRateLimits: asyncNoop,
    onRecoverThreadRuntime: asyncNoop,
    onRecoverThreadRuntimeAndResend: asyncNoop,
    onThreadRecoveryFork: asyncNoop,
    handleExitPlanModeExecute: noop,
    onOpenDictationSettings: noop,
    engineOptions: [],
    enabledEngines: {},
    onRefreshEngineOptions: asyncNoop,
    deleteConfirmThreadId: null,
    deleteConfirmWorkspaceId: null,
    deleteConfirmBusy: false,
    onCancelDeleteConfirm: noop,
    onConfirmDeleteConfirm: noop,
    onOpenClaudeTui: noop,
    onRenameWorkspaceAlias: noop,
    onQuickReloadWorkspaceThreads: noop,
    onOpenContextLedgerMemory: noop,
    onOpenContextLedgerNote: noop,
    showLoadingProgressDialog: noop,
    hideLoadingProgressDialog: noop,
    closeCurrentSessionShortcut: null,
    worktreeRename: undefined,
    onLockPanel: noop,
    launchScriptsState: {
      launchScripts: [],
      editorOpenId: null,
      draftScript: "",
      draftIcon: "play",
      draftLabel: "",
      newEditorOpen: false,
      newDraftScript: "",
      newDraftIcon: "play",
      newDraftLabel: "",
      newError: null,
      isSaving: false,
      error: null,
      errorById: {},
      onRunScript: noop,
      onOpenEditor: noop,
      onCloseEditor: noop,
      onDraftScriptChange: noop,
      onDraftIconChange: noop,
      onDraftLabelChange: noop,
      onSaveScript: asyncNoop,
      onDeleteScript: asyncNoop,
      onOpenNew: noop,
      onCloseNew: noop,
      onNewDraftScriptChange: noop,
      onNewDraftIconChange: noop,
      onNewDraftLabelChange: noop,
      onCreateNew: asyncNoop,
    },
    mainHeaderActionsNode: null,
    browserDockOpen: false,
    onCloseBrowserDock: noop,
    externalChangeMonitoringEnabled: false,
    externalChangeTransportMode: "watcher",
    externalChangeApplyMode: "manual",
    externalChangeAutoApplyDebounceMs: 300,
    liveEditPreviewEnabled: false,
    onToggleLiveEditPreview: noop,
    intentCanvasOpenRequest: null,
    onOpenIntentCanvas: noop,
    onIntentCanvasOpenRequestConsumed: noop,
    onAttachIntentCanvasToThread: asyncNoop,
    pendingIntentCanvasDocuments: [],
    onRemovePendingIntentCanvas: noop,
    onApplyWorktreeChanges: asyncNoop,
    focusedProjectMemoryId: null,
    focusedProjectMemoryRequestKey: 0,
    focusedWorkspaceNoteId: null,
    focusedWorkspaceNoteRequestKey: 0,
    onRefreshFiles: noop,
    onOpenDetachedFileExplorer: noop,
    refreshGitDiffs: asyncNoop,
    queueGitStatusRefresh: noop,
    onDiffActivePathChange: noop,
    onCommit: asyncNoop,
    onCommitAndPush: asyncNoop,
    onCommitAndSync: asyncNoop,
    onPush: asyncNoop,
    onSync: asyncNoop,
    commitLoading: false,
    pushLoading: false,
    syncLoading: false,
    commitError: null,
    pushError: null,
    syncError: null,
    commitsAhead: 0,
    onRequestContextCompaction: noop,
    completionEmailSelected: false,
    completionEmailDisabled: false,
    onToggleCompletionEmail: noop,
    onRewind: noop,
    onForkFromMessage: asyncNoop,
    contextDualViewEnabled: false,
    codexAutoCompactionEnabled: false,
    codexAutoCompactionThresholdPercent: 80,
    onCodexAutoCompactionSettingsChange: noop,
    engines: [],
    usePresentationProfile: false,
    onSelectEngine: noop,
    projectMapDatasetController: undefined,
    onDispatchOrchestrationTask: async () => ({ ok: false }),
    claudeThinkingVisible: false,
    onResolvedClaudeThinkingVisibleChange: noop,
    onRefreshModelConfig: asyncNoop,
    isModelConfigRefreshing: false,
    customSkillDirectories: [],
    directoryMetadata: [],
    fileTreeSourceVersion: null,
    composerSendLabel: "messages.send",
    activeCodeSelectionAnchor: null,
    onActiveCodeSelectionAnchorChange: noop,
    agentTaskScrollRequest: null,
    onSelectSubagent: noop,
  } satisfies LayoutNodesFlatOptions;
  const flatOptions = Object.assign(baseOptions, overrides);

  return createGroupedLayoutNodesOptionsForTest(flatOptions);
}

function LayoutNodesHarness({
  options,
}: {
  options: Parameters<typeof useLayoutNodes>[0];
}) {
  const nodes = useLayoutNodes(options);
  return <>{nodes.messagesNode}</>;
}

async function renderUseLayoutNodes(
  options: Parameters<typeof useLayoutNodes>[0],
) {
  const renderedHook = renderHook(() => useLayoutNodes(options));
  await act(async () => {
    await Promise.resolve();
  });
  return renderedHook;
}

describe("useLayoutNodes client UI visibility", () => {
  afterEach(() => {
    clientUiVisibilityMock.visiblePanels.clear();
    clientUiVisibilityMock.visibleControls.clear();
    vi.clearAllMocks();
  });

  it("keeps conversation, composer, send, and settings recovery available when every optional entry is hidden", async () => {
    const onOpenSettings = vi.fn();
    const onSend = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({ onOpenSettings, onSend }),
    );

    expect(result.current.rightPanelToolbarNode).toBeNull();
    expect(result.current.planPanelNode).toBeNull();
    expect(result.current.globalRuntimeNoticeDockNode).toBeNull();

    render(
      <>
        {result.current.sidebarNode}
        {result.current.messagesNode}
        {result.current.composerNode}
        {result.current.globalRuntimeNoticeDockNode}
      </>,
    );

    expect(screen.queryByTestId("runtime-notice-dock")).toBeNull();
    expect(screen.getByTestId("messages")).toBeTruthy();
    expect(screen.getByTestId("messages").dataset.messageAnchors).toBe("false");
    expect(screen.getByTestId("messages").dataset.stickyUserBubble).toBe(
      "false",
    );
    expect(
      screen.getByRole("textbox", { name: "composer input" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "messages.send" }));
    expect(onSend).toHaveBeenCalledWith("hello from maximum hidden mode", []);

    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("forwards restored history metadata into the runtime conversation state", async () => {
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        historyRestoredAtMsByThread: {
          "thread-1": 1234,
        },
      }),
    );

    render(<>{result.current.messagesNode}</>);

    expect(screen.getByTestId("messages").dataset.historyRestoredAt).toBe(
      "1234",
    );
  });

  it("confirms message-tail fork before running the fork callback", async () => {
    const onForkFromMessage = vi.fn(async () => {});

    render(
      <LayoutNodesHarness
        options={createLayoutOptions({ onForkFromMessage })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "open fork confirm" }));

    expect(onForkFromMessage).not.toHaveBeenCalled();
    expect(screen.getByText("messages.forkConfirmTitle")).toBeTruthy();
    expect(screen.getByText("messages.forkConfirmDescription")).toBeTruthy();
    expect(screen.getByText("messages.forkConfirmPurpose")).toBeTruthy();
    expect(screen.getByText("messages.forkConfirmUsage")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "messages.forkConfirmAction" }),
    );

    await waitFor(() => {
      expect(onForkFromMessage).toHaveBeenCalledWith("user-fork-anchor", {
        providerProfileId: "__disk__",
        providerProfile: {
          id: "__disk__",
          name: "磁盘 .codex 配置",
          source: "disk",
        },
      });
    });
  });

  it(
    "passes selected codex provider when confirming message-tail fork",
    async () => {
      vi.mocked(getCodexProviders).mockResolvedValueOnce([
        { id: "provider-a", name: "Provider A" },
        { id: "provider-b", name: "Provider B" },
      ]);
      const onForkFromMessage = vi.fn(async () => {});

      render(
        <LayoutNodesHarness
          options={createLayoutOptions({
            onForkFromMessage,
            threadsByWorkspace: {
              [workspace.id]: [
                {
                  id: "thread-1",
                  name: "Thread",
                  updatedAt: 1,
                  engineSource: "codex",
                  providerProfileId: "provider-a",
                  providerProfileName: "Provider A",
                  providerProfileSource: "managed",
                },
              ],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "open fork confirm" }));

      const selector = await screen.findByLabelText("messages.forkProviderLabel");
      expect((selector as HTMLSelectElement).value).toBe("provider-a");
      await screen.findByRole("option", { name: "Provider B" });
      await act(async () => {
        fireEvent.change(selector, { target: { value: "provider-b" } });
        await Promise.resolve();
      });
      await waitFor(() => {
        expect((selector as HTMLSelectElement).value).toBe("provider-b");
      });
      fireEvent.click(
        screen.getByRole("button", { name: "messages.forkConfirmAction" }),
      );

      await waitFor(() => {
        expect(onForkFromMessage).toHaveBeenCalledWith("user-fork-anchor", {
          providerProfileId: "provider-b",
          providerProfile: {
            id: "provider-b",
            name: "Provider B",
            source: "managed",
          },
        });
      });
    },
    10_000,
  );

  it("uses the active thread engine when restoring a Claude session while Codex is selected globally", async () => {
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        selectedEngine: "codex",
        activeThreadId: "claude:session-1",
        threadsByWorkspace: {
          [workspace.id]: [
            {
              id: "claude:session-1",
              name: "Claude history",
              updatedAt: 1,
              engineSource: "claude",
            },
          ],
        },
        historyLoadingByThreadId: {
          "claude:session-1": true,
        },
      }),
    );

    render(<>{result.current.messagesNode}</>);

    expect(screen.getByTestId("messages").dataset.activeEngine).toBe("claude");
    expect(screen.getByTestId("messages").dataset.conversationEngine).toBe(
      "claude",
    );
  });

  it("does not crash when restored history metadata is omitted by a caller", async () => {
    const optionsWithoutRestoreMeta = {
      ...createLayoutOptions(),
      historyRestoredAtMsByThread: undefined,
    };

    const { result } = await renderUseLayoutNodes(optionsWithoutRestoreMeta);

    render(<>{result.current.messagesNode}</>);

    expect(screen.getByTestId("messages").dataset.historyRestoredAt ?? "").toBe(
      "",
    );
  });

  it("routes composer file reference open actions through the file-open pipeline", async () => {
    const onOpenFile = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        onOpenFile,
      }),
    );

    render(<>{result.current.composerNode}</>);

    fireEvent.click(
      screen.getByRole("button", { name: "open file reference" }),
    );

    expect(onOpenFile).toHaveBeenCalledWith("src/App.tsx");
  });

  it("toggles the Project Map toolbar icon off from full Project Map mode", async () => {
    clientUiVisibilityMock.visiblePanels.add("rightActivityToolbar");
    clientUiVisibilityMock.visibleControls.add("rightToolbar.projectMap");
    const setCenterMode = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        centerMode: "projectMap",
        setCenterMode,
      }),
    );

    render(<>{result.current.rightPanelToolbarNode}</>);
    expect(screen.getByTestId("panel-tabs").dataset.active).toBe("projectMap");

    fireEvent.click(screen.getByRole("button", { name: "projectMap" }));

    expect(setCenterMode).toHaveBeenCalledWith("chat");
  });

  it("opens the Project Map toolbar icon from chat mode", async () => {
    clientUiVisibilityMock.visiblePanels.add("rightActivityToolbar");
    clientUiVisibilityMock.visibleControls.add("rightToolbar.projectMap");
    const onOpenProjectMap = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        centerMode: "chat",
        onOpenProjectMap,
      }),
    );

    render(<>{result.current.rightPanelToolbarNode}</>);
    expect(screen.getByTestId("panel-tabs").dataset.active).toBe("files");

    fireEvent.click(screen.getByRole("button", { name: "projectMap" }));

    expect(onOpenProjectMap).toHaveBeenCalledTimes(1);
  });

  it("toggles the Project Map toolbar icon off from editor companion mode", async () => {
    clientUiVisibilityMock.visiblePanels.add("rightActivityToolbar");
    clientUiVisibilityMock.visibleControls.add("rightToolbar.projectMap");
    const setEditorSplitCompanion = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        centerMode: "editor",
        editorSplitCompanion: "projectMap",
        setEditorSplitCompanion,
      }),
    );

    render(<>{result.current.rightPanelToolbarNode}</>);
    expect(screen.getByTestId("panel-tabs").dataset.active).toBe("projectMap");

    fireEvent.click(screen.getByRole("button", { name: "projectMap" }));

    expect(setEditorSplitCompanion).toHaveBeenCalledWith("chat");
  });

  it("opens the Project Map toolbar icon as an editor companion without closing the editor", async () => {
    clientUiVisibilityMock.visiblePanels.add("rightActivityToolbar");
    clientUiVisibilityMock.visibleControls.add("rightToolbar.projectMap");
    const onOpenProjectMap = vi.fn();
    const setCenterMode = vi.fn();
    const setEditorSplitCompanion = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        centerMode: "editor",
        editorSplitCompanion: "chat",
        onOpenProjectMap,
        setCenterMode,
        setEditorSplitCompanion,
      }),
    );

    render(<>{result.current.rightPanelToolbarNode}</>);
    expect(screen.getByTestId("panel-tabs").dataset.active).toBe("files");

    fireEvent.click(screen.getByRole("button", { name: "projectMap" }));

    expect(setEditorSplitCompanion).toHaveBeenCalledWith("projectMap");
    expect(onOpenProjectMap).not.toHaveBeenCalled();
    expect(setCenterMode).not.toHaveBeenCalled();
  });

  it("restores a maximized editor when the Project Map toolbar icon opens as companion", async () => {
    clientUiVisibilityMock.visiblePanels.add("rightActivityToolbar");
    clientUiVisibilityMock.visibleControls.add("rightToolbar.projectMap");
    const setEditorSplitCompanion = vi.fn();
    const onToggleEditorFileMaximized = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        centerMode: "editor",
        editorSplitCompanion: "chat",
        setEditorSplitCompanion,
        isEditorFileMaximized: true,
        onToggleEditorFileMaximized,
      }),
    );

    render(<>{result.current.rightPanelToolbarNode}</>);

    fireEvent.click(screen.getByRole("button", { name: "projectMap" }));

    expect(setEditorSplitCompanion).toHaveBeenCalledWith("projectMap");
    expect(onToggleEditorFileMaximized).toHaveBeenCalledTimes(1);
  });

  it("hides the Project Map toolbar icon when its visibility control is disabled", async () => {
    clientUiVisibilityMock.visiblePanels.add("rightActivityToolbar");
    clientUiVisibilityMock.visibleControls.add("rightToolbar.files");
    const onOpenProjectMap = vi.fn();
    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        centerMode: "chat",
        onOpenProjectMap,
      }),
    );

    render(<>{result.current.rightPanelToolbarNode}</>);

    expect(screen.queryByRole("button", { name: "projectMap" })).toBeNull();
    expect(screen.getByRole("button", { name: "files" })).toBeTruthy();
  });

  it("keeps the bottom status dock mounted when baseline tabs are visible and collapsed", async () => {
    clientUiVisibilityMock.visiblePanels.add("bottomActivityPanel");
    clientUiVisibilityMock.visibleControls.add("bottomActivity.checkpoint");
    clientUiVisibilityMock.visibleControls.add(
      "bottomActivity.latestConversation",
    );

    const { result } = await renderUseLayoutNodes(
      createLayoutOptions({
        bottomStatusPanelExpanded: false,
        selectedEngine: "opencode",
      }),
    );

    expect(result.current.planPanelNode).toBeTruthy();

    render(
      <>
        {result.current.composerNode}
        {result.current.planPanelNode}
      </>,
    );

    expect(screen.getByTestId("status-panel").dataset.dockCollapsed).toBe(
      "true",
    );
    expect(screen.getByTestId("status-panel").dataset.selectedEngine).toBe(
      "opencode",
    );
    expect(
      screen.getByTestId("composer").dataset.showStatusPanelToggleOverride,
    ).toBe("false");
  });
});
