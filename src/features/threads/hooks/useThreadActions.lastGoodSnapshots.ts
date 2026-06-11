import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { ThreadSummary } from "../../../types";
import type { WorkspaceSessionCatalogSourceStatus } from "../../../services/tauri";
import { hasHealthyThreadSummaries } from "./useThreadActions.helpers";
import { inferThreadEngineSource } from "./useThreadActions.helpers";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";

export type ThreadEngineSource = NonNullable<ThreadSummary["engineSource"]>;
export type LastGoodThreadSummariesByEngine = Partial<
  Record<ThreadEngineSource, ThreadSummary[]>
>;

export const THREAD_ENGINE_SOURCES: ThreadEngineSource[] = [
  "codex",
  "claude",
  "opencode",
  "gemini",
];

export function findCatalogSourceStatusForEngine(
  sourceStatuses: readonly WorkspaceSessionCatalogSourceStatus[] | undefined,
  engine: string,
): WorkspaceSessionCatalogSourceStatus | null {
  const normalizedEngine = engine.trim().toLowerCase();
  if (!normalizedEngine) {
    return null;
  }
  const matching =
    sourceStatuses?.filter(
      (status) => status.engine.trim().toLowerCase() === normalizedEngine,
    ) ?? [];
  return matching.sort(
    (left, right) =>
      sourceCompletenessPriority(right.completeness) -
      sourceCompletenessPriority(left.completeness),
  )[0] ?? null;
}

function sourceCompletenessPriority(
  completeness: WorkspaceSessionCatalogSourceStatus["completeness"] | undefined,
): number {
  switch (completeness) {
    case "degraded":
      return 4;
    case "partial":
      return 3;
    case "uncertain_empty":
      return 2;
    case "complete":
      return 1;
    case "authoritative_empty":
      return 0;
    default:
      return -1;
  }
}

export function isIncompleteCatalogSourceStatus(
  sourceStatus: WorkspaceSessionCatalogSourceStatus | null,
): boolean {
  return (
    sourceStatus?.completeness === "degraded" ||
    sourceStatus?.completeness === "partial" ||
    sourceStatus?.completeness === "uncertain_empty"
  );
}

export function hasAuthoritativeCatalogMembershipProof(
  sourceStatuses: readonly WorkspaceSessionCatalogSourceStatus[] | undefined,
): boolean {
  return (
    Array.isArray(sourceStatuses) &&
    sourceStatuses.length > 0 &&
    sourceStatuses.every(
      (sourceStatus) => !isIncompleteCatalogSourceStatus(sourceStatus),
    )
  );
}

function resolveThreadSummaryEngine(
  summary: ThreadSummary,
): ThreadEngineSource {
  return (summary.engineSource ??
    inferThreadEngineSource(summary.id, summary) ??
    "codex") as ThreadEngineSource;
}

function isHealthyThreadSummary(summary: ThreadSummary): boolean {
  return !summary.isDegraded && !summary.partialSource && !summary.degradedReason;
}

export function healthyThreadSummariesForEngine(
  threads: ThreadSummary[] | undefined,
  engine: ThreadEngineSource,
): ThreadSummary[] {
  if (!Array.isArray(threads) || threads.length === 0) {
    return [];
  }
  const engineThreads = threads.filter(
    (thread) => resolveThreadSummaryEngine(thread) === engine,
  );
  if (
    engineThreads.length === 0 ||
    engineThreads.some((thread) => !isHealthyThreadSummary(thread))
  ) {
    return [];
  }
  return engineThreads;
}

export function flattenLastGoodEngineSnapshots(
  snapshots: LastGoodThreadSummariesByEngine,
): ThreadSummary[] {
  const mergedById = new Map<string, ThreadSummary>();
  THREAD_ENGINE_SOURCES.forEach((engine) => {
    snapshots[engine]?.forEach((summary) => {
      const previous = mergedById.get(summary.id);
      if (!previous || summary.updatedAt >= previous.updatedAt) {
        mergedById.set(summary.id, summary);
      }
    });
  });
  return Array.from(mergedById.values()).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

function resolvePartialSourceEngine(
  source: string,
): ThreadEngineSource | "all" | null {
  const normalized = source.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("archive") || normalized.includes("empty-thread-list")) {
    return "all";
  }
  if (normalized.includes("claude")) {
    return "claude";
  }
  if (normalized.includes("opencode")) {
    return "opencode";
  }
  if (normalized.includes("gemini")) {
    return "gemini";
  }
  if (
    normalized.includes("codex") ||
    normalized.includes("workspace-not-connected") ||
    normalized.includes("thread-list-live")
  ) {
    return "codex";
  }
  return "all";
}

export function buildLastGoodSnapshotBlockedEngines(
  sourceStatuses: readonly WorkspaceSessionCatalogSourceStatus[] | undefined,
  partialSources: ReadonlySet<string>,
): Set<ThreadEngineSource> {
  const blocked = new Set<ThreadEngineSource>();
  sourceStatuses?.forEach((sourceStatus) => {
    const engine = sourceStatus.engine.trim().toLowerCase() as ThreadEngineSource;
    if (
      THREAD_ENGINE_SOURCES.includes(engine) &&
      isIncompleteCatalogSourceStatus(sourceStatus)
    ) {
      blocked.add(engine);
    }
  });
  partialSources.forEach((partialSource) => {
    const engine = resolvePartialSourceEngine(partialSource);
    if (engine === "all") {
      THREAD_ENGINE_SOURCES.forEach((item) => blocked.add(item));
    } else if (engine) {
      blocked.add(engine);
    }
  });
  return blocked;
}

export function useThreadActionsLastGoodSnapshots({
  latestThreadsByWorkspaceRef,
  previousThreadsByWorkspaceRef,
  lastGoodThreadSummariesByWorkspaceEngineRef,
  threadsByWorkspace,
}: {
  latestThreadsByWorkspaceRef: MutableRefObject<Record<string, ThreadSummary[]>>;
  previousThreadsByWorkspaceRef: MutableRefObject<Record<string, ThreadSummary[]>>;
  lastGoodThreadSummariesByWorkspaceEngineRef: MutableRefObject<
    Record<string, LastGoodThreadSummariesByEngine>
  >;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
}) {
  const getLastGoodThreadSummaries = useCallback(
    (workspaceId: string): ThreadSummary[] => {
      const currentThreads = latestThreadsByWorkspaceRef.current[workspaceId];
      if (hasHealthyThreadSummaries(currentThreads)) {
        return currentThreads;
      }
      const previousThreads =
        previousThreadsByWorkspaceRef.current[workspaceId];
      if (hasHealthyThreadSummaries(previousThreads)) {
        return previousThreads;
      }
      const stateThreads = threadsByWorkspace[workspaceId];
      if (hasHealthyThreadSummaries(stateThreads)) {
        return stateThreads;
      }
      const snapshotThreads =
        loadSidebarSnapshot()?.threadsByWorkspace[workspaceId];
      if (hasHealthyThreadSummaries(snapshotThreads)) {
        return snapshotThreads;
      }
      const snapshots: LastGoodThreadSummariesByEngine = {};
      const candidateSources = [
        currentThreads,
        previousThreads,
        stateThreads,
        snapshotThreads,
      ];
      for (const engine of THREAD_ENGINE_SOURCES) {
        const healthyEngineThreads = candidateSources
          .map((threads) => healthyThreadSummariesForEngine(threads, engine))
          .find((threads) => threads.length > 0);
        snapshots[engine] =
          healthyEngineThreads ??
          lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId]?.[
            engine
          ];
      }
      return flattenLastGoodEngineSnapshots(snapshots);
    },
    [
      latestThreadsByWorkspaceRef,
      previousThreadsByWorkspaceRef,
      lastGoodThreadSummariesByWorkspaceEngineRef,
      threadsByWorkspace,
    ],
  );

  const getLastGoodThreadSummariesForEngine = useCallback(
    (workspaceId: string, engine: ThreadEngineSource): ThreadSummary[] => {
      const currentThreads = latestThreadsByWorkspaceRef.current[workspaceId];
      const previousThreads =
        previousThreadsByWorkspaceRef.current[workspaceId];
      const stateThreads = threadsByWorkspace[workspaceId];
      const snapshotThreads =
        loadSidebarSnapshot()?.threadsByWorkspace[workspaceId];
      return (
        [
          currentThreads,
          previousThreads,
          stateThreads,
          snapshotThreads,
        ]
          .map((threads) => healthyThreadSummariesForEngine(threads, engine))
          .find((threads) => threads.length > 0) ??
        lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId]?.[
          engine
        ] ??
        []
      );
    },
    [
      latestThreadsByWorkspaceRef,
      previousThreadsByWorkspaceRef,
      lastGoodThreadSummariesByWorkspaceEngineRef,
      threadsByWorkspace,
    ],
  );

  const rememberLastGoodThreadSummariesByEngine = useCallback(
    (
      workspaceId: string,
      summaries: ThreadSummary[],
      blockedEngines: ReadonlySet<ThreadEngineSource>,
    ) => {
      const currentSnapshots =
        lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId] ?? {};
      const nextSnapshots: LastGoodThreadSummariesByEngine = {
        ...currentSnapshots,
      };
      let changed = false;
      for (const engine of THREAD_ENGINE_SOURCES) {
        if (blockedEngines.has(engine)) {
          continue;
        }
        const healthyEngineThreads = healthyThreadSummariesForEngine(
          summaries,
          engine,
        );
        if (healthyEngineThreads.length === 0) {
          continue;
        }
        nextSnapshots[engine] = healthyEngineThreads;
        changed = true;
      }
      if (!changed) {
        return;
      }
      lastGoodThreadSummariesByWorkspaceEngineRef.current = {
        ...lastGoodThreadSummariesByWorkspaceEngineRef.current,
        [workspaceId]: nextSnapshots,
      };
    },
    [lastGoodThreadSummariesByWorkspaceEngineRef],
  );

  const removeThreadFromCachedSummaries = useCallback(
    (workspaceId: string, threadId: string) => {
      const filterOutThread = (
        source: Record<string, ThreadSummary[] | undefined>,
      ): ThreadSummary[] => {
        const current = source[workspaceId] ?? [];
        return current.filter((entry) => entry.id !== threadId);
      };
      latestThreadsByWorkspaceRef.current = {
        ...latestThreadsByWorkspaceRef.current,
        [workspaceId]: filterOutThread(latestThreadsByWorkspaceRef.current),
      };
      previousThreadsByWorkspaceRef.current = {
        ...previousThreadsByWorkspaceRef.current,
        [workspaceId]: filterOutThread(previousThreadsByWorkspaceRef.current),
      };
      const currentSnapshots =
        lastGoodThreadSummariesByWorkspaceEngineRef.current[workspaceId];
      if (!currentSnapshots) {
        return;
      }
      const nextSnapshots: LastGoodThreadSummariesByEngine = {};
      THREAD_ENGINE_SOURCES.forEach((engine) => {
        const nextEngineThreads = (currentSnapshots[engine] ?? []).filter(
          (entry) => entry.id !== threadId,
        );
        if (nextEngineThreads.length > 0) {
          nextSnapshots[engine] = nextEngineThreads;
        }
      });
      lastGoodThreadSummariesByWorkspaceEngineRef.current = {
        ...lastGoodThreadSummariesByWorkspaceEngineRef.current,
        [workspaceId]: nextSnapshots,
      };
    },
    [
      latestThreadsByWorkspaceRef,
      previousThreadsByWorkspaceRef,
      lastGoodThreadSummariesByWorkspaceEngineRef,
    ],
  );

  return {
    getLastGoodThreadSummaries,
    getLastGoodThreadSummariesForEngine,
    rememberLastGoodThreadSummariesByEngine,
    removeThreadFromCachedSummaries,
  };
}
