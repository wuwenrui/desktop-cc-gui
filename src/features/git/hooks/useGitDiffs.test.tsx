// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitFileStatus, WorkspaceInfo } from "../../../types";
import { getGitDiffs } from "../../../services/tauri";
import { useGitDiffs } from "./useGitDiffs";

vi.mock("../../../services/tauri", () => ({
  getGitDiffs: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Plain Folder",
  path: "/tmp/plain-folder",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const changedFiles: GitFileStatus[] = [
  {
    path: "src/main.ts",
    status: "M",
    additions: 1,
    deletions: 0,
  },
];

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useGitDiffs", () => {
  beforeEach(() => {
    vi.mocked(getGitDiffs).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not scan diffs when workspace is known to be non-git", async () => {
    const { result } = renderHook(() =>
      useGitDiffs(workspace, changedFiles, true, false),
    );

    await flushPromises();

    expect(getGitDiffs).not.toHaveBeenCalled();
    expect(result.current.diffs).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("treats non-git diff failures as empty diffs without error noise", async () => {
    vi.mocked(getGitDiffs).mockRejectedValue(
      new Error("fatal: not a git repository (or any of the parent directories): .git"),
    );
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useGitDiffs(workspace, changedFiles, true, true),
    );

    await flushPromises();

    expect(getGitDiffs).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(result.current.diffs).toEqual([]);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });

    expect(getGitDiffs).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });
});
