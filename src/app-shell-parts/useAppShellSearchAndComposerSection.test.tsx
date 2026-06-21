// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS,
  type ComposerSearchShellBoundary,
  useAppShellSearchAndComposerSection,
} from "./useAppShellSearchAndComposerSection";
import type { SearchContentFilter, SearchResult } from "../features/search/types";
import type { WorkspaceInfo } from "../types";

vi.mock("../features/app/hooks/useGlobalSearchShortcut", () => ({
  useGlobalSearchShortcut: vi.fn(),
}));

vi.mock("../features/app/hooks/useInterruptShortcut", () => ({
  useInterruptShortcut: vi.fn(),
}));

vi.mock("../features/search/ranking/recencyStore", () => ({
  recordSearchResultOpen: vi.fn(),
}));

function createWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: "workspace-1",
    name: "Workspace 1",
    path: "/tmp/workspace-1",
    connected: true,
    ...overrides,
  } as WorkspaceInfo;
}

function createBoundary(
  overrides: Partial<ComposerSearchShellBoundary> = {},
): ComposerSearchShellBoundary {
  const activeWorkspace = createWorkspace();
  const kanbanWorkspace = createWorkspace({
    id: "workspace-kanban",
    path: "/tmp/workspace-kanban",
  });

  return {
    activeDraft: "draft",
    activeEditorFilePath: "src/current.ts",
    activeWorkspace,
    activeWorkspaceId: activeWorkspace.id,
    appSettings: {
      interruptShortcut: "cmd+.",
      toggleGlobalSearchShortcut: "cmd+k",
    },
    canInterrupt: true,
    centerMode: "editor",
    clearActiveImages: vi.fn(),
    connectWorkspace: vi.fn(async () => undefined),
    exitDiffView: vi.fn(),
    filePanelMode: "files",
    gitPanelMode: "diff",
    gitPullRequestDiffs: [],
    handleDraftChange: vi.fn(),
    handleOpenFile: vi.fn(),
    handleSend: vi.fn(async () => undefined),
    interruptTurn: vi.fn(),
    isCompact: false,
    isSearchPaletteOpen: false,
    kanbanTasks: [
      {
        id: "task-1",
        panelId: "todo",
        workspaceId: kanbanWorkspace.path,
      } as any,
    ],
    queueMessage: vi.fn(async () => undefined),
    searchPaletteQuery: "",
    searchResults: [],
    searchScope: "active-workspace",
    selectWorkspace: vi.fn(),
    selectedPullRequest: null,
    sendUserMessageToThread: vi.fn(async () => undefined),
    setActiveTab: vi.fn(),
    setActiveThreadId: vi.fn(),
    setAppMode: vi.fn(),
    setCenterMode: vi.fn(),
    setDiffSource: vi.fn(),
    setGitPanelMode: vi.fn(),
    setIsSearchPaletteOpen: vi.fn(),
    setKanbanViewState: vi.fn(),
    setPrefillDraft: vi.fn(),
    setSearchContentFilters: vi.fn(),
    setSearchPaletteQuery: vi.fn(),
    setSearchPaletteSelectedIndex: vi.fn(),
    setSearchScope: vi.fn(),
    setSelectedCommitSha: vi.fn(),
    setSelectedDiffPath: vi.fn(),
    setSelectedKanbanTaskId: vi.fn(),
    setSelectedPullRequest: vi.fn(),
    startThreadForWorkspace: vi.fn(async () => "thread-1"),
    workspacesByPath: new Map([[kanbanWorkspace.path, kanbanWorkspace]]),
    ...overrides,
  };
}

describe("useAppShellSearchAndComposerSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents selected-field boundary groups for search/composer", () => {
    expect(COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS.searchPalette).toContain(
      "searchResults",
    );
    expect(COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS.composerSend).toContain(
      "handleSend",
    );
    expect(COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS.gitSearchOpen).toContain(
      "setGitPanelMode",
    );
    expect(COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS.kanbanBridge).toContain(
      "setKanbanViewState",
    );
  });

  it("opens and closes the search palette while resetting selection state", () => {
    const boundary = createBoundary({ activeWorkspaceId: null });
    const { result } = renderHook(() =>
      useAppShellSearchAndComposerSection(boundary),
    );

    act(() => {
      result.current.handleOpenSearchPalette();
    });

    expect(boundary.setSearchScope).toHaveBeenCalledWith("global");
    expect(boundary.setIsSearchPaletteOpen).toHaveBeenCalledWith(true);
    expect(boundary.setSearchPaletteSelectedIndex).toHaveBeenCalledWith(0);

    act(() => {
      result.current.closeSearchPalette();
    });

    expect(boundary.setIsSearchPaletteOpen).toHaveBeenLastCalledWith(false);
    expect(boundary.setSearchPaletteQuery).toHaveBeenCalledWith("");
    expect(boundary.setSearchPaletteSelectedIndex).toHaveBeenLastCalledWith(0);
  });

  it("toggles search content filters through the shared filter helper", () => {
    const boundary = createBoundary();
    const { result } = renderHook(() =>
      useAppShellSearchAndComposerSection(boundary),
    );

    act(() => {
      result.current.handleToggleSearchContentFilter("files");
    });

    const updater = vi.mocked(boundary.setSearchContentFilters).mock
      .calls[0][0] as (previous: SearchContentFilter[]) => SearchContentFilter[];
    expect(updater(["all"])).toEqual(["files"]);
    expect(updater(["files"])).toEqual(["all"]);
    expect(boundary.setSearchPaletteSelectedIndex).toHaveBeenCalledWith(0);
  });

  it("opens file, thread, kanban, and history search results without domain input", () => {
    const boundary = createBoundary();
    const { result } = renderHook(() =>
      useAppShellSearchAndComposerSection(boundary),
    );

    const openResult = (searchResult: SearchResult) => {
      act(() => {
        result.current.handleSelectSearchResult(searchResult);
      });
    };

    openResult({
      id: "file-result",
      kind: "file",
      title: "File",
      score: 1,
      filePath: "src/file.ts",
    });
    expect(boundary.handleOpenFile).toHaveBeenCalledWith("src/file.ts");

    openResult({
      id: "thread-result",
      kind: "thread",
      title: "Thread",
      score: 1,
      workspaceId: "workspace-1",
      threadId: "thread-2",
    });
    expect(boundary.setSelectedDiffPath).toHaveBeenCalledWith(null);
    expect(boundary.selectWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(boundary.setActiveThreadId).toHaveBeenCalledWith(
      "thread-2",
      "workspace-1",
    );

    openResult({
      id: "kanban-result",
      kind: "kanban",
      title: "Task",
      score: 1,
      taskId: "task-1",
    });
    expect(boundary.setAppMode).toHaveBeenCalledWith("kanban");
    expect(boundary.setSelectedKanbanTaskId).toHaveBeenCalledWith("task-1");
    expect(boundary.setKanbanViewState).toHaveBeenCalledWith({
      view: "board",
      workspaceId: "/tmp/workspace-kanban",
      panelId: "todo",
    });

    openResult({
      id: "history-result",
      kind: "history",
      title: "History",
      score: 1,
      historyText: "previous prompt",
    });
    expect(boundary.handleDraftChange).toHaveBeenCalledWith("previous prompt");
    expect(boundary.setIsSearchPaletteOpen).toHaveBeenCalledWith(false);
  });

  it("keeps hot callbacks stable when selected field inputs are unchanged", () => {
    const boundary = createBoundary();
    const { result, rerender } = renderHook(
      ({ input }) => useAppShellSearchAndComposerSection(input),
      { initialProps: { input: boundary } },
    );
    const previousToggle = result.current.handleToggleSearchPalette;
    const previousSelect = result.current.handleSelectSearchResult;

    rerender({ input: { ...boundary } });

    expect(result.current.handleToggleSearchPalette).toBe(previousToggle);
    expect(result.current.handleSelectSearchResult).toBe(previousSelect);
  });
});
