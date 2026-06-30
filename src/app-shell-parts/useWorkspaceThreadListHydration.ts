import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRenderScheduler } from "../hooks/useRenderScheduler";
import type { MutableRefObject } from "react";
import type { WorkspaceInfo } from "../types";
import {
  startupOrchestrator,
  type StartupTaskDescriptor,
} from "../features/startup-orchestration/utils/startupOrchestrator";
import {
  getStartupTraceSnapshot,
  recordStartupMilestone,
  type StartupMilestoneName,
} from "../features/startup-orchestration/utils/startupTrace";
import {
  resolveNextWorkspaceThreadListHydrationId,
  shouldSkipWorkspaceThreadListLoad,
} from "./workspaceThreadListLoadGuard";

type ListThreadsForWorkspace = (
  workspace: WorkspaceInfo,
  options?: {
    preserveState?: boolean;
    includeOpenCodeSessions?: boolean;
    deletedThreadIds?: string[];
    startupHydrationMode?: "full-catalog";
    allowRuntimeReconnect?: boolean;
  },
) => Promise<void | { applied?: boolean; stale?: boolean }>;

type UseWorkspaceThreadListHydrationOptions = {
  activeWorkspaceId: string | null;
  activeWorkspaceProjectionOwnerIds: readonly string[];
  listThreadsForWorkspace: ListThreadsForWorkspace;
  threadListLoadingByWorkspace: Record<string, boolean>;
  workspaces: WorkspaceInfo[];
  workspacesById: Map<string, WorkspaceInfo>;
};

type UseWorkspaceThreadListHydrationResult = {
  ensureWorkspaceThreadListLoaded: (
    workspaceId: string,
    options?: {
      preserveState?: boolean;
      force?: boolean;
      deletedThreadIds?: string[];
    },
  ) => void;
  hydratedThreadListWorkspaceIdsRef: MutableRefObject<Set<string>>;
  listThreadsForWorkspaceTracked: ListThreadsForWorkspace;
  prewarmSessionRadarForWorkspace: (workspaceId: string) => void;
};

type ThreadHydrationPhase = "active-workspace" | "idle-prewarm" | "on-demand";
type ThreadHydrationKind = "full-catalog" | "session-radar";
function isDiscardedStaleHydrationResult(
  result: ThreadListHydrationResult,
): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    result.applied === false &&
    result.stale === true
  );
}

function hasRecordedActiveWorkspaceReady() {
  return Boolean(
    getStartupTraceSnapshot().milestones[ACTIVE_WORKSPACE_READY_MILESTONE],
  );
}

function createThreadHydrationTask(
  workspace: WorkspaceInfo,
  phase: ThreadHydrationPhase,
  kind: ThreadHydrationKind,
  run: () => Promise<ThreadListHydrationResult>,
): StartupTaskDescriptor<ThreadListHydrationResult> {
  const dedupeKey = `thread-list:${kind}:${workspace.id}`;
  return {
    id: `thread-list:${kind}:${workspace.id}`,
    phase,
    priority:
      phase === "active-workspace"
        ? 90
        : phase === "on-demand"
          ? 85
          : kind === "session-radar"
            ? 30
            : 20,
    dedupeKey,
    concurrencyKey: "thread-session-scan",
    timeoutMs: phase === "active-workspace" ? 12_000 : 20_000,
    workspaceScope: { workspaceId: workspace.id },
    cancelPolicy: "soft-ignore",
    traceLabel:
      kind === "session-radar"
        ? "session-radar workspace prewarm"
        : `thread/list ${kind} hydration`,
    commandLabel: "list_threads",
    run,
    fallback: () => undefined,
  };
}

type ThreadListHydrationResult = void | { applied?: boolean; stale?: boolean };const ACTIVE_WORKSPACE_READY_MILESTONE: StartupMilestoneName =
  "active-workspace-ready";
const IDLE_PREWARM_DELAY_MS = 120;

export function useWorkspaceThreadListHydration({
  activeWorkspaceId,
  activeWorkspaceProjectionOwnerIds,
  listThreadsForWorkspace,
  threadListLoadingByWorkspace,
  workspaces,
  workspacesById,
}: UseWorkspaceThreadListHydrationOptions): UseWorkspaceThreadListHydrationResult {
  const hydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const fullyHydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydratingThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydrationPhaseByWorkspaceIdRef = useRef(
    new Map<string, ThreadHydrationPhase>(),
  );
  const hydrationKindByWorkspaceIdRef = useRef(
    new Map<string, ThreadHydrationKind>(),
  );
  const autoHydratedActiveWorkspaceIdRef = useRef<string | null>(null);
  const idleHydrationCleanupByWorkspaceIdRef = useRef(new Map<string, () => void>());
  const [hydrationCycle, setHydrationCycle] = useState(0);
  const renderScheduler = useRenderScheduler({
    budgetMs: 0,
    idleTimeoutMs: IDLE_PREWARM_DELAY_MS,
  });
  const scheduleIdleHydration = useCallback(
    (callback: () => void): (() => void) => {
      let cancelled = false;
      renderScheduler.scheduleChunk(() => {
        if (cancelled) {
          return false;
        }
        callback();
        return false;
      });
      return () => {
        cancelled = true;
      };
    },
    [renderScheduler],
  );

  const backgroundHydrationWorkspaces = useMemo(() => {
    const priorityIds = new Set(activeWorkspaceProjectionOwnerIds);
    if (activeWorkspaceId) {
      priorityIds.add(activeWorkspaceId);
    }
    const priorityWorkspaces: WorkspaceInfo[] = [];
    const remainingWorkspaces: WorkspaceInfo[] = [];
    workspaces.forEach((workspace) => {
      if (priorityIds.has(workspace.id)) {
        priorityWorkspaces.push(workspace);
      } else {
        remainingWorkspaces.push(workspace);
      }
    });
    return [...priorityWorkspaces, ...remainingWorkspaces];
  }, [activeWorkspaceId, activeWorkspaceProjectionOwnerIds, workspaces]);

  const listThreadsForWorkspaceTracked = useCallback<ListThreadsForWorkspace>(
    async (workspace, options) => {
      hydratingThreadListWorkspaceIdsRef.current.add(workspace.id);
      const phase =
        hydrationPhaseByWorkspaceIdRef.current.get(workspace.id) ?? "on-demand";
      const kind =
        hydrationKindByWorkspaceIdRef.current.get(workspace.id) ??
        "full-catalog";
      let hydrationResult: ThreadListHydrationResult = undefined;
      try {
        hydrationResult = await startupOrchestrator.run(
          createThreadHydrationTask(workspace, phase, kind, () =>
            listThreadsForWorkspace(workspace, {
              ...options,
              startupHydrationMode: "full-catalog",
            allowRuntimeReconnect: false,
}),
          ),
        );
      } finally {
        const discardedAsStale =
          isDiscardedStaleHydrationResult(hydrationResult);
        if (
          !discardedAsStale &&
          phase === "active-workspace" &&
          !hasRecordedActiveWorkspaceReady()
        ) {
          recordStartupMilestone(ACTIVE_WORKSPACE_READY_MILESTONE);
        }
        if (!discardedAsStale) {
          hydratedThreadListWorkspaceIdsRef.current.add(workspace.id);
        }
        if (!discardedAsStale) {
          fullyHydratedThreadListWorkspaceIdsRef.current.add(workspace.id);
        }
        hydratingThreadListWorkspaceIdsRef.current.delete(workspace.id);
        hydrationPhaseByWorkspaceIdRef.current.delete(workspace.id);
        hydrationKindByWorkspaceIdRef.current.delete(workspace.id);
        setHydrationCycle((current) => current + 1);
      }
    },
    [listThreadsForWorkspace],
  );

  const ensureWorkspaceThreadListLoaded = useCallback(
    (
      workspaceId: string,
      options?: {
        preserveState?: boolean;
        force?: boolean;
        deletedThreadIds?: string[];
      },
    ) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      const force = options?.force ?? false;
      const isLoading = threadListLoadingByWorkspace[workspaceId] ?? false;
      const hasHydratedThreadList =
        hydratedThreadListWorkspaceIdsRef.current.has(workspaceId);
      const isHydratingThreadList =
        hydratingThreadListWorkspaceIdsRef.current.has(workspaceId);
      if (
        shouldSkipWorkspaceThreadListLoad({
          force,
          isLoading,
          isHydratingThreadList,
          hasHydratedThreadList,
        })
      ) {
        return;
      }
      const phase: ThreadHydrationPhase = force
        ? "on-demand"
        : workspaceId === activeWorkspaceId
          ? "active-workspace"
          : "idle-prewarm";
      hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, phase);
      hydrationKindByWorkspaceIdRef.current.set(workspaceId, "full-catalog");
      void listThreadsForWorkspaceTracked(workspace, {
        preserveState: options?.preserveState,
        deletedThreadIds: options?.deletedThreadIds,
      });
    },
    [
      activeWorkspaceId,
      listThreadsForWorkspaceTracked,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  const prewarmSessionRadarForWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      if (threadListLoadingByWorkspace[workspaceId] ?? false) {
        return;
      }
      if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (idleHydrationCleanupByWorkspaceIdRef.current.has(workspaceId)) {
        return;
      }
      const cleanup = scheduleIdleHydration(() => {
        idleHydrationCleanupByWorkspaceIdRef.current.delete(workspaceId);
        if (threadListLoadingByWorkspace[workspaceId] ?? false) {
          return;
        }
        if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, "idle-prewarm");
        hydrationKindByWorkspaceIdRef.current.set(workspaceId, "session-radar");
        void listThreadsForWorkspaceTracked(workspace, {
          preserveState: true,
          includeOpenCodeSessions: false,
        });
      });
      idleHydrationCleanupByWorkspaceIdRef.current.set(workspaceId, cleanup);
    },
    [
      listThreadsForWorkspaceTracked,
      scheduleIdleHydration,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  const prewarmFullCatalogForWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      if (threadListLoadingByWorkspace[workspaceId] ?? false) {
        return;
      }
      if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (idleHydrationCleanupByWorkspaceIdRef.current.has(workspaceId)) {
        return;
      }
      const cleanup = scheduleIdleHydration(() => {
        idleHydrationCleanupByWorkspaceIdRef.current.delete(workspaceId);
        if (threadListLoadingByWorkspace[workspaceId] ?? false) {
          return;
        }
        if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, "idle-prewarm");
        hydrationKindByWorkspaceIdRef.current.set(workspaceId, "full-catalog");
        void listThreadsForWorkspaceTracked(workspace, {
          preserveState: true,
        });
      });
      idleHydrationCleanupByWorkspaceIdRef.current.set(workspaceId, cleanup);
    },
    [
      listThreadsForWorkspaceTracked,
      scheduleIdleHydration,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  useEffect(() => {
    if (!activeWorkspaceId) {
      autoHydratedActiveWorkspaceIdRef.current = null;
      return;
    }
    if (autoHydratedActiveWorkspaceIdRef.current === activeWorkspaceId) {
      return;
    }
    autoHydratedActiveWorkspaceIdRef.current = activeWorkspaceId;
    ensureWorkspaceThreadListLoaded(activeWorkspaceId, { preserveState: true });
  }, [activeWorkspaceId, ensureWorkspaceThreadListLoaded]);

  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceProjectionOwnerIds.length <= 1) {
      return;
    }
    activeWorkspaceProjectionOwnerIds.forEach((workspaceId) => {
      if (workspaceId === activeWorkspaceId) {
        return;
      }
      ensureWorkspaceThreadListLoaded(workspaceId, { preserveState: true });
    });
  }, [
    activeWorkspaceId,
    activeWorkspaceProjectionOwnerIds,
    ensureWorkspaceThreadListLoaded,
  ]);

  const nextBackgroundWorkspaceThreadHydrationId =
    resolveNextWorkspaceThreadListHydrationId({
      workspaces: backgroundHydrationWorkspaces,
      activeWorkspaceProjectionOwnerIds:
        activeWorkspaceProjectionOwnerIds.filter(
          (workspaceId) => workspaceId !== activeWorkspaceId,
        ),
      hydratedWorkspaceIds: fullyHydratedThreadListWorkspaceIdsRef.current,
      hydratingWorkspaceIds: hydratingThreadListWorkspaceIdsRef.current,
      loadingByWorkspace: threadListLoadingByWorkspace,
    });

  void hydrationCycle;

  useEffect(() => {
    if (!nextBackgroundWorkspaceThreadHydrationId) {
      return;
    }
    prewarmFullCatalogForWorkspace(nextBackgroundWorkspaceThreadHydrationId);
  }, [
    nextBackgroundWorkspaceThreadHydrationId,
    prewarmFullCatalogForWorkspace,
  ]);

  useEffect(() => {
    const cleanupByWorkspaceId = idleHydrationCleanupByWorkspaceIdRef.current;
    return () => {
      cleanupByWorkspaceId.forEach((cleanup) => cleanup());
      cleanupByWorkspaceId.clear();
    };
  }, []);

  return {
    ensureWorkspaceThreadListLoaded,
    hydratedThreadListWorkspaceIdsRef,
    listThreadsForWorkspaceTracked,
    prewarmSessionRadarForWorkspace,
  };
}
