// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { getWorkspaceDirectoryChildren, getWorkspaceFiles } from "../../../services/tauri";
import type { WorkspaceFilesResponse } from "../../../services/tauri";
import {
  clearSharedWorkspaceFileIndexes,
  readSharedWorkspaceFileIndex,
} from "../utils/sharedWorkspaceFileIndex";
import { useWorkspaceFiles } from "./useWorkspaceFiles";

vi.mock("../../../services/tauri", () => ({
  getWorkspaceDirectoryChildren: vi.fn(),
  getWorkspaceFiles: vi.fn(),
}));

vi.mock("../../../services/rendererDiagnostics", () => ({
  appendWorkspaceFileListingBudgetDiagnostic: vi.fn(),
}));

const workspaceA: WorkspaceInfo = {
  id: "workspace-a",
  name: "Workspace A",
  path: "/tmp/workspace-a",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const workspaceB: WorkspaceInfo = {
  id: "workspace-b",
  name: "Workspace B",
  path: "/tmp/workspace-b",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const emptySnapshot: WorkspaceFilesResponse = {
  files: [],
  directories: [],
  gitignored_files: [],
  gitignored_directories: [],
};

function workspaceSnapshot(
  overrides: Partial<WorkspaceFilesResponse> = {},
): WorkspaceFilesResponse {
  return {
    ...emptySnapshot,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function neverResolveWorkspaceFiles() {
  return new Promise<WorkspaceFilesResponse>(() => {});
}

function flushAsyncWork() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function advanceTimersAndFlush(ms: number) {
  return act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWorkspaceFiles", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });
    vi.mocked(getWorkspaceFiles).mockReturnValue(neverResolveWorkspaceFiles());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    clearSharedWorkspaceFileIndexes();
  });

  it("loads root children without starting a full workspace scan", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValueOnce(
      workspaceSnapshot({
        files: ["README.md"],
        directories: ["src"],
        directory_entries: [{ path: "src", child_state: "unknown" }],
      }),
    );
    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        pollingEnabled: false,
      }),
    );

    expect(result.current.isLoading).toBe(true);

    await flushAsyncWork();

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledWith(workspaceA.id, "", {
      forceRefresh: false,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.files).toEqual(["README.md"]);
    expect(result.current.directories).toEqual(["src"]);
    expect(result.current.directoryMetadata).toEqual([
      { path: "src", child_state: "unknown" },
    ]);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    unmount();
  });

  it("forces a root directory refresh for manual file tree reloads", async () => {
    vi.mocked(getWorkspaceDirectoryChildren)
      .mockResolvedValueOnce(
        workspaceSnapshot({
          files: ["README.md"],
          directories: ["src"],
        }),
      )
      .mockResolvedValueOnce(
        workspaceSnapshot({
          files: ["README.md", "src/new.ts"],
          directories: ["src"],
        }),
      );

    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        pollingEnabled: false,
      }),
    );

    await flushAsyncWork();

    await act(async () => {
      await result.current.refreshFiles();
    });

    expect(getWorkspaceDirectoryChildren).toHaveBeenLastCalledWith(workspaceA.id, "", {
      forceRefresh: true,
    });
    expect(result.current.files).toEqual(["README.md", "src/new.ts"]);

    unmount();
  });

  it("clears the initial loading state after the root directory resolves", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValueOnce(
      workspaceSnapshot({
        files: ["README.md"],
        directories: ["src"],
      }),
    );

    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        pollingEnabled: false,
      }),
    );

    await flushAsyncWork();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.files).toEqual(["README.md"]);
    expect(result.current.directories).toEqual(["src"]);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    unmount();
  });

  it("retries the initial root load once after a failure and recovers file state", async () => {
    vi.mocked(getWorkspaceDirectoryChildren)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        workspaceSnapshot({
          files: ["src/app.tsx"],
          directories: ["src"],
        }),
      );

    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        pollingEnabled: false,
      }),
    );

    await flushAsyncWork();

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(1);
    expect(result.current.files).toEqual([]);
    expect(result.current.loadError).toBe("network down");

    await advanceTimersAndFlush(1_500);

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);
    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(result.current.directories).toEqual(["src"]);
    expect(result.current.loadError).toBeNull();

    unmount();
  });

  it("falls back to a root-only legacy snapshot when the root query fails before any snapshot exists", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return Promise.reject(new Error("Directory path cannot be empty."));
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["docs/guide.md"],
            directories: ["docs"],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });
    vi.mocked(getWorkspaceFiles).mockResolvedValueOnce(
      workspaceSnapshot({
        files: ["README.md", "src/app.tsx", "src\\windows.ts"],
        directories: ["src", "src/components", "src\\windows-components"],
        directory_entries: [
          { path: "src", child_state: "loaded" },
          { path: "src/components", child_state: "loaded" },
          { path: "src\\windows-components", child_state: "loaded" },
        ],
      }),
    );

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledWith(workspaceA.id, "", {
      forceRefresh: false,
    });
    expect(getWorkspaceFiles).toHaveBeenCalledWith(workspaceA.id, {
      forceRefresh: false,
    });
    expect(result.current.files).toEqual(["README.md"]);
    expect(result.current.directories).toEqual(["src"]);
    expect(result.current.directoryMetadata).toEqual([{ path: "src", child_state: "loaded" }]);
    expect(result.current.loadError).toBeNull();
    expect(result.current.isLoading).toBe(false);

    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();
    expect(result.current.files).toEqual(["docs/guide.md"]);

    rerender({ activeWorkspace: workspaceA });

    expect(result.current.files).toEqual(["README.md"]);
    expect(result.current.directories).toEqual(["src"]);
    expect(result.current.directoryMetadata).toEqual([{ path: "src", child_state: "loaded" }]);
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("keeps the error state when both root query and fallback snapshot fail", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockRejectedValueOnce(
      new Error("Directory path cannot be empty."),
    );
    vi.mocked(getWorkspaceFiles).mockRejectedValueOnce(new Error("full failed"));

    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        pollingEnabled: false,
      }),
    );

    await flushAsyncWork();

    expect(getWorkspaceFiles).toHaveBeenCalledWith(workspaceA.id, {
      forceRefresh: false,
    });
    expect(result.current.files).toEqual([]);
    expect(result.current.loadError).toBe("Directory path cannot be empty.");
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it("defers all file loading when initial loading is disabled", async () => {
    const { rerender, result, unmount } = renderHook(
      ({ initialLoadEnabled }: { initialLoadEnabled: boolean }) =>
        useWorkspaceFiles({
          activeWorkspace: workspaceA,
          initialLoadEnabled,
          pollingEnabled: false,
        }),
      {
        initialProps: { initialLoadEnabled: false },
      },
    );

    await flushAsyncWork();

    expect(getWorkspaceDirectoryChildren).not.toHaveBeenCalled();
    expect(getWorkspaceFiles).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.files).toEqual([]);

    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValueOnce(
      workspaceSnapshot({
        files: ["src/app.tsx"],
        directories: ["src"],
      }),
    );
    rerender({ initialLoadEnabled: true });
    await flushAsyncWork();

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledWith(workspaceA.id, "", {
      forceRefresh: false,
    });
    expect(result.current.files).toEqual(["src/app.tsx"]);

    unmount();
  });

  it("keeps polling shallow instead of scheduling repeated full scans", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValue(
      workspaceSnapshot({
        files: ["src/app.tsx"],
        directories: ["src"],
      }),
    );

    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        initialLoadEnabled: true,
        pollingEnabled: true,
      }),
    );

    await flushAsyncWork();

    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(1);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    await advanceTimersAndFlush(30_000);

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    unmount();
  });

  it("does not clear a loaded snapshot when the same workspace briefly disconnects", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValue(
      workspaceSnapshot({
        files: ["src/app.tsx"],
        directories: ["src"],
      }),
    );

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(result.current.isLoading).toBe(false);

    rerender({ activeWorkspace: { ...workspaceA, connected: false } });
    await flushAsyncWork();

    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(result.current.isLoading).toBe(false);
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("does not start full workspace scans while switching workspaces", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["src/app.tsx"],
            directories: ["src"],
          }),
        );
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["docs/guide.md"],
            directories: ["docs"],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();
    expect(result.current.files).toEqual(["docs/guide.md"]);

    await advanceTimersAndFlush(2_500);

    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    unmount();
  });

  it("renders cached root data immediately when switching back to a workspace", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["src/app.tsx"],
            directories: ["src"],
          }),
        );
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["docs/guide.md"],
            directories: ["docs"],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    expect(result.current.files).toEqual(["src/app.tsx"]);

    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();
    expect(result.current.files).toEqual(["docs/guide.md"]);

    rerender({ activeWorkspace: workspaceA });

    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(result.current.isLoading).toBe(false);
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    unmount();
  });

  it("reuses an in-flight root request when switching back before it resolves", async () => {
    const workspaceARoot = createDeferred<WorkspaceFilesResponse>();
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return workspaceARoot.promise;
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["docs/guide.md"],
            directories: ["docs"],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();
    rerender({ activeWorkspace: workspaceA });
    await flushAsyncWork();

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      workspaceARoot.resolve(
        workspaceSnapshot({
          files: ["src/app.tsx"],
          directories: ["src"],
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(result.current.isLoading).toBe(false);
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("caches stale root responses and reuses them on a later workspace switch", async () => {
    const workspaceARoot = createDeferred<WorkspaceFilesResponse>();
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return workspaceARoot.promise;
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["docs/guide.md"],
            directories: ["docs"],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();

    await act(async () => {
      workspaceARoot.resolve(
        workspaceSnapshot({
          files: ["src/app.tsx"],
          directories: ["src"],
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.files).toEqual(["docs/guide.md"]);

    rerender({ activeWorkspace: workspaceA });

    expect(result.current.files).toEqual(["src/app.tsx"]);
    expect(result.current.isLoading).toBe(false);
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("ignores stale root responses from the previous workspace after a fast switch", async () => {
    const workspaceARoot = createDeferred<WorkspaceFilesResponse>();
    const workspaceBRoot = createDeferred<WorkspaceFilesResponse>();
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return workspaceARoot.promise;
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return workspaceBRoot.promise;
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(1);

    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();
    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(2);

    await act(async () => {
      workspaceBRoot.resolve(
        workspaceSnapshot({
          files: ["docs/guide.md"],
          directories: ["docs"],
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.files).toEqual(["docs/guide.md"]);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    await act(async () => {
      workspaceARoot.resolve(
        workspaceSnapshot({
          files: ["src/app.tsx"],
          directories: ["src"],
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.files).toEqual(["docs/guide.md"]);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();

    await advanceTimersAndFlush(2_500);

    expect(result.current.files).toEqual(["docs/guide.md"]);
    expect(result.current.directories).toEqual(["docs"]);
    expect(result.current.loadError).toBeNull();

    unmount();
  });

  it("ignores stale root failures from the previous workspace after a fast switch", async () => {
    const workspaceARoot = createDeferred<WorkspaceFilesResponse>();
    vi.mocked(getWorkspaceDirectoryChildren).mockImplementation((requestedWorkspaceId) => {
      if (requestedWorkspaceId === workspaceA.id) {
        return workspaceARoot.promise;
      }
      if (requestedWorkspaceId === workspaceB.id) {
        return Promise.resolve(
          workspaceSnapshot({
            files: ["docs/guide.md"],
            directories: ["docs"],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected workspace: ${requestedWorkspaceId}`));
    });

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();
    rerender({ activeWorkspace: workspaceB });
    await flushAsyncWork();

    await act(async () => {
      workspaceARoot.reject(new Error("stale failure"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.files).toEqual(["docs/guide.md"]);
    expect(result.current.loadError).toBeNull();

    unmount();
  });

  it("normalizes progressive scan metadata and clears it on workspace switch", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValue(
      workspaceSnapshot({
        files: [],
        directories: ["packages/large"],
        scan_state: "partial",
        limit_hit: true,
        directory_entries: [
          {
            path: "packages/large",
            child_state: "unknown",
            has_more: true,
          },
        ],
      }),
    );

    const { rerender, result, unmount } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace,
          pollingEnabled: false,
        }),
      {
        initialProps: { activeWorkspace: workspaceA },
      },
    );

    await flushAsyncWork();

    expect(result.current.scanState).toBe("partial");
    expect(result.current.limitHit).toBe(true);
    expect(result.current.directoryMetadata).toEqual([
      {
        path: "packages/large",
        child_state: "unknown",
        has_more: true,
      },
    ]);

    rerender({ activeWorkspace: workspaceB });

    expect(result.current.scanState).toBe("complete");
    expect(result.current.limitHit).toBe(false);
    expect(result.current.directoryMetadata).toEqual([]);

    unmount();
  });

  it("publishes source version metadata to the shared file index", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValue(
      workspaceSnapshot({
        files: ["src/app.tsx"],
        directories: ["src"],
        scan_state: "complete",
        limit_hit: false,
        sourceVersion: "source-v1",
        listingBudget: {
          depth: 2,
          maxEntries: 2000,
          returnedEntries: 2,
          payloadBytes: 512,
          sourceVersion: "source-v1",
          scanState: "complete",
          limitHit: false,
          cacheState: "unsupported",
          requestedPath: null,
          partial: false,
          pageCursor: null,
        },
      }),
    );

    const { result, unmount } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: workspaceA,
        pollingEnabled: false,
      }),
    );

    await flushAsyncWork();

    expect(result.current.sourceVersion).toBe("source-v1");
    expect(readSharedWorkspaceFileIndex({
      workspaceId: workspaceA.id,
      sourceVersion: "source-v1",
    })?.files.map((entry) => entry.path)).toEqual(["src/app.tsx"]);

    unmount();
  });
});
