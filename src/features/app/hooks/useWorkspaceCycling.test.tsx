// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import type { ThreadSummary, WorkspaceInfo } from "../../../types";
import { useWorkspaceCycling } from "./useWorkspaceCycling";

function makeWorkspace(id: string): WorkspaceInfo {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
  };
}

function makeThread(id: string): ThreadSummary {
  return {
    id,
    name: id,
    updatedAt: 1,
  };
}

function makeRef<T>(current: T): MutableRefObject<T> {
  return { current };
}

function makeProps(
  overrides: Partial<Parameters<typeof useWorkspaceCycling>[0]> = {},
) {
  const workspace = makeWorkspace("ws-1");
  return {
    workspaces: [workspace],
    groupedWorkspaces: [{ workspaces: [workspace] }],
    threadsByWorkspace: {
      "ws-1": [makeThread("thread-1"), makeThread("thread-2")],
    },
    getThreadRows: (threads: ThreadSummary[]) => ({
      pinnedRows: [],
      unpinnedRows: threads.map((thread) => ({ thread })),
    }),
    getPinTimestamp: vi.fn(),
    activeWorkspaceIdRef: makeRef<string | null>("ws-1"),
    activeThreadIdRef: makeRef<string | null>("thread-1"),
    activeEditorFilePath: null,
    centerMode: "chat" as const,
    exitDiffView: vi.fn(),
    isCompact: false,
    resetPullRequestSelection: vi.fn(),
    selectWorkspace: vi.fn(),
    setActiveThreadId: vi.fn(),
    setSelectedDiffPath: vi.fn(),
    ...overrides,
  };
}

describe("useWorkspaceCycling", () => {
  it("does not exit the editor when cycling sessions in the same desktop workspace", () => {
    const props = makeProps({
      activeEditorFilePath: "src/App.tsx",
      centerMode: "editor",
    });
    const { result } = renderHook(() => useWorkspaceCycling(props));

    act(() => {
      result.current.handleCycleAgent("next");
    });

    expect(props.setSelectedDiffPath).toHaveBeenCalledWith(null);
    expect(props.exitDiffView).not.toHaveBeenCalled();
    expect(props.setActiveThreadId).toHaveBeenCalledWith("thread-2", "ws-1");
  });

  it("keeps the existing chat fallback when no editor file is active", () => {
    const props = makeProps({
      centerMode: "editor",
      activeEditorFilePath: null,
    });
    const { result } = renderHook(() => useWorkspaceCycling(props));

    act(() => {
      result.current.handleCycleAgent("next");
    });

    expect(props.exitDiffView).toHaveBeenCalledTimes(1);
    expect(props.setSelectedDiffPath).not.toHaveBeenCalled();
    expect(props.setActiveThreadId).toHaveBeenCalledWith("thread-2", "ws-1");
  });
});
