export const APP_SHELL_DOMAIN_CONTEXT_NAMES = [
  "runtimeThreadContext",
  "workspaceNavigationContext",
  "composerContext",
  "layoutContext",
  "fileEditorContext",
  "settingsContext",
] as const;

export type AppShellDomainContextName =
  (typeof APP_SHELL_DOMAIN_CONTEXT_NAMES)[number];

export type AppShellDomainContextValue = Record<string, unknown>;

export type AppShellDomainContexts = {
  runtimeThreadContext: AppShellDomainContextValue;
  workspaceNavigationContext: AppShellDomainContextValue;
  composerContext: AppShellDomainContextValue;
  layoutContext: AppShellDomainContextValue;
  fileEditorContext: AppShellDomainContextValue;
  settingsContext: AppShellDomainContextValue;
};

export type AppShellLegacyFlatContext = Record<string, any>;

export type AppShellDomainContextSelection<
  TDomainName extends AppShellDomainContextName,
> = Pick<AppShellDomainContexts, TDomainName>;

export const APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS: Record<
  AppShellDomainContextName,
  readonly string[]
> = {
  runtimeThreadContext: [
    "activeItems",
    "activeThreadId",
    "activeTurnId",
    "activeQueue",
    "activeRateLimits",
    "threadItemsByThread",
    "threadStatusById",
    "threadsByWorkspace",
    "tokenUsageByThread",
  ],
  workspaceNavigationContext: [
    "activeWorkspace",
    "activeWorkspaceId",
    "activeWorkspaceThreads",
    "groupedWorkspaces",
    "recentThreads",
    "workspaceGroups",
    "workspaces",
    "workspacesById",
    "workspacesByPath",
  ],
  composerContext: [
    "activeDraft",
    "activeImages",
    "composerEditorSettings",
    "composerInputRef",
    "composerInsert",
    "prefillDraft",
    "textareaHeight",
  ],
  layoutContext: [
    "activeTab",
    "appMode",
    "centerMode",
    "editorSplitCompanion",
    "editorSplitLayout",
    "rightPanelCollapsed",
    "rightPanelWidth",
    "sidebarCollapsed",
    "sidebarWidth",
    "terminalOpen",
    "terminalPanelHeight",
  ],
  fileEditorContext: [
    "activeEditorFilePath",
    "activeEditorLineRange",
    "activePath",
    "filePanelMode",
    "fileReferenceMode",
    "fileStatus",
    "fileTreeLoadError",
    "fileTreeSourceVersion",
    "files",
    "openFileTabs",
  ],
  settingsContext: [
    "accessMode",
    "appSettings",
    "appSettingsLoading",
    "collaborationModes",
    "effectiveModels",
    "effectiveReasoningSupported",
    "effectiveSelectedModelId",
    "selectedCollaborationMode",
  ],
};

export function listAppShellDomainContextNames(): AppShellDomainContextName[] {
  return [...APP_SHELL_DOMAIN_CONTEXT_NAMES];
}

export function defineAppShellDomainContexts<T extends AppShellDomainContexts>(
  contexts: T,
): T {
  return contexts;
}

export function flattenAppShellDomainContexts(
  contexts: AppShellDomainContexts,
): AppShellLegacyFlatContext {
  return Object.assign(
    {},
    ...APP_SHELL_DOMAIN_CONTEXT_NAMES.map((name) => contexts[name]),
  );
}

export function flattenSelectedAppShellDomainContexts<
  TDomainName extends AppShellDomainContextName,
>(
  contexts: AppShellDomainContextSelection<TDomainName>,
  domainNames: readonly TDomainName[],
): AppShellLegacyFlatContext {
  return Object.assign({}, ...domainNames.map((name) => contexts[name]));
}

export function adaptAppShellLegacyFlatContext<TBoundary extends object>(
  context: AppShellLegacyFlatContext,
): TBoundary {
  return context as TBoundary;
}

function areAppShellDomainContextValuesShallowEqual(
  left: AppShellDomainContextValue,
  right: AppShellDomainContextValue,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

export function reuseStableAppShellDomainContexts(
  previousContexts: AppShellDomainContexts | null | undefined,
  nextContexts: AppShellDomainContexts,
): AppShellDomainContexts {
  if (!previousContexts) {
    return nextContexts;
  }
  return {
    runtimeThreadContext: areAppShellDomainContextValuesShallowEqual(
      previousContexts.runtimeThreadContext,
      nextContexts.runtimeThreadContext,
    )
      ? previousContexts.runtimeThreadContext
      : nextContexts.runtimeThreadContext,
    workspaceNavigationContext: areAppShellDomainContextValuesShallowEqual(
      previousContexts.workspaceNavigationContext,
      nextContexts.workspaceNavigationContext,
    )
      ? previousContexts.workspaceNavigationContext
      : nextContexts.workspaceNavigationContext,
    composerContext: areAppShellDomainContextValuesShallowEqual(
      previousContexts.composerContext,
      nextContexts.composerContext,
    )
      ? previousContexts.composerContext
      : nextContexts.composerContext,
    layoutContext: areAppShellDomainContextValuesShallowEqual(
      previousContexts.layoutContext,
      nextContexts.layoutContext,
    )
      ? previousContexts.layoutContext
      : nextContexts.layoutContext,
    fileEditorContext: areAppShellDomainContextValuesShallowEqual(
      previousContexts.fileEditorContext,
      nextContexts.fileEditorContext,
    )
      ? previousContexts.fileEditorContext
      : nextContexts.fileEditorContext,
    settingsContext: areAppShellDomainContextValuesShallowEqual(
      previousContexts.settingsContext,
      nextContexts.settingsContext,
    )
      ? previousContexts.settingsContext
      : nextContexts.settingsContext,
  };
}

export function findOverlappingAppShellDomainKeys(): string[] {
  const keyOwners = new Map<string, AppShellDomainContextName>();
  const overlappingKeys = new Set<string>();
  for (const domainName of APP_SHELL_DOMAIN_CONTEXT_NAMES) {
    for (const key of APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domainName]) {
      const previousOwner = keyOwners.get(key);
      if (previousOwner && previousOwner !== domainName) {
        overlappingKeys.add(key);
      } else {
        keyOwners.set(key, domainName);
      }
    }
  }
  return [...overlappingKeys].sort();
}
