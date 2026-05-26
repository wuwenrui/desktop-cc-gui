import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EngineType, WorkspaceInfo } from "../../../types";
import { projectMemoryList } from "../../../services/tauri/projectMemory";
import type {
  ProjectMapDataset,
  ProjectMapGenerationRequest,
  ProjectMapNode,
  ProjectMapStorageLocation,
  ProjectMapRunMetadata,
} from "../types";
import {
  createEmptyProjectMapDataset,
  readProjectMapDataset,
  writeProjectMapDataset,
} from "../services/projectMapPersistence";
import {
  runProjectMapGenerationWorker,
  type ProjectMapRunUpdate,
} from "../services/projectMapGenerationWorker";
import {
  createProjectMapGenerationRequest,
  createRunMetadataFromRequest,
} from "../utils/generationRequests";
import {
  confirmProjectMapCandidate,
  rejectProjectMapCandidate,
} from "../utils/candidates";
import { pruneProjectMapNode } from "../utils/incrementalGeneration";
import {
  createConversationKnowledgeCandidate,
  discoverUnprocessedProjectMemoryMessages,
  markProjectMapMessagesProcessed,
  shouldTriggerProjectMapAutoIngestion,
} from "../utils/autoIngestion";
import { deriveProjectMapStorageKey } from "../utils/storageKey";

const DEFAULT_STORAGE_LOCATION: ProjectMapStorageLocation = "global";
const activeProjectMapWorkerKeys = new Set<string>();

type ProjectMapDatasetStatus = "loading" | "empty" | "persisted" | "error";

export type ProjectMapGenerationDefaults = {
  engine?: EngineType | null;
  model?: string | null;
};

export type ProjectMapDatasetController = {
  dataset: ProjectMapDataset;
  status: ProjectMapDatasetStatus;
  storageDir: string | null;
  activeReadLocation: ProjectMapStorageLocation;
  error: string | null;
  pendingRequest: ProjectMapGenerationRequest | null;
  reload: () => Promise<void>;
  switchReadLocation: (location: ProjectMapStorageLocation) => void;
  openGlobalCollection: () => void;
  openNodeGeneration: (kind: "node" | "calibrate", node: ProjectMapNode) => void;
  openRefreshEvidence: (node: ProjectMapNode | null) => void;
  closeGenerationRequest: () => void;
  confirmGenerationRequest: (requestOverride?: ProjectMapGenerationRequest) => Promise<void>;
  cancelGenerationRun: (runId: string) => Promise<void>;
  clearFinishedRuns: () => Promise<void>;
  confirmCandidate: (candidateId: string) => Promise<boolean>;
  rejectCandidate: (candidateId: string) => Promise<boolean>;
  deleteNode: (nodeId: string) => Promise<boolean>;
  updateDataset: (updater: (dataset: ProjectMapDataset) => ProjectMapDataset) => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createProjectMapWorkerKey(workspaceId: string, runId: string): string {
  return `${workspaceId}:${runId}`;
}

export function __resetProjectMapWorkerClaimsForTests(): void {
  activeProjectMapWorkerKeys.clear();
}

function createDatasetWithRun(
  dataset: ProjectMapDataset,
  run: ProjectMapRunMetadata,
): ProjectMapDataset {
  const existingRuns = dataset.runs.filter((candidate) => candidate.id !== run.id);
  const nextRuns = [run, ...existingRuns].slice(0, 30);
  let hasRunningRun = false;

  return {
    ...dataset,
    manifest: {
      ...dataset.manifest,
      updatedAt: run.startedAt,
      lastRunId: run.id,
    },
    autoIngestionSettings: {
      ...dataset.autoIngestionSettings,
      engine: run.engine,
      model: run.model,
    },
    runs: nextRuns.map((candidate) => {
      if (candidate.status !== "running") {
        return candidate;
      }
      if (!hasRunningRun) {
        hasRunningRun = true;
        return candidate;
      }
      return {
        ...candidate,
        status: "pending",
      };
    }),
  };
}

function appendRunLog(
  run: ProjectMapRunMetadata,
  phase: NonNullable<ProjectMapRunMetadata["phase"]>,
  message: string,
): ProjectMapRunMetadata {
  return {
    ...run,
    logs: [
      ...(run.logs ?? []),
      {
        at: new Date().toISOString(),
        phase,
        message,
      },
    ].slice(-20),
  };
}

function createDatasetWithRunUpdate(
  dataset: ProjectMapDataset,
  runId: string,
  update: ProjectMapRunUpdate,
): ProjectMapDataset {
  return {
    ...dataset,
    runs: dataset.runs.map((run) => {
      if (run.id !== runId) {
        return run;
      }
      const phase = update.phase ?? run.phase ?? "queued";
      const updatedRun: ProjectMapRunMetadata = {
        ...run,
        ...update,
        phase,
        progress:
          typeof update.progress === "number"
            ? Math.max(0, Math.min(100, update.progress))
            : run.progress,
      };
      if (!update.log) {
        return updatedRun;
      }
      return appendRunLog(updatedRun, phase, update.log);
    }),
  };
}

function createDatasetWithFailedRun(
  dataset: ProjectMapDataset,
  runId: string,
  error: string,
): ProjectMapDataset {
  const completedAt = new Date().toISOString();
  const phase: NonNullable<ProjectMapRunMetadata["phase"]> = "failed";

  return {
    ...dataset,
    runs: dataset.runs.map((run) =>
      run.id === runId
        ? {
            ...run,
            status: "failed",
            phase,
            progress: 100,
            completedAt,
            error,
            logs: [
              ...(run.logs ?? []),
              {
                at: completedAt,
                phase,
                message: error,
              },
            ].slice(-20),
          }
        : run,
    ),
  };
}

function createDatasetWithCancelledRun(
  dataset: ProjectMapDataset,
  runId: string,
): ProjectMapDataset {
  const completedAt = new Date().toISOString();
  const phase: NonNullable<ProjectMapRunMetadata["phase"]> = "cancelled";

  return {
    ...dataset,
    runs: dataset.runs.map((run) =>
      run.id === runId && (run.status === "pending" || run.status === "running")
        ? {
            ...run,
            status: "cancelled",
            phase,
            progress: 100,
            completedAt,
            logs: [
              ...(run.logs ?? []),
              {
                at: completedAt,
                phase,
                message: "Generation task cancelled by user.",
              },
            ].slice(-20),
          }
        : run,
    ),
  };
}

function isRunCancelled(dataset: ProjectMapDataset, runId: string): boolean {
  return dataset.runs.some((run) => run.id === runId && run.status === "cancelled");
}

function createDatasetWithoutFinishedRuns(dataset: ProjectMapDataset): ProjectMapDataset {
  return {
    ...dataset,
    runs: dataset.runs.filter((run) => run.status === "pending" || run.status === "running"),
  };
}

function getNextActiveRun(runs: ProjectMapRunMetadata[]): ProjectMapRunMetadata | null {
  const runningRun = runs.find((run) => run.status === "running");
  if (runningRun) {
    return runningRun;
  }
  return (
    [...runs]
      .filter((run) => run.status === "pending")
      .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())[0] ??
    null
  );
}

function normalizePathSeparator(value: string): string {
  return value.replace(/\\/g, "/");
}

function isProjectStorageDir(
  storageDir: string,
  workspacePath: string,
  storageKey: string,
): boolean {
  const isCaseInsensitive = typeof process !== "undefined" && process.platform === "win32";
  const normalize = (value: string): string =>
    normalizePathSeparator(value.replace(/[/\\]+$/g, ""));
  const normalizedStorageDir = normalize(storageDir);
  const normalizedWorkspacePath = normalize(workspacePath);
  const expected = `${normalizedWorkspacePath}/.ccgui/project-map/${storageKey}`;

  if (isCaseInsensitive) {
    return normalizedStorageDir.toLowerCase() === expected.toLowerCase();
  }

  return normalizedStorageDir === expected;
}

function buildProjectWritePath(workspacePath: string, storageKey: string): string {
  const pathSeparator = workspacePath.includes("\\") ? "\\" : "/";
  const trimmedWorkspacePath = workspacePath.replace(/[\\/]+$/g, "");
  return `${trimmedWorkspacePath}${pathSeparator}.ccgui${pathSeparator}project-map${pathSeparator}${storageKey}`;
}

function resolveWritePath(
  storageLocation: ProjectMapStorageLocation,
  workspacePath: string | null,
  storageKey: string,
  storageDir: string | null,
): string {
  if (storageLocation === "project" && workspacePath) {
    return buildProjectWritePath(workspacePath, storageKey);
  }
  if (
    storageLocation === "global" &&
    workspacePath &&
    storageDir !== null &&
    isProjectStorageDir(storageDir, workspacePath, storageKey)
  ) {
    return `.ccgui/project-map/${storageKey}`;
  }
  return storageDir ?? `.ccgui/project-map/${storageKey}`;
}

function resolveRunStorageLocation(
  dataset: ProjectMapDataset,
  runId: string,
  fallback: ProjectMapStorageLocation,
): ProjectMapStorageLocation {
  return dataset.runs.find((run) => run.id === runId)?.storageLocation ?? fallback;
}

function resolveWorkspaceIdentity(
  workspace: Pick<WorkspaceInfo, "id" | "name" | "path"> | null | undefined,
) {
  return {
    projectName: workspace?.name ?? "Project",
    workspacePath: workspace?.path ?? "",
    workspaceId: workspace?.id ?? null,
  };
}

function resolveGenerationDefaults(
  dataset: ProjectMapDataset,
  defaults: ProjectMapGenerationDefaults | null | undefined,
): {
  engine: string;
  model: string;
} {
  const preferredEngine = defaults?.engine ?? null;
  const preferredModel = defaults?.model?.trim() ?? "";
  return {
    engine: preferredEngine ?? dataset.autoIngestionSettings.engine,
    model: preferredModel || dataset.autoIngestionSettings.model,
  };
}

export function useProjectMapDataset(
  workspace: WorkspaceInfo | null | undefined,
  options: {
    generationDefaults?: ProjectMapGenerationDefaults | null;
  } = {},
): ProjectMapDatasetController {
  const workspaceId = workspace?.id ?? null;
  const workspaceName = workspace?.name ?? null;
  const workspacePath = workspace?.path ?? null;
  const identity = useMemo(
    () =>
      resolveWorkspaceIdentity(
        workspaceId
          ? {
              id: workspaceId,
              name: workspaceName ?? "Project",
              path: workspacePath ?? "",
            }
          : null,
      ),
    [workspaceId, workspaceName, workspacePath],
  );
  const [dataset, setDataset] = useState<ProjectMapDataset>(() =>
    createEmptyProjectMapDataset({ identity }),
  );
  const [status, setStatus] = useState<ProjectMapDatasetStatus>(workspaceId ? "loading" : "empty");
  const [storageDir, setStorageDir] = useState<string | null>(null);
  const [activeReadLocation, setActiveReadLocation] = useState<ProjectMapStorageLocation>(
    DEFAULT_STORAGE_LOCATION,
  );
  const [storageDirByLocation, setStorageDirByLocation] = useState<
    Record<ProjectMapStorageLocation, string | null>
  >({
    global: null,
    project: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ProjectMapGenerationRequest | null>(null);
  const loadSequenceRef = useRef(0);
  const datasetRef = useRef(dataset);
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  const activeRunId = useMemo(
    () => getNextActiveRun(dataset.runs)?.id ?? null,
    [dataset.runs],
  );

  const persistDataset = useCallback(
    async (
      nextDataset: ProjectMapDataset,
      createBackup = false,
      persistLocation: ProjectMapStorageLocation = activeReadLocation,
    ) => {
      if (!workspaceId) {
        setDataset(nextDataset);
        return;
      }
      await writeProjectMapDataset({
        workspaceId,
        dataset: nextDataset,
        createBackup,
        storageLocation: persistLocation,
      });
      setDataset(nextDataset);
      setStatus("persisted");
    },
    [activeReadLocation, workspaceId],
  );

  const loadDatasetFromLocation = useCallback(async (readLocation: ProjectMapStorageLocation) => {
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;
    const expectedStorageKey = deriveProjectMapStorageKey(identity);

    if (!workspaceId) {
      setDataset(createEmptyProjectMapDataset({ identity, storageKey: expectedStorageKey }));
      setStatus("empty");
      setStorageDir(null);
      setStorageDirByLocation({ global: null, project: null });
      setActiveReadLocation(DEFAULT_STORAGE_LOCATION);
      setError(null);
      setPendingRequest(null);
      return;
    }

    setDataset(createEmptyProjectMapDataset({ identity, storageKey: expectedStorageKey }));
    setStatus("loading");
    setStorageDir(null);
    if (readLocation === DEFAULT_STORAGE_LOCATION) {
      setStorageDirByLocation({ global: null, project: null });
    }
    setActiveReadLocation(readLocation);
    setError(null);
    setPendingRequest(null);
    try {
      const readResult = await readProjectMapDataset({
        workspaceId,
        identity,
        storageMode: readLocation,
      });

      if (loadSequenceRef.current !== loadSequence) {
        return;
      }

      if (readResult.response.storageKey !== expectedStorageKey) {
        setDataset(createEmptyProjectMapDataset({ identity, storageKey: expectedStorageKey }));
        setStatus("error");
        setError(
          `Project map storage key mismatch: expected ${expectedStorageKey}, received ${readResult.response.storageKey}.`,
        );
        return;
      }

      setStorageDir(readResult.response.storageDir);
      setStorageDirByLocation((current) => ({
        ...current,
        [readLocation]: readResult.response.storageDir,
      }));
      setActiveReadLocation(readLocation);
      if (readResult.dataset) {
        setDataset(readResult.dataset);
        setStatus("persisted");
        return;
      }
      setDataset(
        createEmptyProjectMapDataset({
          identity,
          storageKey: readResult.response.storageKey,
        }),
      );
      setStatus("empty");
    } catch (loadError) {
      if (loadSequenceRef.current !== loadSequence) {
        return;
      }
      setError(errorMessage(loadError));
      setStatus("error");
      setActiveReadLocation(readLocation);
      setDataset(createEmptyProjectMapDataset({ identity, storageKey: expectedStorageKey }));
    }
  }, [identity, workspaceId]);

  const reload = useCallback(async () => {
    await loadDatasetFromLocation(activeReadLocation);
  }, [activeReadLocation, loadDatasetFromLocation]);

  const switchReadLocation = useCallback(
    (location: ProjectMapStorageLocation) => {
      if (location === activeReadLocation) {
        return;
      }
      setActiveReadLocation(location);
      void loadDatasetFromLocation(location);
    },
    [activeReadLocation, loadDatasetFromLocation],
  );

  useEffect(() => {
    void loadDatasetFromLocation(DEFAULT_STORAGE_LOCATION);
  }, [loadDatasetFromLocation]);

  useEffect(() => {
    if (!workspaceId || status !== "persisted") {
      return;
    }
    const activeRun = activeRunId
      ? datasetRef.current.runs.find((run) => run.id === activeRunId) ?? null
      : null;
    if (!activeRun) {
      return;
    }

    const workerKey = createProjectMapWorkerKey(workspaceId, activeRun.id);
    if (activeProjectMapWorkerKeys.has(workerKey)) {
      return;
    }
    activeProjectMapWorkerKeys.add(workerKey);

    const persistWorkerDataset = async (
      nextDataset: ProjectMapDataset,
      createBackup = false,
    ) => {
      const runStorageLocation =
        activeRunId !== null
          ? resolveRunStorageLocation(nextDataset, activeRunId, activeReadLocation)
          : activeReadLocation;
      if (workspaceIdRef.current === workspaceId) {
        datasetRef.current = nextDataset;
        setDataset(nextDataset);
        setStatus("persisted");
      }
      await writeProjectMapDataset({
        workspaceId,
        dataset: nextDataset,
        createBackup,
        storageLocation: runStorageLocation,
      });
    };

    const updateRun = async (update: ProjectMapRunUpdate) => {
      if (isRunCancelled(datasetRef.current, activeRun.id)) {
        return;
      }
      const nextDataset = createDatasetWithRunUpdate(
        datasetRef.current,
        activeRun.id,
        update,
      );
      await persistWorkerDataset(nextDataset);
    };

    void (async () => {
      try {
        const runStartedAt = new Date().toISOString();
        const runningDataset = createDatasetWithRunUpdate(datasetRef.current, activeRun.id, {
          status: "running",
          phase: "preparingSources",
          progress: Math.max(activeRun.progress ?? 0, 10),
          log: "Worker claimed the active slot.",
        });
        await persistWorkerDataset(runningDataset);
        if (isRunCancelled(datasetRef.current, activeRun.id)) {
          return;
        }
        const runningRun =
          runningDataset.runs.find((run) => run.id === activeRun.id) ?? {
            ...activeRun,
            status: "running",
            phase: "preparingSources",
            progress: 10,
            startedAt: runStartedAt,
          };
        const generatedDataset = await runProjectMapGenerationWorker({
          workspaceId,
          dataset: runningDataset,
          run: runningRun,
          onRunUpdate: updateRun,
        });
        if (isRunCancelled(datasetRef.current, activeRun.id)) {
          return;
        }
        const completedAt = new Date().toISOString();
        const generatedWithLatestRuns = {
          ...generatedDataset,
          runs: datasetRef.current.runs,
        };
        const completedDataset = createDatasetWithRunUpdate(generatedWithLatestRuns, activeRun.id, {
          status: "completed",
          phase: "completed",
          progress: 100,
          log: "Project map generation completed.",
        });
        const withCompletedTime = {
          ...completedDataset,
          runs: completedDataset.runs.map((run) =>
            run.id === activeRun.id
              ? {
                  ...run,
                  completedAt,
                  error: null,
                }
              : run,
          ),
        };
        await persistWorkerDataset(withCompletedTime);
      } catch (workerError) {
        if (isRunCancelled(datasetRef.current, activeRun.id)) {
          return;
        }
        const message = errorMessage(workerError);
        const failedDataset = createDatasetWithFailedRun(datasetRef.current, activeRun.id, message);
        try {
          await persistWorkerDataset(failedDataset);
        } catch (persistFailureError) {
          if (workspaceIdRef.current === workspaceId) {
            datasetRef.current = failedDataset;
            setDataset(failedDataset);
            setStatus("persisted");
            setError(
              `${message}; failed to persist failed run: ${errorMessage(persistFailureError)}`,
            );
          }
          return;
        }
        if (workspaceIdRef.current === workspaceId) {
          setError(message);
        }
      } finally {
        activeProjectMapWorkerKeys.delete(workerKey);
      }
    })();
  }, [activeReadLocation, activeRunId, status, workspaceId]);

  useEffect(() => {
    if (!workspaceId || status !== "persisted" || !dataset.autoIngestionSettings.enabled) {
      return;
    }

    let cancelled = false;
    void projectMemoryList({ workspaceId, pageSize: 50 })
      .then(async (result) => {
        if (cancelled) {
          return;
        }
        const unprocessedMessages = discoverUnprocessedProjectMemoryMessages({
          memories: result.items,
          processedMessages: dataset.memoryCursor.processedMessages,
        });
        if (
          !shouldTriggerProjectMapAutoIngestion({
            settings: dataset.autoIngestionSettings,
            unprocessedMessages,
          })
        ) {
          return;
        }
        const createdAt = new Date().toISOString();
        const candidates = result.items
          .map((memory) => createConversationKnowledgeCandidate({ dataset, memory, createdAt }))
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
        if (candidates.length === 0) {
          return;
        }
        const runId = `auto_${Date.now().toString(36)}`;
        await persistDataset({
          ...dataset,
          candidates: [...(dataset.candidates ?? []), ...candidates],
          memoryCursor: {
            ...dataset.memoryCursor,
            lastCheckedAt: createdAt,
            pendingMessages: unprocessedMessages,
            processedMessages: markProjectMapMessagesProcessed({
              processedMessages: dataset.memoryCursor.processedMessages,
              consumedMessages: unprocessedMessages,
              runId,
              processedAt: createdAt,
              runSucceeded: true,
            }),
            lastRunId: runId,
          },
          runs: [
            {
              id: runId,
              kind: "auto",
              status: "completed",
              engine: dataset.autoIngestionSettings.engine,
              model: dataset.autoIngestionSettings.model,
              startedAt: createdAt,
              completedAt: createdAt,
              scope: "auto",
            },
            ...dataset.runs,
          ],
        });
      })
      .catch((ingestionError) => {
        if (!cancelled) {
          setError(errorMessage(ingestionError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, persistDataset, status, workspaceId]);

  const defaultWritePath = resolveWritePath(
    DEFAULT_STORAGE_LOCATION,
    workspacePath,
    dataset.manifest.storageKey,
    storageDirByLocation.global,
  );
  const generationDefaults = options.generationDefaults ?? null;

  const openGlobalCollection = useCallback(() => {
    const defaults = resolveGenerationDefaults(dataset, generationDefaults);
    setPendingRequest(
      createProjectMapGenerationRequest({
        dataset,
        kind: "global",
        engine: defaults.engine,
        model: defaults.model,
        scope: { kind: "global", lensIds: dataset.lenses.map((lens) => lens.id) },
        storageLocation: DEFAULT_STORAGE_LOCATION,
        writePath: defaultWritePath,
      }),
    );
  }, [dataset, defaultWritePath, generationDefaults]);

  const openNodeGeneration = useCallback(
    (kind: "node" | "calibrate", node: ProjectMapNode) => {
      const defaults = resolveGenerationDefaults(dataset, generationDefaults);
      setPendingRequest(
        createProjectMapGenerationRequest({
          dataset,
          kind: "node",
          engine: defaults.engine,
          model: defaults.model,
          scope: { kind: "node", nodeId: node.id, includeDescendants: kind === "node" },
          generationIntent: kind === "calibrate" ? "calibrateNode" : "completeNode",
          storageLocation: DEFAULT_STORAGE_LOCATION,
          writePath: defaultWritePath,
          node,
        }),
      );
    },
    [dataset, defaultWritePath, generationDefaults],
  );

  const openRefreshEvidence = useCallback(
    (node: ProjectMapNode | null) => {
      const defaults = resolveGenerationDefaults(dataset, generationDefaults);
      setPendingRequest(
        createProjectMapGenerationRequest({
          dataset,
          kind: node ? "node" : "global",
          engine: defaults.engine,
          model: defaults.model,
          scope: node
            ? { kind: "node", nodeId: node.id, includeDescendants: false }
            : { kind: "global", lensIds: dataset.lenses.map((lens) => lens.id) },
          storageLocation: DEFAULT_STORAGE_LOCATION,
          writePath: defaultWritePath,
          node,
        }),
      );
    },
    [dataset, defaultWritePath, generationDefaults],
  );

  const confirmGenerationRequest = useCallback(async (requestOverride?: ProjectMapGenerationRequest) => {
    const request = requestOverride ?? pendingRequest;
    if (!request) {
      return;
    }
    const run = createRunMetadataFromRequest(request, "pending");
    const queuedDataset = createDatasetWithRun(datasetRef.current, run);
    setError(null);
    try {
      await persistDataset(queuedDataset, false, request.storageLocation);
      datasetRef.current = queuedDataset;
      setPendingRequest(null);
    } catch (writeError) {
      setError(errorMessage(writeError));
    }
  }, [pendingRequest, persistDataset]);

  const cancelGenerationRun = useCallback(
    async (runId: string) => {
      const nextDataset = createDatasetWithCancelledRun(datasetRef.current, runId);
      setDataset(nextDataset);
      datasetRef.current = nextDataset;
      setError(null);
      try {
        await persistDataset(nextDataset);
      } catch (writeError) {
        setError(errorMessage(writeError));
      }
    },
    [persistDataset],
  );

  const clearFinishedRuns = useCallback(async () => {
    const nextDataset = createDatasetWithoutFinishedRuns(dataset);
    setDataset(nextDataset);
    setError(null);
    try {
      await persistDataset(nextDataset);
    } catch (writeError) {
      setError(errorMessage(writeError));
    }
  }, [dataset, persistDataset]);

  const confirmCandidate = useCallback(
    async (candidateId: string): Promise<boolean> => {
      const confirmedAt = new Date().toISOString();
      const result = confirmProjectMapCandidate({
        dataset: datasetRef.current,
        candidateId,
        confirmedAt,
      });
      if (!result.ok) {
        setError(result.errors.join("\n"));
        return false;
      }

      setError(null);
      try {
        await persistDataset(result.dataset);
        datasetRef.current = result.dataset;
        return true;
      } catch (writeError) {
        setError(errorMessage(writeError));
        return false;
      }
    },
    [persistDataset],
  );

  const rejectCandidate = useCallback(
    async (candidateId: string): Promise<boolean> => {
      const rejectedAt = new Date().toISOString();
      const nextDataset = rejectProjectMapCandidate({
        dataset: datasetRef.current,
        candidateId,
        rejectedAt,
      });
      setError(null);
      try {
        await persistDataset(nextDataset);
        datasetRef.current = nextDataset;
        return true;
      } catch (writeError) {
        setError(errorMessage(writeError));
        return false;
      }
    },
    [persistDataset],
  );

  const deleteNode = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const prunedAt = new Date().toISOString();
      const result = pruneProjectMapNode({
        dataset: datasetRef.current,
        nodeId,
        prunedAt,
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }

      setError(null);
      try {
        await persistDataset(result.dataset);
        datasetRef.current = result.dataset;
        return true;
      } catch (writeError) {
        setError(errorMessage(writeError));
        return false;
      }
    },
    [persistDataset],
  );

  const updateDataset = useCallback(
    async (updater: (dataset: ProjectMapDataset) => ProjectMapDataset) => {
      await persistDataset(updater(dataset));
    },
    [dataset, persistDataset],
  );

  return {
    dataset,
    status,
    storageDir,
    activeReadLocation,
    error,
    pendingRequest,
    reload,
    switchReadLocation,
    openGlobalCollection,
    openNodeGeneration,
    openRefreshEvidence,
    closeGenerationRequest: () => setPendingRequest(null),
    confirmGenerationRequest,
    cancelGenerationRun,
    clearFinishedRuns,
    confirmCandidate,
    rejectCandidate,
    deleteNode,
    updateDataset,
  };
}
