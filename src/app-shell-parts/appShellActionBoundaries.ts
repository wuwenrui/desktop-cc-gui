export type AppShellActionFamily = "runtime" | "task-run" | "navigation" | "context";

type AppShellBoundaryAction = (...args: never[]) => unknown;

export type AppShellRuntimeActions = {
  handleToggleRuntimeConsole: AppShellBoundaryAction;
  handleToggleTerminalPanel: AppShellBoundaryAction;
};

export type AppShellTaskRunActions = {
  handleOpenTaskConversation: AppShellBoundaryAction;
  handleRetryTaskRun: AppShellBoundaryAction;
  handleResumeTaskRun: AppShellBoundaryAction;
  handleCancelTaskRun: AppShellBoundaryAction;
  handleForkTaskRun: AppShellBoundaryAction;
  handleCloseTaskConversation: AppShellBoundaryAction;
  handleKanbanCreateTask: AppShellBoundaryAction;
  handleDispatchOrchestrationTask: AppShellBoundaryAction;
  handleDragToInProgress: AppShellBoundaryAction;
};

export type AppShellNavigationActions = {
  handleSelectWorkspaceInstance: AppShellBoundaryAction;
  handleStartWorkspaceConversation: AppShellBoundaryAction;
  handleStartSharedConversation: AppShellBoundaryAction;
  handleContinueLatestConversation: AppShellBoundaryAction;
  handleStartGuidedConversation: AppShellBoundaryAction;
  handleRevealActiveWorkspace: AppShellBoundaryAction;
  handleOpenSpecHub: AppShellBoundaryAction;
  handleOpenClientDocumentation: AppShellBoundaryAction;
  handleOpenWorkspaceHome: AppShellBoundaryAction;
  handleOpenHomeChat: AppShellBoundaryAction;
  handleSelectHomeWorkspace: AppShellBoundaryAction;
  handleSelectWorkspacePathForGitHistory: AppShellBoundaryAction;
};

export type AppShellContextActions = {
  handleOpenWorkspaceFile: AppShellBoundaryAction;
  handleActivateWorkspaceFileTab: AppShellBoundaryAction;
  handleCloseWorkspaceFileTab: AppShellBoundaryAction;
  handleCloseAllWorkspaceFileTabs: AppShellBoundaryAction;
  handleExitWorkspaceEditor: AppShellBoundaryAction;
  handleSelectDiffForPanel: AppShellBoundaryAction;
  handleRewindFromMessage: AppShellBoundaryAction;
  handleDeleteWorkspaceConversations: AppShellBoundaryAction;
  handleDeleteWorkspaceConversationsInSettings: AppShellBoundaryAction;
};

export type AppShellActionBoundary = {
  family: AppShellActionFamily;
  owns: readonly string[];
  mustNotOwn: readonly string[];
};

export const APP_SHELL_ACTION_BOUNDARIES: readonly AppShellActionBoundary[] = [
  {
    family: "runtime",
    owns: [
      "renderer lifecycle",
      "runtime console",
      "global runtime notices",
      "recovery entrypoints",
    ],
    mustNotOwn: ["TaskRun lifecycle semantics", "thread message transport"],
  },
  {
    family: "task-run",
    owns: [
      "TaskRun actions",
      "Orchestration run actions",
      "Project Map run links",
      "run detail navigation",
    ],
    mustNotOwn: ["thread message send internals", "generic panel routing"],
  },
  {
    family: "navigation",
    owns: ["active view", "panel opening", "workspace/session selection"],
    mustNotOwn: ["runtime lifecycle mutation", "TaskRun status mutation"],
  },
  {
    family: "context",
    owns: ["file refs", "memory refs", "evidence refs", "context insertion"],
    mustNotOwn: ["message transport lifecycle", "session lifecycle"],
  },
];

const ACTION_FAMILY_MATCHERS: ReadonlyArray<{
  family: AppShellActionFamily;
  patterns: ReadonlyArray<RegExp>;
}> = [
  {
    family: "runtime",
    patterns: [/Runtime/i, /Terminal/i, /Doctor/i, /Notification/i],
  },
  {
    family: "task-run",
    patterns: [/Task/i, /TaskRun/i, /Orchestration/i, /Kanban/i],
  },
  {
    family: "navigation",
    patterns: [/Open/i, /Select/i, /Reveal/i, /Activate/i, /Tab/i, /Panel/i],
  },
  {
    family: "context",
    patterns: [/Context/i, /Memory/i, /File/i, /Evidence/i, /Diff/i],
  },
];

export function classifyAppShellActionName(actionName: string): AppShellActionFamily | null {
  const normalizedName = actionName.trim();
  if (!normalizedName) {
    return null;
  }
  for (const matcher of ACTION_FAMILY_MATCHERS) {
    if (matcher.patterns.some((pattern) => pattern.test(normalizedName))) {
      return matcher.family;
    }
  }
  return null;
}

export function listAppShellActionFamilies() {
  return APP_SHELL_ACTION_BOUNDARIES.map((boundary) => boundary.family);
}

export function defineAppShellRuntimeActions<T extends AppShellRuntimeActions>(
  actions: T,
): T {
  return actions;
}

export function defineAppShellTaskRunActions<T extends AppShellTaskRunActions>(
  actions: T,
): T {
  return actions;
}

export function defineAppShellNavigationActions<T extends AppShellNavigationActions>(
  actions: T,
): T {
  return actions;
}

export function defineAppShellContextActions<T extends AppShellContextActions>(
  actions: T,
): T {
  return actions;
}
