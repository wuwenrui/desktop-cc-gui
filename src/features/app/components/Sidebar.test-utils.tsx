import { createRef } from "react";
import type React from "react";
import { vi } from "vitest";
import { writeClientStoreData } from "../../../services/clientStorage";
import {
  assignWorkspaceSessionFolder,
  assignWorkspaceSessionFolders,
  createWorkspaceSessionFolder,
  deleteWorkspaceSessionFolder,
  listWorkspaceSessionFolders,
  renameWorkspaceSessionFolder,
} from "../../../services/tauri";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "sidebar.addWorkspace": "Add workspace",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
        "sidebar.sessionActionsGroup": "New Session",
        "sidebar.newSessionInFolder": "New session in project",
        "sidebar.toggleSearch": "Toggle search",
        "sidebar.searchProjects": "Search projects",
        "sidebar.activateWorkspace": "Open in main panel",
        "sidebar.setWorkspaceAlias": "Set alias",
        "sidebar.workspaceAliasPrompt": "Alias prompt",
        "sidebar.workspaceAliasBadge": "A",
        "sidebar.workspaceAliasBadgeTitle": "Workspace alias. Original name: service",
        "sidebar.emptyWorkspaceSessions": "No sessions yet.",
        "sidebar.newSessionFolder": "New folder",
        "sidebar.newSessionFolderIn": "New folder in project",
        "sidebar.renameSessionFolder": "Rename folder",
        "sidebar.deleteSessionFolder": "Delete folder",
        "sidebar.sessionFolderActions": "Folder actions",
        "sidebar.collapseSessionFolder": "Collapse folder",
        "sidebar.expandSessionFolder": "Expand folder",
        "sidebar.sessionFolderContextMenuPrompt": "Type an action",
        "sidebar.sessionFolderNamePrompt": "Folder name",
        "sidebar.sessionFolderRenamePrompt": "Rename folder",
        "sidebar.sessionFolderDeleteTitle": "Delete folder",
        "sidebar.sessionFolderDeleteMessage": "Delete folder message",
        "sidebar.sessionFolderDeleteHint": "Clear non-empty folders first.",
        "sidebar.sessionFolderCreateFailed": "Could not create folder",
        "sidebar.sessionFolderRenameFailed": "Could not rename folder",
        "sidebar.sessionFolderDeleteFailed": "Could not delete folder",
        "sidebar.sessionFolderMoveFailed": "Could not move session",
        "sidebar.loadingProgressMoveSessionTitle": "Moving session...",
        "sidebar.loadingProgressMoveSessionMessage": "Moving this session to {{folder}}.",
        "sidebar.sessionFolderCrossProjectBlocked": "Sessions cannot be moved across projects.",
        "sidebar.sessionFolderCount": "session count",
        "sidebar.sessionFolderLoadFailed": "Session folders unavailable.",
        "sidebar.quickNewThread": "Home",
        "sidebar.quickAutomation": "Automation",
        "sidebar.quickSearch": "Search",
        "sidebar.quickSkills": "Skills",
        "lockScreen.lock": "Lock",
        "sidebar.projects": "Projects",
        "sidebar.mcpSkillsMarket": "MCP & Skills Market",
        "sidebar.longTermMemory": "Long-term Memory",
        "sidebar.pluginMarket": "Plugin Market",
        "sidebar.specHub": "Spec Hub",
        "sidebar.openHome": "Open home",
        "panels.memory": "Project Memory",
        "common.terminal": "Terminal",
        "common.refresh": "Refresh",
        "common.toggleTerminalPanel": "Toggle terminal panel",
        "git.logMode": "Git",
        "sidebar.releaseNotes": "Release Notes",
        "sidebar.comingSoon": "Coming soon",
        "sidebar.comingSoonMessage": "This feature is coming soon",
        "sidebar.threadsSection": "Threads",
        "threads.degradedWorkspaceRefreshAriaLabel": "Refresh incomplete thread list",
        "threads.degradedWorkspaceRefreshTooltip":
          "This project's thread list is not fully refreshed yet and may be missing some conversations. Click to refresh it again.",
        "threads.hideExitedSessions": "Hide exited sessions",
        "threads.showExitedSessions": "Show exited sessions",
        "threads.exitedSessionsHidden": "{{count}} exited hidden",
        "threads.subagentTreeExpanded": "Subagent tree expanded",
        "threads.subagentTreeExpand": "Expand subagent tree",
        "threads.subagentTreeCollapse": "Collapse subagent tree",
        "threads.moveToFolder": "Move to folder",
        "threads.moveToProjectRoot": "Project root",
        "threads.searchFolderTargets": "Search folders...",
        "threads.more": "More...",
        "threads.loading": "Loading...",
        "threads.searchOlder": "Search older...",
        "threads.loadOlder": "Load older...",
        "workspace.engineClaudeCode": "Claude Code",
        "workspace.engineCodex": "Codex",
        "workspace.engineOpenCode": "OpenCode",
        "workspace.engineGemini": "Gemini",
        "sidebar.cliNotInstalled": "CLI not installed",
        "settings.title": "Settings",
        "tabbar.primaryNavigation": "Primary navigation",
      };
      return translations[key] ?? key;
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock("../../../services/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/tauri")>();
  return {
    ...actual,
    assignWorkspaceSessionFolder: vi.fn(),
    assignWorkspaceSessionFolders: vi.fn(),
    createWorkspaceSessionFolder: vi.fn(),
    deleteWorkspaceSessionFolder: vi.fn(),
    listWorkspaceSessionFolders: vi.fn(),
    renameWorkspaceSessionFolder: vi.fn(),
  };
});

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ scaleFactor: () => 1 }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    viewportRef,
    onViewportScroll,
    className,
  }: {
    children: React.ReactNode;
    viewportRef?: React.Ref<HTMLDivElement>;
    onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
    className?: string;
  }) => (
    <div className={className} onScroll={onViewportScroll} ref={viewportRef}>
      {children}
    </div>
  ),
  ScrollBar: () => null,
}));

export function resetSidebarTestMocks() {
  vi.clearAllMocks();
  writeClientStoreData("threads", {});
  writeClientStoreData("layout", {});
  vi.mocked(listWorkspaceSessionFolders).mockResolvedValue({
    workspaceId: "default",
    folders: [],
  });
  vi.mocked(assignWorkspaceSessionFolder).mockResolvedValue({
    sessionId: "default-session",
    folderId: null,
  });
  vi.mocked(assignWorkspaceSessionFolders).mockResolvedValue({
    results: [{ sessionId: "default-session", ok: true }],
  });
  vi.mocked(createWorkspaceSessionFolder).mockResolvedValue({
    folder: {
      id: "created-folder",
      workspaceId: "default",
      parentId: null,
      name: "Created",
      createdAt: 1,
      updatedAt: 1,
    },
  });
  vi.mocked(renameWorkspaceSessionFolder).mockResolvedValue({
    folder: {
      id: "renamed-folder",
      workspaceId: "default",
      parentId: null,
      name: "Renamed",
      createdAt: 1,
      updatedAt: 2,
    },
  });
  vi.mocked(deleteWorkspaceSessionFolder).mockResolvedValue(undefined);
}

export const baseProps = {
  workspaces: [],
  groupedWorkspaces: [],
  hasWorkspaceGroups: false,
  deletingWorktreeIds: new Set<string>(),
  threadsByWorkspace: {},
  activeItems: [],
  threadParentById: {},
  threadStatusById: {},
  hydratedThreadListWorkspaceIds: new Set<string>(),
  threadListLoadingByWorkspace: {},
  threadListPagingByWorkspace: {},
  threadListCursorByWorkspace: {},
  activeWorkspaceId: null,
  activeThreadId: null,
  accountRateLimits: null,
  usageShowRemaining: false,
  accountInfo: null,
  onSwitchAccount: vi.fn(),
  onCancelSwitchAccount: vi.fn(),
  accountSwitching: false,
  onOpenSettings: vi.fn(),
  onOpenDebug: vi.fn(),
  showDebugButton: false,
  onAddWorkspace: vi.fn(),
  onSelectHome: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onConnectWorkspace: vi.fn(),
  onAddAgent: vi.fn(),
  onAddWorktreeAgent: vi.fn(),
  onAddCloneAgent: vi.fn(),
  onToggleWorkspaceCollapse: vi.fn(),
  onSelectThread: vi.fn(),
  onDeleteThread: vi.fn(),
  onArchiveThread: vi.fn(),
  onSyncThread: vi.fn(),
  pinThread: vi.fn(() => false),
  unpinThread: vi.fn(),
  isThreadPinned: vi.fn(() => false),
  isThreadAutoNaming: vi.fn(() => false),
  getPinTimestamp: vi.fn(() => null),
  pinnedThreadsVersion: 0,
  onRenameThread: vi.fn(),
  onAutoNameThread: vi.fn(),
  onDeleteWorkspace: vi.fn(),
  onDeleteWorktree: vi.fn(),
  onRenameWorkspaceAlias: vi.fn(),
  onLoadOlderThreads: vi.fn(),
  onReloadWorkspaceThreads: vi.fn(),
  onQuickReloadWorkspaceThreads: vi.fn(),
  workspaceDropTargetRef: createRef<HTMLElement>(),
  isWorkspaceDropActive: false,
  workspaceDropText: "Drop Project Here",
  onWorkspaceDragOver: vi.fn(),
  onWorkspaceDragEnter: vi.fn(),
  onWorkspaceDragLeave: vi.fn(),
  onWorkspaceDrop: vi.fn(),
  appMode: "chat" as const,
  onAppModeChange: vi.fn(),
  onOpenHomeChat: vi.fn(),
  onOpenMemory: vi.fn(),
  onLockPanel: vi.fn(),
  onOpenProjectMemory: vi.fn(),
  onOpenReleaseNotes: vi.fn(),
  onOpenGlobalSearch: vi.fn(),
  globalSearchShortcut: "cmd+o",
  openChatShortcut: "cmd+j",
  openKanbanShortcut: "cmd+k",
  onOpenSpecHub: vi.fn(),
  onOpenWorkspaceHome: vi.fn(),
};
