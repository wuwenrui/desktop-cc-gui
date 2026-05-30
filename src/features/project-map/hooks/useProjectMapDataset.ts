import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EngineType, WorkspaceInfo } from "../../../types";
import { projectMemoryList } from "../../../services/tauri/projectMemory";
import type {
  ProjectMapCandidate,
  ProjectMapDataset,
  ProjectMapGenerationRequest,
  ProjectMapNode,
  ProjectMapPreferredLanguage,
  ProjectMapSource,
  ProjectMapStorageLocation,
  ProjectMapRunMetadata,
  ProjectMapRunFailureCategory,
  ProjectMapRunOwnership,
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
import { getProjectMapUnassignedDiscoveryChildren } from "../services/projectMapNodeOrganizer";
import {
  createProjectMapGenerationRequest,
  createRunMetadataFromRequest,
} from "../utils/generationRequests";
import {
  confirmProjectMapCandidate,
  confirmProjectMapNodeCandidate,
  rejectProjectMapCandidate,
  rejectProjectMapNodeCandidate,
} from "../utils/candidates";
import { pruneProjectMapNode } from "../utils/incrementalGeneration";
import {
  createProjectMapAutoIngestionMemoryEvidence,
  extractProjectMapMemoryEvidencePaths,
  discoverUnprocessedProjectMemoryMessages,
  selectProjectMapAutoIngestionMemories,
  markProjectMapMessagesProcessed,
  shouldEvaluateProjectMapAutoIngestion,
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

export type ProjectMapConfirmAllCandidatesResult = {
  confirmed: number;
  skipped: number;
  errors: string[];
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
  openUnassignedOrganizer: () => void;
  openNodeGeneration: (kind: "node" | "calibrate", node: ProjectMapNode) => void;
  openRefreshEvidence: (node: ProjectMapNode | null) => void;
  closeGenerationRequest: () => void;
  confirmGenerationRequest: (requestOverride?: ProjectMapGenerationRequest) => Promise<void>;
  cancelGenerationRun: (runId: string) => Promise<void>;
  clearFinishedRuns: () => Promise<void>;
  confirmCandidate: (candidateId: string) => Promise<boolean>;
  confirmAllCandidates: () => Promise<ProjectMapConfirmAllCandidatesResult>;
  rejectCandidate: (candidateId: string) => Promise<boolean>;
  confirmNodeCandidate: (nodeId: string) => Promise<boolean>;
  rejectNodeCandidate: (nodeId: string) => Promise<boolean>;
  deleteNode: (nodeId: string) => Promise<boolean>;
  updateDataset: (updater: (dataset: ProjectMapDataset) => ProjectMapDataset) => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createProjectMapWorkerKey(workspaceId: string, storageKey: string, runId: string): string {
  return `${workspaceId}:${storageKey}:${runId}`;
}

function orderProjectMapCandidatesForConfirmation(candidates: ProjectMapCandidate[]): ProjectMapCandidate[] {
  const parentMoveByNodeId = new Map<string, ProjectMapCandidate>();
  for (const candidate of candidates) {
    if (candidate.kind === "parentMove" && candidate.move) {
      parentMoveByNodeId.set(candidate.move.nodeId, candidate);
    }
  }

  const orderedCandidates: ProjectMapCandidate[] = [];
  const visitingCandidateIds = new Set<string>();
  const visitedCandidateIds = new Set<string>();
  const visitCandidate = (candidate: ProjectMapCandidate) => {
    if (visitedCandidateIds.has(candidate.id) || visitingCandidateIds.has(candidate.id)) {
      return;
    }
    visitingCandidateIds.add(candidate.id);
    const parentCandidate = candidate.move
      ? parentMoveByNodeId.get(candidate.move.suggestedParentId)
      : null;
    if (parentCandidate) {
      visitCandidate(parentCandidate);
    }
    visitingCandidateIds.delete(candidate.id);
    visitedCandidateIds.add(candidate.id);
    orderedCandidates.push(candidate);
  };

  for (const candidate of candidates) {
    visitCandidate(candidate);
  }
  return orderedCandidates;
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
  failureCategory: ProjectMapRunFailureCategory | null = classifyProjectMapRunFailure(error),
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
            failureCategory,
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
            failureCategory: "cancelled",
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

function resolveWorkspaceIdentity(
  workspace: Pick<WorkspaceInfo, "id" | "name" | "path"> | null | undefined,
) {
  return {
    projectName: workspace?.name ?? "Project",
    workspacePath: workspace?.path ?? "",
    workspaceId: workspace?.id ?? null,
  };
}

function createProjectMapRunOwnership(input: {
  workspaceId: string | null;
  workspacePath: string | null;
  storageKey: string;
  storageLocation: ProjectMapStorageLocation;
}): ProjectMapRunOwnership {
  return {
    workspaceId: input.workspaceId,
    workspacePath: input.workspacePath ?? "",
    storageKey: input.storageKey,
    storageLocation: input.storageLocation,
  };
}

function resolveProjectMapRunOwnership(input: {
  run: ProjectMapRunMetadata;
  fallbackWorkspaceId: string;
  fallbackWorkspacePath: string | null;
  fallbackStorageKey: string;
  fallbackStorageLocation: ProjectMapStorageLocation;
}): ProjectMapRunOwnership {
  return input.run.ownership ?? createProjectMapRunOwnership({
    workspaceId: input.fallbackWorkspaceId,
    workspacePath: input.fallbackWorkspacePath,
    storageKey: input.fallbackStorageKey,
    storageLocation: input.run.storageLocation ?? input.fallbackStorageLocation,
  });
}

function classifyProjectMapRunFailure(
  message: string,
): ProjectMapRunFailureCategory | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("ownership mismatch") ||
    normalized.includes("storage key mismatch") ||
    normalized.includes("manifest ownership")
  ) {
    return "ownership_mismatch";
  }
  if (
    normalized.includes("json") ||
    normalized.includes("structured") ||
    normalized.includes("ai output") ||
    normalized.includes("valid project-map nodes") ||
    normalized.includes("valid project map payload")
  ) {
    return "output_parse_failed";
  }
  if (
    normalized.includes("evidence") ||
    normalized.includes("workspace file") ||
    normalized.includes("read workspace")
  ) {
    return "evidence_read_failed";
  }
  if (
    normalized.includes("persist") ||
    normalized.includes("write") ||
    normalized.includes("storage") ||
    normalized.includes("project map root")
  ) {
    return "persistence_failed";
  }
  return null;
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

function projectMapSourceFromPath(path: string): ProjectMapSource {
  const normalizedPath = path.replace(/\\/g, "/");
  const label = normalizedPath.split("/").filter(Boolean).pop() ?? normalizedPath;
  return {
    type: "file",
    label,
    path: normalizedPath,
  };
}

export function useProjectMapDataset(
  workspace: WorkspaceInfo | null | undefined,
  options: {
    generationDefaults?: ProjectMapGenerationDefaults | null;
    preferredLanguage?: ProjectMapPreferredLanguage | null;
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
  const activeReadLocationRef = useRef(activeReadLocation);
  const expectedStorageKey = useMemo(() => deriveProjectMapStorageKey(identity), [identity]);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    activeReadLocationRef.current = activeReadLocation;
  }, [activeReadLocation]);

  const activeRunId = useMemo(
    () => getNextActiveRun(dataset.runs)?.id ?? null,
    [dataset.runs],
  );
  const defaultWritePath = resolveWritePath(
    DEFAULT_STORAGE_LOCATION,
    workspacePath,
    dataset.manifest.storageKey,
    storageDirByLocation.global,
  );
  const generationDefaults = options.generationDefaults ?? null;
  const preferredLanguage = options.preferredLanguage ?? "zh";

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
        expectedStorageKey,
      });
      setDataset(nextDataset);
      setStatus("persisted");
    },
    [activeReadLocation, expectedStorageKey, workspaceId],
  );

  const loadDatasetFromLocation = useCallback(async (readLocation: ProjectMapStorageLocation) => {
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;
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
  }, [expectedStorageKey, identity, workspaceId]);

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
    if (
      !workspaceId ||
      status !== "persisted" ||
      dataset.manifest.storageKey !== expectedStorageKey
    ) {
      return;
    }
    const activeRun = activeRunId
      ? datasetRef.current.runs.find((run) => run.id === activeRunId) ?? null
      : null;
    if (!activeRun) {
      return;
    }

    const runOwnership = resolveProjectMapRunOwnership({
      run: activeRun,
      fallbackWorkspaceId: workspaceId,
      fallbackWorkspacePath: workspacePath,
      fallbackStorageKey: datasetRef.current.manifest.storageKey,
      fallbackStorageLocation: activeReadLocation,
    });
    const workerWorkspaceId = runOwnership.workspaceId ?? workspaceId;
    const workerStorageKey = runOwnership.storageKey;
    const workerStorageLocation = runOwnership.storageLocation;
    const workerKey = createProjectMapWorkerKey(workerWorkspaceId, workerStorageKey, activeRun.id);
    if (activeProjectMapWorkerKeys.has(workerKey)) {
      return;
    }
    activeProjectMapWorkerKeys.add(workerKey);
    const workerDatasetRef: { current: ProjectMapDataset } = { current: datasetRef.current };
    const isActiveWorkerWorkspace = () =>
      workspaceIdRef.current === workerWorkspaceId &&
      activeReadLocationRef.current === workerStorageLocation &&
      datasetRef.current.manifest.storageKey === workerStorageKey;
    const getWorkerDatasetSnapshot = () =>
      isActiveWorkerWorkspace() ? datasetRef.current : workerDatasetRef.current;

    const persistWorkerDataset = async (
      nextDataset: ProjectMapDataset,
      createBackup = false,
    ) => {
      if (nextDataset.manifest.storageKey !== workerStorageKey) {
        throw new Error(
          `Project map worker ownership mismatch: expected ${workerStorageKey}, received ${nextDataset.manifest.storageKey}.`,
        );
      }
      workerDatasetRef.current = nextDataset;
      if (isActiveWorkerWorkspace()) {
        datasetRef.current = nextDataset;
        setDataset(nextDataset);
        setStatus("persisted");
      }
      await writeProjectMapDataset({
        workspaceId: workerWorkspaceId,
        dataset: nextDataset,
        createBackup,
        storageLocation: workerStorageLocation,
        expectedStorageKey: workerStorageKey,
      });
    };

    const updateRun = async (update: ProjectMapRunUpdate) => {
      const currentWorkerDataset = getWorkerDatasetSnapshot();
      if (isRunCancelled(currentWorkerDataset, activeRun.id)) {
        return;
      }
      const nextDataset = createDatasetWithRunUpdate(
        currentWorkerDataset,
        activeRun.id,
        update,
      );
      await persistWorkerDataset(nextDataset);
    };

    void (async () => {
      try {
        const runStartedAt = new Date().toISOString();
        const runningDataset = createDatasetWithRunUpdate(workerDatasetRef.current, activeRun.id, {
          status: "running",
          phase: "preparingSources",
          progress: Math.max(activeRun.progress ?? 0, 10),
          log: "Worker claimed the active slot.",
        });
        await persistWorkerDataset(runningDataset);
        if (isRunCancelled(getWorkerDatasetSnapshot(), activeRun.id)) {
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
          workspaceId: workerWorkspaceId,
          dataset: runningDataset,
          run: runningRun,
          onRunUpdate: updateRun,
        });
        if (isRunCancelled(getWorkerDatasetSnapshot(), activeRun.id)) {
          return;
        }
        const completedAt = new Date().toISOString();
        const latestWorkerDataset = getWorkerDatasetSnapshot();
        const generatedRunById = new Map(generatedDataset.runs.map((run) => [run.id, run]));
        const generatedWithLatestRuns = {
          ...generatedDataset,
          runs: latestWorkerDataset.runs.map((run) => {
            const generatedRun = generatedRunById.get(run.id);
            return generatedRun ? { ...run, organizerResult: generatedRun.organizerResult } : run;
          }),
        };
        const completedRun =
          generatedWithLatestRuns.runs.find((run) => run.id === activeRun.id) ?? activeRun;
        const generatedWithAutoCursor = completedRun.autoIngestion
          ? {
              ...generatedWithLatestRuns,
              memoryCursor: {
                ...generatedWithLatestRuns.memoryCursor,
                pendingMessages: generatedWithLatestRuns.memoryCursor.pendingMessages.filter(
                  (message) =>
                    !completedRun.autoIngestion?.consumedMessages.some(
                      (consumed) =>
                        consumed.sessionId === message.sessionId &&
                        consumed.messageHash === message.messageHash,
                    ),
                ),
                processedMessages: markProjectMapMessagesProcessed({
                  processedMessages: generatedWithLatestRuns.memoryCursor.processedMessages,
                  consumedMessages: completedRun.autoIngestion.consumedMessages,
                  runId: activeRun.id,
                  processedAt: completedAt,
                  runSucceeded: true,
                }),
                lastRunId: activeRun.id,
              },
            }
          : generatedWithLatestRuns;
        const completedDataset = createDatasetWithRunUpdate(generatedWithAutoCursor, activeRun.id, {
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
        if (isRunCancelled(getWorkerDatasetSnapshot(), activeRun.id)) {
          return;
        }
        const message = errorMessage(workerError);
        const failureCategory = classifyProjectMapRunFailure(message);
        const failedDataset = createDatasetWithFailedRun(
          getWorkerDatasetSnapshot(),
          activeRun.id,
          message,
          failureCategory,
        );
        try {
          await persistWorkerDataset(failedDataset);
        } catch (persistFailureError) {
          if (isActiveWorkerWorkspace()) {
            datasetRef.current = failedDataset;
            setDataset(failedDataset);
            setStatus("persisted");
            setError(
              `${message}; failed to persist failed run: ${errorMessage(persistFailureError)}`,
            );
          }
          return;
        }
        if (isActiveWorkerWorkspace()) {
          setError(message);
        }
      } finally {
        activeProjectMapWorkerKeys.delete(workerKey);
      }
    })();
  }, [
    activeReadLocation,
    activeRunId,
    dataset.manifest.storageKey,
    expectedStorageKey,
    status,
    workspaceId,
    workspacePath,
  ]);

  useEffect(() => {
    const checkedAt = new Date().toISOString();
    if (
      !workspaceId ||
      status !== "persisted" ||
      !shouldEvaluateProjectMapAutoIngestion({
        settings: dataset.autoIngestionSettings,
        cursor: dataset.memoryCursor,
        runs: dataset.runs,
        now: checkedAt,
      })
    ) {
      return;
    }

    let cancelled = false;
    void projectMemoryList({ workspaceId, pageSize: 50 })
      .then(async (result) => {
        if (cancelled) {
          return;
        }
        const currentDataset = datasetRef.current;
        const unprocessedMessages = discoverUnprocessedProjectMemoryMessages({
          memories: result.items,
          processedMessages: currentDataset.memoryCursor.processedMessages,
        });
        const checkedDataset: ProjectMapDataset = {
          ...currentDataset,
          memoryCursor: {
            ...currentDataset.memoryCursor,
            lastCheckedAt: checkedAt,
          },
        };
        if (
          !shouldTriggerProjectMapAutoIngestion({
            settings: currentDataset.autoIngestionSettings,
            unprocessedMessages,
          })
        ) {
          await persistDataset(checkedDataset);
          datasetRef.current = checkedDataset;
          return;
        }

        const consumedMemories = selectProjectMapAutoIngestionMemories({
          memories: result.items,
          unprocessedMessages,
        });
        const request = createProjectMapGenerationRequest({
          dataset: checkedDataset,
          kind: "auto",
          engine: currentDataset.autoIngestionSettings.engine,
          model: currentDataset.autoIngestionSettings.model,
          preferredLanguage,
          scope: {
            kind: "auto",
            messageHashes: unprocessedMessages.map((message) => message.messageHash),
          },
          storageLocation: DEFAULT_STORAGE_LOCATION,
          ownership: createProjectMapRunOwnership({
            workspaceId,
            workspacePath,
            storageKey: checkedDataset.manifest.storageKey,
            storageLocation: DEFAULT_STORAGE_LOCATION,
          }),
          writePath: defaultWritePath,
          readSources: extractProjectMapMemoryEvidencePaths(consumedMemories).map(projectMapSourceFromPath),
          autoIngestion: {
            applyMode: currentDataset.autoIngestionSettings.applyMode,
            consumedMessages: unprocessedMessages,
            memoryEvidence: consumedMemories.map(createProjectMapAutoIngestionMemoryEvidence),
          },
        });
        const queuedDataset = createDatasetWithRun(
          {
            ...checkedDataset,
            memoryCursor: {
              ...checkedDataset.memoryCursor,
              pendingMessages: unprocessedMessages,
            },
          },
          createRunMetadataFromRequest(request, "pending"),
        );
        await persistDataset(queuedDataset, false, request.storageLocation);
        datasetRef.current = queuedDataset;
      })
      .catch((ingestionError) => {
        if (!cancelled) {
          setError(errorMessage(ingestionError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, defaultWritePath, persistDataset, preferredLanguage, status, workspaceId, workspacePath]);

  const openGlobalCollection = useCallback(() => {
    const defaults = resolveGenerationDefaults(dataset, generationDefaults);
    setPendingRequest(
      createProjectMapGenerationRequest({
        dataset,
        kind: "global",
        engine: defaults.engine,
        model: defaults.model,
        preferredLanguage,
        scope: { kind: "global", lensIds: dataset.lenses.map((lens) => lens.id) },
        storageLocation: DEFAULT_STORAGE_LOCATION,
        ownership: createProjectMapRunOwnership({
          workspaceId,
          workspacePath,
          storageKey: dataset.manifest.storageKey,
          storageLocation: DEFAULT_STORAGE_LOCATION,
        }),
        writePath: defaultWritePath,
      }),
    );
  }, [dataset, defaultWritePath, generationDefaults, preferredLanguage, workspaceId, workspacePath]);

  const openUnassignedOrganizer = useCallback(() => {
    if (!workspaceId) {
      setError("Project Map organizer requires an active workspace.");
      return;
    }
    const unassignedCount = getProjectMapUnassignedDiscoveryChildren(dataset).length;
    if (unassignedCount === 0) {
      setError("No unassigned Project Map discoveries are available to organize.");
      return;
    }
    const defaults = resolveGenerationDefaults(dataset, generationDefaults);
    setPendingRequest(
      createProjectMapGenerationRequest({
        dataset,
        kind: "organizer",
        engine: defaults.engine,
        model: defaults.model,
        preferredLanguage,
        scope: { kind: "organizer", unassignedCount },
        generationIntent: "organizeUnassigned",
        storageLocation: DEFAULT_STORAGE_LOCATION,
        ownership: createProjectMapRunOwnership({
          workspaceId,
          workspacePath,
          storageKey: dataset.manifest.storageKey,
          storageLocation: DEFAULT_STORAGE_LOCATION,
        }),
        writePath: defaultWritePath,
        readSources: [],
      }),
    );
  }, [dataset, defaultWritePath, generationDefaults, preferredLanguage, workspaceId, workspacePath]);

  const openNodeGeneration = useCallback(
    (kind: "node" | "calibrate", node: ProjectMapNode) => {
      const defaults = resolveGenerationDefaults(dataset, generationDefaults);
      setPendingRequest(
        createProjectMapGenerationRequest({
          dataset,
          kind: "node",
          engine: defaults.engine,
          model: defaults.model,
          preferredLanguage,
          scope: { kind: "node", nodeId: node.id, includeDescendants: kind === "node" },
          generationIntent: kind === "calibrate" ? "calibrateNode" : "completeNode",
          storageLocation: DEFAULT_STORAGE_LOCATION,
          ownership: createProjectMapRunOwnership({
            workspaceId,
            workspacePath,
            storageKey: dataset.manifest.storageKey,
            storageLocation: DEFAULT_STORAGE_LOCATION,
          }),
          writePath: defaultWritePath,
          node,
        }),
      );
    },
    [dataset, defaultWritePath, generationDefaults, preferredLanguage, workspaceId, workspacePath],
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
          preferredLanguage,
          scope: node
            ? { kind: "node", nodeId: node.id, includeDescendants: false }
            : { kind: "global", lensIds: dataset.lenses.map((lens) => lens.id) },
          storageLocation: DEFAULT_STORAGE_LOCATION,
          ownership: createProjectMapRunOwnership({
            workspaceId,
            workspacePath,
            storageKey: dataset.manifest.storageKey,
            storageLocation: DEFAULT_STORAGE_LOCATION,
          }),
          writePath: defaultWritePath,
          node,
        }),
      );
    },
    [dataset, defaultWritePath, generationDefaults, preferredLanguage, workspaceId, workspacePath],
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
      setDataset(queuedDataset);
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

  const confirmAllCandidates = useCallback(async (): Promise<ProjectMapConfirmAllCandidatesResult> => {
    const confirmedAt = new Date().toISOString();
    let nextDataset = datasetRef.current;
    let confirmed = 0;
    const errors: string[] = [];
    const pendingReviewCandidates = orderProjectMapCandidatesForConfirmation(
      (nextDataset.candidates ?? []).filter((candidate) => candidate.status === "pending"),
    ).map((candidate) => candidate.id);

    for (const candidateId of pendingReviewCandidates) {
      const result = confirmProjectMapCandidate({
        dataset: nextDataset,
        candidateId,
        confirmedAt,
      });
      if (result.ok) {
        nextDataset = result.dataset;
        confirmed += 1;
        continue;
      }
      errors.push(`${candidateId}: ${result.errors.join("; ")}`);
    }

    const pendingCandidateTargetIds = new Set(
      (nextDataset.candidates ?? [])
        .filter((candidate) => candidate.status === "pending")
        .map((candidate) => candidate.targetNodeId ?? candidate.patch.nodeId),
    );
    const standaloneNodeCandidateIds = nextDataset.nodes
      .filter((node) => node.candidate && !pendingCandidateTargetIds.has(node.id))
      .map((node) => node.id);

    for (const nodeId of standaloneNodeCandidateIds) {
      const result = confirmProjectMapNodeCandidate({
        dataset: nextDataset,
        nodeId,
        confirmedAt,
      });
      if (result.ok) {
        nextDataset = result.dataset;
        confirmed += 1;
        continue;
      }
      errors.push(`${nodeId}: ${result.errors.join("; ")}`);
    }

    const skipped = pendingReviewCandidates.length + standaloneNodeCandidateIds.length - confirmed;
    if (confirmed === 0) {
      setError(errors.join("\n") || "No pending Project Map candidates were accepted.");
      return { confirmed, skipped, errors };
    }

    setError(errors.length > 0 ? errors.join("\n") : null);
    try {
      await persistDataset(nextDataset);
      datasetRef.current = nextDataset;
      return { confirmed, skipped, errors };
    } catch (writeError) {
      const message = errorMessage(writeError);
      setError(message);
      return { confirmed: 0, skipped: confirmed + skipped, errors: [message] };
    }
  }, [persistDataset]);

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

  const confirmNodeCandidate = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const confirmedAt = new Date().toISOString();
      const result = confirmProjectMapNodeCandidate({
        dataset: datasetRef.current,
        nodeId,
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

  const rejectNodeCandidate = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const rejectedAt = new Date().toISOString();
      const result = rejectProjectMapNodeCandidate({
        dataset: datasetRef.current,
        nodeId,
        rejectedAt,
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
      const nextDataset = updater(datasetRef.current);
      await persistDataset(nextDataset);
      datasetRef.current = nextDataset;
    },
    [persistDataset],
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
    openUnassignedOrganizer,
    openNodeGeneration,
    openRefreshEvidence,
    closeGenerationRequest: () => setPendingRequest(null),
    confirmGenerationRequest,
    cancelGenerationRun,
    clearFinishedRuns,
    confirmCandidate,
    confirmAllCandidates,
    rejectCandidate,
    confirmNodeCandidate,
    rejectNodeCandidate,
    deleteNode,
    updateDataset,
  };
}
