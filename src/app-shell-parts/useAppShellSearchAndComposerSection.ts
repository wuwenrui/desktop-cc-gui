import { useCallback, useEffect } from "react";
import { useGlobalSearchShortcut } from "../features/app/hooks/useGlobalSearchShortcut";
import { useInterruptShortcut } from "../features/app/hooks/useInterruptShortcut";
import { usePullRequestComposer } from "../features/git/hooks/usePullRequestComposer";
import { recordSearchResultOpen } from "../features/search/ranking/recencyStore";
import type { KanbanTask } from "../features/kanban/types";
import type {
  SearchContentFilter,
  SearchResult,
  SearchScope,
} from "../features/search/types";
import { resolveSearchScopeOnOpen } from "../features/search/utils/scope";
import { toggleSearchContentFilters } from "../features/search/utils/contentFilters";
import type {
  AppSettings,
  GitHubPullRequest,
  GitHubPullRequestDiff,
  MessageSendOptions,
  WorkspaceInfo,
} from "../types";
import {
  getThreadSelectDiffCleanupAction,
  shouldPreserveEditorOnThreadSelect,
} from "./threadEditorPreservation";
import {
  adaptAppShellLegacyFlatContext,
  flattenSelectedAppShellDomainContexts,
  type AppShellDomainContextSelection,
} from "./appShellDomainContexts";

type AppShellTab = "projects" | "codex" | "spec" | "git" | "log";
type CenterMode =
  | "chat"
  | "diff"
  | "editor"
  | "memory"
  | "projectMap"
  | "intentCanvas";
type DiffSource = "local" | "pr" | "commit";
type FilePanelMode =
  | "git"
  | "files"
  | "search"
  | "notes"
  | "prompts"
  | "memory"
  | "activity"
  | "radar";
type GitPanelMode = "diff" | "log" | "issues" | "prs";

type ComposerSearchLegacyPassthrough = Record<string, unknown>;

const COMPOSER_SEARCH_DOMAIN_NAMES = [
  "workspaceNavigationContext",
  "composerContext",
  "layoutContext",
  "fileEditorContext",
  "settingsContext",
] as const;

export type ComposerSearchShellDomainInput = AppShellDomainContextSelection<
  (typeof COMPOSER_SEARCH_DOMAIN_NAMES)[number]
>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export type ComposerSearchShellBoundary = ComposerSearchLegacyPassthrough & {
  activeDraft: string;
  activeEditorFilePath: string | null | undefined;
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  appSettings: Pick<
    AppSettings,
    "interruptShortcut" | "toggleGlobalSearchShortcut"
  >;
  canInterrupt: boolean;
  centerMode: CenterMode;
  clearActiveImages: () => void;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  exitDiffView: () => void;
  filePanelMode: FilePanelMode;
  gitPanelMode: GitPanelMode;
  gitPullRequestDiffs: GitHubPullRequestDiff[];
  handleDraftChange: (draft: string) => void;
  handleOpenFile: (filePath: string) => void;
  handleSend: (
    text: string,
    images: string[],
    options?: MessageSendOptions,
  ) => Promise<void>;
  interruptTurn: () => Promise<unknown> | unknown;
  isCompact: boolean;
  isSearchPaletteOpen: boolean;
  kanbanTasks: KanbanTask[];
  queueMessage: (
    text: string,
    images: string[],
    options?: MessageSendOptions,
  ) => Promise<void>;
  searchPaletteQuery: string;
  searchResults: SearchResult[];
  searchScope: SearchScope;
  selectWorkspace: (workspaceId: string) => void;
  selectedPullRequest: GitHubPullRequest | null;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: MessageSendOptions,
  ) => Promise<void>;
  setActiveTab: (tab: AppShellTab) => void;
  setActiveThreadId: (threadId: string, workspaceId: string) => void;
  setAppMode: (mode: "chat" | "kanban") => void;
  setCenterMode: (mode: CenterMode) => void;
  setDiffSource: (source: DiffSource) => void;
  setGitPanelMode: (mode: GitPanelMode) => void;
  setIsSearchPaletteOpen: (open: boolean) => void;
  setKanbanViewState: (state: {
    view: "board";
    workspaceId: string;
    panelId: string;
  }) => void;
  setPrefillDraft: (draft: {
    id: string;
    text: string;
    createdAt: number;
  }) => void;
  setSearchContentFilters: (
    updater: (previous: SearchContentFilter[]) => SearchContentFilter[],
  ) => void;
  setSearchPaletteQuery: (query: string) => void;
  setSearchPaletteSelectedIndex: (
    updater: number | ((previous: number) => number),
  ) => void;
  setSearchScope: (scope: SearchScope) => void;
  setSelectedCommitSha: (sha: string | null) => void;
  setSelectedDiffPath: (path: string | null) => void;
  setSelectedKanbanTaskId: (taskId: string | null) => void;
  setSelectedPullRequest: (pullRequest: GitHubPullRequest | null) => void;
  startThreadForWorkspace: (
    workspaceId: string,
    options?: { activate?: boolean },
  ) => Promise<string | null>;
  workspacesByPath: Map<string, WorkspaceInfo>;
};

function flattenComposerSearchShellBoundary(
  input: ComposerSearchShellDomainInput,
): ComposerSearchShellBoundary {
  return adaptAppShellLegacyFlatContext<ComposerSearchShellBoundary>(
    flattenSelectedAppShellDomainContexts(input, COMPOSER_SEARCH_DOMAIN_NAMES),
  );
}

export function useAppShellSearchAndComposerSection(
  input: ComposerSearchShellDomainInput,
) {
  const ctx = flattenComposerSearchShellBoundary(input);
  const {
    activeDraft,
    activeEditorFilePath,
    activeWorkspace,
    activeWorkspaceId,
    appSettings,
    canInterrupt,
    centerMode,
    clearActiveImages,
    connectWorkspace,
    exitDiffView,
    filePanelMode,
    gitPanelMode,
    gitPullRequestDiffs,
    handleDraftChange,
    handleOpenFile,
    handleSend,
    interruptTurn,
    isCompact,
    isSearchPaletteOpen,
    kanbanTasks,
    queueMessage,
    searchPaletteQuery,
    searchResults,
    searchScope,
    selectWorkspace,
    selectedPullRequest,
    sendUserMessageToThread,
    setActiveTab,
    setActiveThreadId,
    setAppMode,
    setCenterMode,
    setDiffSource,
    setGitPanelMode,
    setIsSearchPaletteOpen,
    setKanbanViewState,
    setPrefillDraft,
    setSearchContentFilters,
    setSearchPaletteQuery,
    setSearchPaletteSelectedIndex,
    setSearchScope,
    setSelectedCommitSha,
    setSelectedDiffPath,
    setSelectedKanbanTaskId,
    setSelectedPullRequest,
    startThreadForWorkspace,
    workspacesByPath,
  } = ctx;

  const closeSearchPalette = useCallback(() => {
    setIsSearchPaletteOpen(false);
    setSearchPaletteQuery("");
    setSearchPaletteSelectedIndex(0);
  }, [
    setIsSearchPaletteOpen,
    setSearchPaletteQuery,
    setSearchPaletteSelectedIndex,
  ]);

  const handleOpenSearchPalette = useCallback(() => {
    const nextScope = resolveSearchScopeOnOpen(searchScope, activeWorkspaceId);
    if (nextScope !== searchScope) {
      setSearchScope(nextScope);
    }
    setIsSearchPaletteOpen(true);
    setSearchPaletteSelectedIndex(0);
  }, [
    activeWorkspaceId,
    searchScope,
    setIsSearchPaletteOpen,
    setSearchPaletteSelectedIndex,
    setSearchScope,
  ]);

  const handleToggleSearchPalette = useCallback(() => {
    if (isSearchPaletteOpen) {
      closeSearchPalette();
      return;
    }
    handleOpenSearchPalette();
  }, [closeSearchPalette, handleOpenSearchPalette, isSearchPaletteOpen]);

  useGlobalSearchShortcut({
    isEnabled: true,
    shortcut: appSettings.toggleGlobalSearchShortcut,
    onTrigger: handleToggleSearchPalette,
  });

  useEffect(() => {
    if (!isSearchPaletteOpen) {
      return;
    }
    setSearchPaletteSelectedIndex(0);
  }, [isSearchPaletteOpen, searchPaletteQuery, setSearchPaletteSelectedIndex]);

  const handleSearchPaletteMoveSelection = useCallback(
    (direction: "up" | "down") => {
      if (!searchResults.length) {
        return;
      }
      setSearchPaletteSelectedIndex((prev) => {
        if (direction === "down") {
          return (prev + 1) % searchResults.length;
        }
        return (prev - 1 + searchResults.length) % searchResults.length;
      });
    },
    [searchResults.length, setSearchPaletteSelectedIndex],
  );

  const handleToggleSearchContentFilter = useCallback(
    (nextFilter: SearchContentFilter) => {
      setSearchContentFilters((prev) =>
        toggleSearchContentFilters(prev, nextFilter),
      );
      setSearchPaletteSelectedIndex(0);
    },
    [setSearchContentFilters, setSearchPaletteSelectedIndex],
  );

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      switch (result.kind) {
        case "file":
          if (result.filePath) {
            handleOpenFile(result.filePath);
          }
          break;
        case "thread":
          if (
            isNonEmptyString(result.workspaceId) &&
            isNonEmptyString(result.threadId)
          ) {
            const preserveEditor = shouldPreserveEditorOnThreadSelect({
              isCompact,
              centerMode,
              activeWorkspaceId,
              targetWorkspaceId: result.workspaceId,
              activeEditorFilePath,
            });
            const diffCleanupAction =
              getThreadSelectDiffCleanupAction(preserveEditor);
            if (diffCleanupAction === "clear-selected-diff") {
              setSelectedDiffPath(null);
            } else {
              exitDiffView();
            }
            setSelectedPullRequest(null);
            setSelectedCommitSha(null);
            setDiffSource("local");
            selectWorkspace(result.workspaceId);
            setActiveThreadId(result.threadId, result.workspaceId);
          }
          break;
        case "kanban":
          if (result.taskId) {
            const task = kanbanTasks.find(
              (entry) => entry.id === result.taskId,
            );
            if (task) {
              const taskWs = workspacesByPath.get(task.workspaceId);
              setAppMode("kanban");
              setSelectedKanbanTaskId(task.id);
              if (taskWs) selectWorkspace(taskWs.id);
              setKanbanViewState({
                view: "board",
                workspaceId: task.workspaceId,
                panelId: task.panelId,
              });
            }
          }
          break;
        case "history":
          if (result.historyText) {
            handleDraftChange(result.historyText);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        case "message":
          if (
            isNonEmptyString(result.workspaceId) &&
            isNonEmptyString(result.threadId)
          ) {
            const preserveEditor = shouldPreserveEditorOnThreadSelect({
              isCompact,
              centerMode,
              activeWorkspaceId,
              targetWorkspaceId: result.workspaceId,
              activeEditorFilePath,
            });
            const diffCleanupAction =
              getThreadSelectDiffCleanupAction(preserveEditor);
            if (diffCleanupAction === "clear-selected-diff") {
              setSelectedDiffPath(null);
            } else {
              exitDiffView();
            }
            setSelectedPullRequest(null);
            setSelectedCommitSha(null);
            setDiffSource("local");
            selectWorkspace(result.workspaceId);
            setActiveThreadId(result.threadId, result.workspaceId);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        case "skill":
          if (result.skillName) {
            const slashToken = `/${result.skillName}`;
            const nextDraft = activeDraft.trim()
              ? `${activeDraft.trim()} ${slashToken} `
              : `${slashToken} `;
            handleDraftChange(nextDraft);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        case "command":
          if (result.commandName) {
            const slashToken = `/${result.commandName}`;
            const nextDraft = activeDraft.trim()
              ? `${activeDraft.trim()} ${slashToken} `
              : `${slashToken} `;
            handleDraftChange(nextDraft);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        default:
          break;
      }
      recordSearchResultOpen(result.id);
      closeSearchPalette();
    },
    [
      activeEditorFilePath,
      activeWorkspaceId,
      centerMode,
      closeSearchPalette,
      exitDiffView,
      handleDraftChange,
      handleOpenFile,
      activeDraft,
      isCompact,
      kanbanTasks,
      workspacesByPath,
      selectWorkspace,
      setActiveTab,
      setAppMode,
      setDiffSource,
      setActiveThreadId,
      setKanbanViewState,
      setSelectedCommitSha,
      setSelectedDiffPath,
      setSelectedKanbanTaskId,
      setSelectedPullRequest,
    ],
  );

  useInterruptShortcut({
    isEnabled: canInterrupt,
    shortcut: appSettings.interruptShortcut,
    onTrigger: () => {
      void interruptTurn();
    },
  });

  const {
    handleSelectPullRequest,
    resetPullRequestSelection,
    isPullRequestComposer,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  } = usePullRequestComposer({
    activeWorkspace,
    selectedPullRequest,
    gitPullRequestDiffs,
    filePanelMode,
    gitPanelMode,
    centerMode,
    isCompact,
    setSelectedPullRequest,
    setDiffSource,
    setSelectedDiffPath,
    setCenterMode,
    setGitPanelMode,
    setPrefillDraft,
    setActiveTab,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    clearActiveImages,
    handleSend,
    queueMessage,
  });

  return {
    closeSearchPalette,
    handleOpenSearchPalette,
    handleToggleSearchPalette,
    handleSearchPaletteMoveSelection,
    handleToggleSearchContentFilter,
    handleSelectSearchResult,
    handleSelectPullRequest,
    resetPullRequestSelection,
    isPullRequestComposer,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  };
}
