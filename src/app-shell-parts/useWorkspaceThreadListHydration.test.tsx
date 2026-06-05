// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../types";
import {
  getStartupTraceSnapshot,
  resetStartupTraceForTests,
} from "../features/startup-orchestration/utils/startupTrace";
import { useWorkspaceThreadListHydration } from "./useWorkspaceThreadListHydration";

let restoreIdleCallbackForTest: (() => void) | null = null;

function createWorkspace(id: string): WorkspaceInfo {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
  };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function installImmediateIdleCallback() {
  restoreIdleCallbackForTest?.();
  const previousRequestIdleCallback = window.requestIdleCallback;
  const previousCancelIdleCallback = window.cancelIdleCallback;
  window.requestIdleCallback = ((callback: IdleRequestCallback) => {
    const timeoutId = window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    }, 0);
    return timeoutId;
  }) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = ((handle: number) => {
    window.clearTimeout(handle);
  }) as typeof window.cancelIdleCallback;
  restoreIdleCallbackForTest = () => {
    window.requestIdleCallback = previousRequestIdleCallback;
    window.cancelIdleCallback = previousCancelIdleCallback;
    restoreIdleCallbackForTest = null;
  };
  return restoreIdleCallbackForTest;
}

describe("useWorkspaceThreadListHydration", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetStartupTraceForTests();
  });

  afterEach(() => {
    restoreIdleCallbackForTest?.();
  });

  it("progresses to the next background workspace after the current hydration attempt settles", async () => {
    const restoreIdleCallback = installImmediateIdleCallback();
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    const deferredFirst = createDeferred();
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: {
            preserveState?: boolean;
            includeOpenCodeSessions?: boolean;
            startupHydrationMode?: "full-catalog";
          },
        ) => Promise<void>
      >()
      .mockImplementationOnce(async () => {
        await deferredFirst.promise;
      })
      .mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: null,
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    expect(listThreadsForWorkspace).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(
      workspaces[0],
      expect.objectContaining({
        preserveState: true,
        startupHydrationMode: "full-catalog",
      }),
    );
    expect(listThreadsForWorkspace).not.toHaveBeenCalledWith(
      workspaces[1],
      expect.anything(),
    );

    deferredFirst.resolve();

    await act(async () => {
      await deferredFirst.promise;
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
      expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
        2,
        workspaces[1],
        expect.objectContaining({
          preserveState: true,
          startupHydrationMode: "full-catalog",
        }),
      );
    });
    restoreIdleCallback();
  });

  it("routes active workspace hydration as full catalog before idle background hydration", async () => {
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-2",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[1],
        expect.objectContaining({
          preserveState: true,
          startupHydrationMode: "full-catalog",
        }),
      );
    });

    const taskEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:full-catalog:ws-2",
    );
    expect(taskEvents.some((event) => event.phase === "active-workspace")).toBe(true);
    expect(getStartupTraceSnapshot().milestones["active-workspace-ready"]).toBeTruthy();
  });

  it("keeps manual tracked refreshes on full-catalog even for the active workspace", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({
          startupHydrationMode: "full-catalog",
        }),
      );
    });

    await act(async () => {
      await result.current.listThreadsForWorkspaceTracked(workspaces[0]!);
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
    });
    expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
      2,
      workspaces[0],
      expect.objectContaining({
        startupHydrationMode: "full-catalog",
      }),
    );

    const fullCatalogEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:full-catalog:ws-1",
    );
    expect(fullCatalogEvents.some((event) => event.phase === "on-demand")).toBe(true);
  });

  it("does not run a second full-catalog hydration after active startup succeeds", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({
          startupHydrationMode: "full-catalog",
        }),
      );
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);

    const fullCatalogEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:full-catalog:ws-1",
    );
    expect(fullCatalogEvents.some((event) => event.phase === "active-workspace")).toBe(true);
  });

  it("prioritizes active full-catalog hydration before unrelated idle workspaces", async () => {
    const restoreIdleCallback = installImmediateIdleCallback();
    const workspaces = [createWorkspace("ws-older"), createWorkspace("ws-active")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-active",
        activeWorkspaceProjectionOwnerIds: ["ws-active"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });
    expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
      1,
      workspaces[1],
      expect.objectContaining({ startupHydrationMode: "full-catalog" }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
    });
    expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
      2,
      workspaces[0],
      expect.objectContaining({ startupHydrationMode: "full-catalog" }),
    );
    restoreIdleCallback();
  });

  it("retries full-catalog hydration when the previous result was discarded as stale", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void | { applied?: boolean; stale?: boolean }>
    >()
      .mockResolvedValueOnce({ applied: false, stale: true })
      .mockResolvedValueOnce({ applied: true });

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
    });
    expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
      1,
      workspaces[0],
      expect.objectContaining({ startupHydrationMode: "full-catalog" }),
    );
    expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
      2,
      workspaces[0],
      expect.objectContaining({ startupHydrationMode: "full-catalog" }),
    );
  });

  it("routes session radar prewarm as an idle full-catalog task", async () => {
    const restoreIdleCallback = installImmediateIdleCallback();
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: null,
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    result.current.prewarmSessionRadarForWorkspace("ws-1");
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({
          includeOpenCodeSessions: false,
          preserveState: true,
          startupHydrationMode: "full-catalog",
        }),
      );
    });

    const taskEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:session-radar:ws-1",
    );
    expect(taskEvents.some((event) => event.phase === "idle-prewarm")).toBe(true);
    restoreIdleCallback();
  });

  it("does not start session radar prewarm while workspace hydration is in flight", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const activeHydration = createDeferred();
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog";
        },
      ) => Promise<void>
    >().mockImplementationOnce(async () => activeHydration.promise);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    result.current.prewarmSessionRadarForWorkspace("ws-1");
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);

    activeHydration.resolve();
    await act(async () => {
      await activeHydration.promise;
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
  });
});
