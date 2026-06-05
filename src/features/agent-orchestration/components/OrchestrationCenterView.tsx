import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EngineModelInfo } from "../../../types";
import { getConfigModel, getEngineModels, getModelList } from "../../../services/tauri";
import { CODEX_MODEL_CATALOG } from "../../models/codexModelCatalog";
import type {
  OrchestrationProviderSnapshot,
  OrchestrationRiskMarkerKind,
  OrchestrationSourceKind,
  OrchestrationSourceRef,
  OrchestrationTask,
} from "../types";
import type { OrchestrationReviewAction } from "../utils/reviewTask";
import type { TaskRunRecord } from "../../tasks/types";

const ORCHESTRATION_FILTER_ALL = "__all__";
const ORCHESTRATION_DISPATCH_ENGINES = ["codex", "claude", "gemini"] as const;
const ORCHESTRATION_QUEUE_STATUS_ORDER = ["todo", "queued", "running", "failed", "dispatched", "review", "done", "archived"] as const;
const QUEUED_RUN_STATUSES = new Set<TaskRunRecord["status"]>(["queued", "planning"]);
const RUNNING_RUN_STATUSES = new Set<TaskRunRecord["status"]>(["running", "waiting_input", "blocked"]);

export type OrchestrationDispatchEngine = (typeof ORCHESTRATION_DISPATCH_ENGINES)[number];
type OrchestrationQueueStatus = (typeof ORCHESTRATION_QUEUE_STATUS_ORDER)[number];
type OrchestrationModelOption = {
  id?: string;
  model?: string;
  label?: string;
  name?: string;
  isDefault?: boolean;
};
const EMPTY_TASK_RUNS: TaskRunRecord[] = [];
const EMPTY_MODEL_OPTIONS: OrchestrationModelOption[] = [];

type OrchestrationQueueFilters = {
  providerId: string;
  status: OrchestrationQueueStatus | typeof ORCHESTRATION_FILTER_ALL;
  engine: string;
  workspaceId: string;
  sourceKind: OrchestrationSourceKind | typeof ORCHESTRATION_FILTER_ALL;
  riskKind: OrchestrationRiskMarkerKind | typeof ORCHESTRATION_FILTER_ALL;
};

export type OrchestrationDispatchConfirmation = {
  task: OrchestrationTask;
  workspaceId: string;
  engine: OrchestrationDispatchEngine;
  model: string | null;
  threadStrategy: OrchestrationTask["threadStrategy"];
  promptSummary: string;
  acceptanceSummary: string;
  sourceRefs: OrchestrationSourceRef[];
};

export type OrchestrationReviewActionRequest = {
  task: OrchestrationTask;
  action: OrchestrationReviewAction;
};

export type OrchestrationCancelRunRequest = {
  task: OrchestrationTask;
  run: TaskRunRecord;
};

export type OrchestrationManualTaskDraftRequest = {
  title: string;
  scopeSummary: string;
  acceptanceSummary: string;
  promptSummary: string;
  preferredEngine: OrchestrationDispatchEngine;
};

type OrchestrationCenterViewProps = {
  workspaceId: string | null;
  workspaceName?: string | null;
  persistedTasks: OrchestrationTask[];
  providerSnapshots: OrchestrationProviderSnapshot[];
  loading?: boolean;
  selectedTaskId?: string | null;
  onOpenSourceRef?: (input: {
    task: OrchestrationTask;
    sourceRef: OrchestrationSourceRef;
  }) => void;
  onConfirmDispatch?: (confirmation: OrchestrationDispatchConfirmation) => void | Promise<void>;
  onCreateManualTask?: (request: OrchestrationManualTaskDraftRequest) => OrchestrationTask | null | void;
  onCancelRun?: (request: OrchestrationCancelRunRequest) => void;
  onReviewAction?: (request: OrchestrationReviewActionRequest) => void;
  onArchiveTask?: (task: OrchestrationTask) => void;
  onOpenSession?: (task: OrchestrationTask, sessionId: string) => void;
  taskRuns?: TaskRunRecord[];
  modelOptions?: OrchestrationModelOption[];
  defaultModelId?: string | null;
  onBackToProjectMap?: () => void;
};

function formatOrchestrationTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString();
}

function formatRunTime(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return new Date(value).toLocaleString();
}

function sourceRefLocationLabel(sourceRef: OrchestrationSourceRef): string | null {
  return sourceRef.workspaceRelativePath ?? sourceRef.path ?? sourceRef.id ?? null;
}

function sourceRefMetaLabels(sourceRef: OrchestrationSourceRef): string[] {
  const labels = [sourceRef.kind, sourceRef.providerId];
  if (sourceRef.confidence) {
    labels.push(`confidence: ${sourceRef.confidence}`);
  }
  if (sourceRef.stale) {
    labels.push("stale");
  }
  return labels;
}

function canOpenSourceRef(sourceRef: OrchestrationSourceRef): boolean {
  return sourceRef.capabilities.includes("open_source");
}

function canDispatchTask(task: OrchestrationTask, linkedRuns: TaskRunRecord[] = []): boolean {
  return resolveQueueStatus(task, linkedRuns) === "todo";
}

function hasCompletedLinkedRun(linkedRuns: TaskRunRecord[]): boolean {
  return linkedRuns.some((run) => run.status === "completed");
}

function hasReviewIntent(task: OrchestrationTask): boolean {
  return task.status === "review_needed" || task.reviewState === "needs_review";
}

function canReviewTask(
  task: OrchestrationTask,
  linkedRuns: TaskRunRecord[] = [],
): boolean {
  return hasReviewIntent(task) && hasCompletedLinkedRun(linkedRuns);
}

function canArchiveTask(task: OrchestrationTask): boolean {
  return task.status !== "archived" && resolveQueueStatus(task) !== "dispatched";
}

function resolveDispatchEngine(task: OrchestrationTask): OrchestrationDispatchEngine {
  return task.preferredEngine ?? "codex";
}

function normalizeModelId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function modelOptionValue(option: OrchestrationModelOption): string | null {
  return normalizeModelId(option.id) ?? normalizeModelId(option.model);
}

function modelOptionLabel(option: OrchestrationModelOption): string {
  return option.label ?? option.name ?? option.model ?? option.id ?? "";
}

function mapEngineModelToOption(model: EngineModelInfo): OrchestrationModelOption | null {
  const id = normalizeModelId(model.id);
  const runtimeModel = normalizeModelId(model.model) ?? id;
  if (!id || !runtimeModel) {
    return null;
  }
  return {
    id,
    model: runtimeModel,
    label: model.displayName?.trim() || runtimeModel,
    name: model.displayName?.trim() || runtimeModel,
    isDefault: model.isDefault,
  };
}

function resolveDefaultModelValue(options: OrchestrationModelOption[], fallback: string | null): string {
  return (
    options
      .map(modelOptionValue)
      .find((value) => value === fallback) ??
    options.map(modelOptionValue).find(Boolean) ??
    fallback ??
    ""
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCodexModelRecord(value: unknown): OrchestrationModelOption | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeModelId(String(value.id ?? value.model ?? ""));
  const model = normalizeModelId(String(value.model ?? value.id ?? ""));
  if (!id || !model) {
    return null;
  }
  return {
    id,
    model,
    label: String(value.displayName ?? value.display_name ?? model).trim() || model,
    name: String(value.displayName ?? value.display_name ?? model).trim() || model,
    isDefault: Boolean(value.isDefault ?? value.is_default ?? false),
  };
}

function mergeModelOptions(groups: Array<Array<OrchestrationModelOption | null>>): OrchestrationModelOption[] {
  const merged: OrchestrationModelOption[] = [];
  const seen = new Set<string>();
  for (const option of groups.flat()) {
    const value = option ? modelOptionValue(option) : null;
    if (!option || !value) {
      continue;
    }
    const identity = value.toLowerCase();
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    merged.push(option);
  }
  return merged.sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
}

async function loadDispatchModelOptions(engine: OrchestrationDispatchEngine, workspaceId: string | null): Promise<OrchestrationModelOption[]> {
  if (engine !== "codex") {
    const engineModels = await getEngineModels(engine);
    return mergeModelOptions([engineModels.map(mapEngineModelToOption)]);
  }
  if (!workspaceId) {
    return CODEX_MODEL_CATALOG.map((model, index) => ({
      id: model.id,
      model: model.id,
      label: model.label,
      name: model.label,
      isDefault: index === 0,
    }));
  }
  const [engineModelsResult, modelListResult, configModelResult] = await Promise.allSettled([
    getEngineModels("codex"),
    getModelList(workspaceId),
    getConfigModel(workspaceId),
  ]);
  const engineModels =
    engineModelsResult.status === "fulfilled"
      ? engineModelsResult.value.map(mapEngineModelToOption)
      : [];
  const response = modelListResult.status === "fulfilled" ? modelListResult.value : null;
  const rawData = response?.result?.data ?? response?.data ?? [];
  const catalogModels = Array.isArray(rawData)
    ? rawData.map(normalizeCodexModelRecord)
    : [];
  const configModel =
    configModelResult.status === "fulfilled" && configModelResult.value
      ? {
          id: configModelResult.value,
          model: configModelResult.value,
          label: `${configModelResult.value} (config)`,
          name: `${configModelResult.value} (config)`,
          isDefault: true,
        }
      : null;
  const fallbackModels = CODEX_MODEL_CATALOG.map((model, index) => ({
    id: model.id,
    model: model.id,
    label: model.label,
    name: model.label,
    isDefault: index === 0,
  }));
  const dynamicModels = mergeModelOptions([engineModels, [configModel], catalogModels]);
  return dynamicModels.length > 0 ? dynamicModels : fallbackModels;
}

function visibleQueueRisks(task: OrchestrationTask): {
  visible: OrchestrationTask["riskMarkers"];
  overflowCount: number;
} {
  return {
    visible: task.riskMarkers.slice(0, 2),
    overflowCount: Math.max(0, task.riskMarkers.length - 2),
  };
}

function taskProviderLabel(task: OrchestrationTask): string {
  return task.sourceRefs[0]?.providerId ?? "unknown";
}

function mergeOrchestrationTasks(input: {
  persistedTasks: OrchestrationTask[];
  providerSnapshots: OrchestrationProviderSnapshot[];
}): OrchestrationTask[] {
  const tasksById = new Map<string, OrchestrationTask>();
  for (const snapshot of input.providerSnapshots) {
    for (const candidate of snapshot.candidates) {
      tasksById.set(candidate.taskId, candidate);
    }
  }
  for (const task of input.persistedTasks) {
    tasksById.set(task.taskId, task);
  }
  return [...tasksById.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function createDefaultQueueFilters(workspaceId: string | null): OrchestrationQueueFilters {
  return {
    providerId: ORCHESTRATION_FILTER_ALL,
    status: ORCHESTRATION_FILTER_ALL,
    engine: ORCHESTRATION_FILTER_ALL,
    workspaceId: workspaceId ?? ORCHESTRATION_FILTER_ALL,
    sourceKind: ORCHESTRATION_FILTER_ALL,
    riskKind: ORCHESTRATION_FILTER_ALL,
  };
}

function taskProviderIds(task: OrchestrationTask): string[] {
  return task.sourceRefs.length > 0 ? task.sourceRefs.map((source) => source.providerId) : ["unknown"];
}

function taskSourceKinds(task: OrchestrationTask): OrchestrationSourceKind[] {
  return task.sourceRefs.map((source) => source.kind);
}

function taskRiskKinds(task: OrchestrationTask): OrchestrationRiskMarkerKind[] {
  return task.riskMarkers.map((risk) => risk.kind);
}

function hasMissingLinkedRun(task: OrchestrationTask): boolean {
  return (
    (task.status === "running" || task.status === "waiting_input" || task.status === "blocked") &&
    task.linkedRunIds.length === 0
  );
}

function latestLinkedRun(linkedRuns: TaskRunRecord[]): TaskRunRecord | null {
  return linkedRuns.reduce<TaskRunRecord | null>((latestRun, candidateRun) => {
    if (!latestRun || candidateRun.updatedAt > latestRun.updatedAt) {
      return candidateRun;
    }
    return latestRun;
  }, null);
}

function getLinkedRunsForTask(
  task: OrchestrationTask,
  taskRunsById: Map<string, TaskRunRecord>,
): TaskRunRecord[] {
  return task.linkedRunIds
    .map((runId) => taskRunsById.get(runId) ?? null)
    .filter((run): run is TaskRunRecord => Boolean(run));
}

function canCancelRun(run: TaskRunRecord | null): run is TaskRunRecord {
  return run !== null && QUEUED_RUN_STATUSES.has(run.status);
}

function resolveQueueStatus(
  task: OrchestrationTask,
  linkedRuns: TaskRunRecord[] = [],
): OrchestrationQueueStatus {
  if (task.status === "archived") {
    return "archived";
  }
  if (task.status === "completed") {
    return "done";
  }
  const latestRun = latestLinkedRun(linkedRuns);
  if (latestRun) {
    if (QUEUED_RUN_STATUSES.has(latestRun.status)) {
      return "queued";
    }
    if (RUNNING_RUN_STATUSES.has(latestRun.status)) {
      return "running";
    }
    if (latestRun.status === "failed") {
      return "failed";
    }
    if (latestRun.status === "completed") {
      return "review";
    }
    if (latestRun.status === "canceled") {
      return "todo";
    }
  }
  if (!hasMissingLinkedRun(task) && task.linkedRunIds.length > 0) {
    return "dispatched";
  }
  return "todo";
}

function filterOrchestrationTasks(
  tasks: OrchestrationTask[],
  filters: OrchestrationQueueFilters,
  taskRunsById: Map<string, TaskRunRecord>,
): OrchestrationTask[] {
  return tasks.filter((task) => {
    if (filters.status === ORCHESTRATION_FILTER_ALL && task.status === "archived") {
      return false;
    }

    const matchesWorkspace =
      filters.workspaceId === ORCHESTRATION_FILTER_ALL || task.workspaceId === filters.workspaceId;
    const matchesProvider =
      filters.providerId === ORCHESTRATION_FILTER_ALL ||
      taskProviderIds(task).includes(filters.providerId);
    const matchesStatus =
      filters.status === ORCHESTRATION_FILTER_ALL ||
      resolveQueueStatus(task, getLinkedRunsForTask(task, taskRunsById)) === filters.status;
    const matchesEngine =
      filters.engine === ORCHESTRATION_FILTER_ALL ||
      (filters.engine === "none" ? !task.preferredEngine : task.preferredEngine === filters.engine);
    const matchesSourceKind =
      filters.sourceKind === ORCHESTRATION_FILTER_ALL ||
      taskSourceKinds(task).includes(filters.sourceKind);
    const matchesRisk =
      filters.riskKind === ORCHESTRATION_FILTER_ALL ||
      taskRiskKinds(task).includes(filters.riskKind);

    return (
      matchesWorkspace &&
      matchesProvider &&
      matchesStatus &&
      matchesEngine &&
      matchesSourceKind &&
      matchesRisk
    );
  });
}

export function OrchestrationCenterView({
  workspaceId,
  workspaceName = null,
  persistedTasks,
  providerSnapshots,
  loading = false,
  selectedTaskId = null,
  onOpenSourceRef,
  onConfirmDispatch,
  onCreateManualTask,
  onCancelRun,
  onReviewAction,
  onArchiveTask,
  onOpenSession,
  taskRuns: providedTaskRuns,
  modelOptions: providedModelOptions,
  defaultModelId = null,
  onBackToProjectMap,
}: OrchestrationCenterViewProps) {
  const { t } = useTranslation();
  const taskRuns = providedTaskRuns ?? EMPTY_TASK_RUNS;
  const modelOptions = providedModelOptions ?? EMPTY_MODEL_OPTIONS;
  const [localSelectedTaskId, setLocalSelectedTaskId] = useState<string | null>(
    selectedTaskId,
  );
  const [filters, setFilters] = useState<OrchestrationQueueFilters>(() =>
    createDefaultQueueFilters(workspaceId),
  );
  const [dispatchDraft, setDispatchDraft] = useState<{
    taskId: string;
    engine: OrchestrationDispatchEngine;
    model: string;
    threadStrategy: OrchestrationTask["threadStrategy"];
  } | null>(null);
  const [reviewFeedbackKey, setReviewFeedbackKey] = useState<string | null>(null);
  const [dispatchModelOptions, setDispatchModelOptions] =
    useState<OrchestrationModelOption[]>(modelOptions);
  const dispatchDraftEngine = dispatchDraft?.engine ?? null;
  const [manualDraftOpen, setManualDraftOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState({
    title: "",
    scopeSummary: "",
    acceptanceSummary: "",
    promptSummary: "",
    preferredEngine: "codex" as OrchestrationDispatchEngine,
  });
  useEffect(() => {
    if (selectedTaskId) {
      setLocalSelectedTaskId(selectedTaskId);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    setReviewFeedbackKey(null);
  }, [localSelectedTaskId]);

  useEffect(() => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      workspaceId: workspaceId ?? ORCHESTRATION_FILTER_ALL,
    }));
  }, [workspaceId]);
  useEffect(() => {
    if (!dispatchDraftEngine) {
      setDispatchModelOptions(modelOptions);
      return;
    }

    let cancelled = false;
    loadDispatchModelOptions(dispatchDraftEngine, workspaceId)
      .then((loadedModelOptions) => {
        if (cancelled) {
          return;
        }
        const nextOptions =
          loadedModelOptions.length > 0
            ? loadedModelOptions
            : modelOptions;
        setDispatchModelOptions(nextOptions);
        setDispatchDraft((currentDraft) => {
          if (!currentDraft || currentDraft.engine !== dispatchDraftEngine) {
            return currentDraft;
          }
          const nextModel = resolveDefaultModelValue(
            nextOptions,
            normalizeModelId(currentDraft.model),
          );
          return nextModel === currentDraft.model
            ? currentDraft
            : { ...currentDraft, model: nextModel };
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("[agent-orchestration] Failed to load dispatch models", error);
          setDispatchModelOptions(modelOptions);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dispatchDraftEngine, modelOptions, workspaceId]);

  const taskRunsById = useMemo(() => {
    const nextRunsById = new Map<string, TaskRunRecord>();
    for (const run of taskRuns) {
      nextRunsById.set(run.runId, run);
    }
    return nextRunsById;
  }, [taskRuns]);
  const tasks = useMemo(
    () => mergeOrchestrationTasks({ persistedTasks, providerSnapshots }),
    [persistedTasks, providerSnapshots],
  );
  const filteredTasks = useMemo(
    () => filterOrchestrationTasks(tasks, filters, taskRunsById),
    [tasks, filters, taskRunsById],
  );
  const statusOptions = useMemo(
    () =>
      ORCHESTRATION_QUEUE_STATUS_ORDER.filter((status) =>
        tasks.some((task) => resolveQueueStatus(task, getLinkedRunsForTask(task, taskRunsById)) === status),
      ).map((status) => ({ value: status, label: status })),
    [tasks, taskRunsById],
  );
  const degradedProviders = useMemo(
    () => providerSnapshots.flatMap((snapshot) => snapshot.degraded),
    [providerSnapshots],
  );
  const availableProviderCount = useMemo(
    () => providerSnapshots.filter((snapshot) => snapshot.available).length,
    [providerSnapshots],
  );
  const selectedTaskFromAllTasks =
    localSelectedTaskId ? tasks.find((task) => task.taskId === localSelectedTaskId) ?? null : null;
  const selectedTask = selectedTaskFromAllTasks ?? filteredTasks[0] ?? null;
  const selectedLinkedRuns = selectedTask
    ? getLinkedRunsForTask(selectedTask, taskRunsById)
    : [];
  const selectedQueueStatus = selectedTask
    ? resolveQueueStatus(selectedTask, selectedLinkedRuns)
    : null;
  const selectedCanReview = selectedTask
    ? canReviewTask(selectedTask, selectedLinkedRuns)
    : false;
  const selectedHasOrphanReviewIntent = Boolean(
    selectedTask &&
    hasReviewIntent(selectedTask) &&
    !hasCompletedLinkedRun(selectedLinkedRuns),
  );
  const selectedTaskHiddenByFilters = Boolean(
    selectedTaskFromAllTasks &&
    !filteredTasks.some((task) => task.taskId === selectedTaskFromAllTasks.taskId),
  );
  const openableSourceRef = selectedTask
    ? [...selectedTask.sourceRefs, ...selectedTask.evidenceRefs].find(canOpenSourceRef) ?? null
    : null;
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "workspaceId" && value !== ORCHESTRATION_FILTER_ALL,
  ).length;
  const updateFilter = (
    key: keyof OrchestrationQueueFilters,
    value: OrchestrationQueueFilters[keyof OrchestrationQueueFilters],
  ) => {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
  };
  const resetFilters = () => setFilters(createDefaultQueueFilters(workspaceId));
  const canCreateManualDraft = Boolean(workspaceId && onCreateManualTask);
  const canSubmitManualDraft =
    canCreateManualDraft &&
    manualDraft.title.trim().length > 0 &&
    manualDraft.scopeSummary.trim().length > 0 &&
    manualDraft.acceptanceSummary.trim().length > 0;
  const submitManualDraft = () => {
    if (!canSubmitManualDraft) {
      return;
    }
    const createdTask = onCreateManualTask?.({
      title: manualDraft.title,
      scopeSummary: manualDraft.scopeSummary,
      acceptanceSummary: manualDraft.acceptanceSummary,
      promptSummary: manualDraft.promptSummary,
      preferredEngine: manualDraft.preferredEngine,
    }) ?? null;
    if (createdTask) {
      setLocalSelectedTaskId(createdTask.taskId);
    }
    setManualDraft({
      title: "",
      scopeSummary: "",
      acceptanceSummary: "",
      promptSummary: "",
      preferredEngine: "codex",
    });
    setManualDraftOpen(false);
  };
  const openDispatchGate = (task: OrchestrationTask) => {
    setDispatchDraft({
      taskId: task.taskId,
      engine: resolveDispatchEngine(task),
      model: resolveDefaultModelValue(modelOptions, task.preferredModel ?? defaultModelId),
      threadStrategy: task.threadStrategy,
    });
  };
  const dispatchToTaskCenter = (task: OrchestrationTask) => {
    if (!onConfirmDispatch) {
      return;
    }
    setLocalSelectedTaskId(task.taskId);
    const draft =
      dispatchDraft?.taskId === task.taskId
        ? dispatchDraft
        : {
            engine: resolveDispatchEngine(task),
            model: task.preferredModel ?? defaultModelId ?? "",
            threadStrategy: task.threadStrategy,
          };

    void onConfirmDispatch({
      task,
      workspaceId: task.workspaceId,
      engine: draft.engine,
      model: normalizeModelId(draft.model),
      threadStrategy: draft.threadStrategy,
      promptSummary: task.promptSummary ?? task.scopeSummary,
      acceptanceSummary: task.acceptanceSummary,
      sourceRefs: task.sourceRefs,
    });
    setDispatchDraft(null);
  };

  if (loading) {
    return (
      <section className="orchestration-center is-loading" aria-label={t("agentOrchestration.title")} aria-busy>
        <p className="orchestration-center__eyebrow">{t("agentOrchestration.eyebrow")}</p>
        <h2>{t("agentOrchestration.loadingTitle")}</h2>
        <p>{t("agentOrchestration.loadingDescription")}</p>
      </section>
    );
  }

  return (
    <section className="orchestration-center" aria-label={t("agentOrchestration.title")}>
      <header className="orchestration-center__header">
        <div>
          <p className="orchestration-center__eyebrow">{t("agentOrchestration.eyebrow")}</p>
          <h2>{t("agentOrchestration.title")}</h2>
          <p className="orchestration-center__summary">
            {t("agentOrchestration.summary", {
              total: filteredTasks.length,
              providers: availableProviderCount,
              workspace: workspaceName ?? workspaceId ?? t("agentOrchestration.workspaceUnknown"),
            })}
            {tasks.length > filteredTasks.length ? (
              <span>
                {" "}
                {t("agentOrchestration.filters.visibleSummary", {
                  visible: filteredTasks.length,
                  total: tasks.length,
                })}
              </span>
            ) : null}
          </p>
        </div>
        {onBackToProjectMap ? (
          <button className="orchestration-center__back" type="button" onClick={onBackToProjectMap}>
            {t("agentOrchestration.action.backToProjectMap")}
          </button>
        ) : null}
        {onCreateManualTask ? (
          <button
            className="orchestration-center__back"
            type="button"
            disabled={!workspaceId}
            onClick={() => setManualDraftOpen((open) => !open)}
          >
            {t("agentOrchestration.manual.open")}
          </button>
        ) : null}
      </header>

      {manualDraftOpen ? (
        <section className="orchestration-center__manual-draft" aria-label={t("agentOrchestration.manual.title")}>
          <div>
            <p className="orchestration-center__eyebrow">{t("agentOrchestration.manual.eyebrow")}</p>
            <h4>{t("agentOrchestration.manual.title")}</h4>
            <p>{t("agentOrchestration.manual.description")}</p>
          </div>
          <label>
            <span>{t("agentOrchestration.manual.fieldTitle")}</span>
            <input
              value={manualDraft.title}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, title: event.currentTarget.value }))
              }
            />
          </label>
          <label>
            <span>{t("agentOrchestration.manual.fieldScope")}</span>
            <textarea
              value={manualDraft.scopeSummary}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, scopeSummary: event.currentTarget.value }))
              }
            />
          </label>
          <label>
            <span>{t("agentOrchestration.manual.fieldAcceptance")}</span>
            <textarea
              value={manualDraft.acceptanceSummary}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, acceptanceSummary: event.currentTarget.value }))
              }
            />
          </label>
          <label>
            <span>{t("agentOrchestration.manual.fieldPrompt")}</span>
            <textarea
              value={manualDraft.promptSummary}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, promptSummary: event.currentTarget.value }))
              }
            />
          </label>
          <label>
            <span>{t("agentOrchestration.dispatch.engine")}</span>
            <select
              value={manualDraft.preferredEngine}
              onChange={(event) =>
                setManualDraft((current) => ({
                  ...current,
                  preferredEngine: event.currentTarget.value as OrchestrationDispatchEngine,
                }))
              }
            >
              {ORCHESTRATION_DISPATCH_ENGINES.map((engine) => (
                <option key={engine} value={engine}>
                  {engine}
                </option>
              ))}
            </select>
          </label>
          <div className="orchestration-center__review-actions">
            <button type="button" onClick={() => setManualDraftOpen(false)}>
              {t("agentOrchestration.manual.cancel")}
            </button>
            <button type="button" disabled={!canSubmitManualDraft} onClick={submitManualDraft}>
              {t("agentOrchestration.manual.create")}
            </button>
          </div>
        </section>
      ) : null}

      {degradedProviders.length > 0 ? (
        <div className="orchestration-center__degraded" role="status">
          <strong>{t("agentOrchestration.degradedTitle")}</strong>
          <span>
            {degradedProviders.map((provider) => provider.label || provider.reason).join(" · ")}
          </span>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div className="orchestration-center__filters" aria-label={t("agentOrchestration.filters.label")}>
          <label>
            <span>{t("agentOrchestration.filters.status")}</span>
            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value as OrchestrationQueueFilters["status"],
                )
              }
            >
              <option value={ORCHESTRATION_FILTER_ALL}>{t("agentOrchestration.filters.allStatuses")}</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`agentOrchestration.queueStatus.${option.value}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="orchestration-center__filter-reset"
            disabled={activeFilterCount === 0 && filters.workspaceId === (workspaceId ?? ORCHESTRATION_FILTER_ALL)}
            onClick={resetFilters}
          >
            {t("agentOrchestration.filters.reset")}
          </button>
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <article className="orchestration-center__empty">
          <h3>{t("agentOrchestration.emptyTitle")}</h3>
          <p>{t("agentOrchestration.emptyDescription")}</p>
        </article>
      ) : filteredTasks.length === 0 && !selectedTask ? (
        <article className="orchestration-center__empty">
          <h3>{t("agentOrchestration.filters.emptyTitle")}</h3>
          <p>{t("agentOrchestration.filters.emptyDescription")}</p>
        </article>
      ) : (
        <div className="orchestration-center__body">
          <div className="orchestration-center__queue">
            {filteredTasks.map((task) => {
              const linkedRuns = getLinkedRunsForTask(task, taskRunsById);
              const queueStatus = resolveQueueStatus(task, linkedRuns);
              const visibleRisks = visibleQueueRisks(task);

              return (
                <button
                  key={task.taskId}
                  type="button"
                  aria-label={`${task.title}. ${t("agentOrchestration.queue.taskLabel", {
                    title: task.title,
                    status: t(`agentOrchestration.queueStatus.${queueStatus}`),
                    provider: taskProviderLabel(task),
                    risks: task.riskMarkers.length,
                  })}`}
                  className={`orchestration-center__task orchestration-center__task--${queueStatus} ${
                    selectedTask?.taskId === task.taskId ? "is-selected" : ""
                  }`}
                  onClick={() => setLocalSelectedTaskId(task.taskId)}
                >
                  <span className="orchestration-center__task-topline">
                    <strong>{task.title}</strong>
                    <em className={`orchestration-center__status-chip orchestration-center__status-chip--${queueStatus}`}>
                      {t(`agentOrchestration.queueStatus.${queueStatus}`)}
                    </em>
                  </span>
                  <span>{taskProviderLabel(task)}</span>
                  {hasMissingLinkedRun(task) ? (
                    <span className="orchestration-center__risk-chip orchestration-center__risk-chip--missing_linked_session">
                      {t("agentOrchestration.detail.missingLinkedRun")}
                    </span>
                  ) : null}
                  {task.riskMarkers.length > 0 ? (
                    <span
                      className="orchestration-center__task-risks"
                      aria-label={t("agentOrchestration.queue.riskCount", {
                        count: task.riskMarkers.length,
                      })}
                    >
                      {visibleRisks.visible.map((risk) => (
                        <span
                          key={`${risk.kind}:${risk.sourceRefId ?? risk.label}`}
                          className={`orchestration-center__risk-chip orchestration-center__risk-chip--${risk.kind}`}
                        >
                          {risk.label}
                        </span>
                      ))}
                      {visibleRisks.overflowCount > 0 ? (
                        <span className="orchestration-center__risk-chip">
                          {t("agentOrchestration.queue.riskOverflow", {
                            count: visibleRisks.overflowCount,
                          })}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <small>{task.scopeSummary}</small>
                </button>
              );
            })}
          </div>

          {selectedTask ? (
            <article className="orchestration-center__detail">
              <div className="orchestration-center__detail-head">
                <div>
                  <p className="orchestration-center__eyebrow">{selectedTask.taskId}</p>
                  <h3>{selectedTask.title}</h3>
                  <p>{selectedTask.scopeSummary}</p>
                </div>
                <span className={`orchestration-center__status-pill orchestration-center__status-chip orchestration-center__status-chip--${selectedQueueStatus ?? "todo"}`}>
                  {t(`agentOrchestration.queueStatus.${selectedQueueStatus ?? "todo"}`)}
                </span>
              </div>
              {selectedTaskHiddenByFilters ? (
                <div className="orchestration-center__sticky-selection" role="status">
                  <strong>{t("agentOrchestration.detail.selectionPreservedTitle")}</strong>
                  <span>{t("agentOrchestration.detail.selectionPreservedDescription")}</span>
                </div>
              ) : null}
              {selectedHasOrphanReviewIntent ? (
                <div className="orchestration-center__review-missing-run" role="status">
                  <strong>{t("agentOrchestration.review.missingRunTitle")}</strong>
                  <span>{t("agentOrchestration.review.missingRunDescription")}</span>
                </div>
              ) : null}
              <div className="orchestration-center__action-rail" aria-label={t("agentOrchestration.actions.label")}>
                {openableSourceRef && onOpenSourceRef ? (
                  <button
                    type="button"
                    aria-label={`${t("agentOrchestration.actions.openSourceLabel", {
                      title: selectedTask.title,
                    })}: ${selectedTask.title}`}
                    onClick={() => onOpenSourceRef({ task: selectedTask, sourceRef: openableSourceRef })}
                  >
                    {t("agentOrchestration.actions.openSource")}
                  </button>
                ) : null}
                {canDispatchTask(selectedTask, selectedLinkedRuns) && onConfirmDispatch ? (
                  <button
                    type="button"
                    aria-label={`${t("agentOrchestration.dispatch.openLabel", {
                      title: selectedTask.title,
                    })}: ${selectedTask.title}`}
                    onClick={() => openDispatchGate(selectedTask)}
                  >
                    {t("agentOrchestration.dispatch.open")}
                  </button>
                ) : null}
                {canArchiveTask(selectedTask) && onArchiveTask ? (
                  <button type="button" onClick={() => onArchiveTask(selectedTask)}>
                    {t("agentOrchestration.actions.archive")}
                  </button>
                ) : null}
              </div>
              {hasMissingLinkedRun(selectedTask) ? (
                <p className="orchestration-center__dispatch-disabled" role="status">
                  {t("agentOrchestration.detail.missingLinkedRun")}
                </p>
              ) : null}
              {dispatchDraft?.taskId === selectedTask.taskId ? (
                <section className="orchestration-center__dispatch-gate" aria-label={t("agentOrchestration.dispatch.title")}>
                  <div>
                    <p className="orchestration-center__eyebrow">{t("agentOrchestration.dispatch.eyebrow")}</p>
                    <h4>{t("agentOrchestration.dispatch.title")}</h4>
                    <p>{t("agentOrchestration.dispatch.description")}</p>
                  </div>
                  <label>
                    <span>{t("agentOrchestration.dispatch.engine")}</span>
                    <select
                      value={dispatchDraft.engine}
                      onChange={(event) =>
                        setDispatchDraft((currentDraft) =>
                          currentDraft
                            ? {
                                ...currentDraft,
                                engine: event.target.value as OrchestrationDispatchEngine,
                                model: "",
                              }
                            : currentDraft,
                        )
                      }
                    >
                      {ORCHESTRATION_DISPATCH_ENGINES.map((engine) => (
                        <option key={engine} value={engine}>
                          {engine}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t("agentOrchestration.dispatch.model")}</span>
                    <input
                      list="orchestration-dispatch-models"
                      value={dispatchDraft.model}
                      placeholder={t("agentOrchestration.dispatch.defaultModel")}
                      onChange={(event) =>
                        setDispatchDraft((currentDraft) =>
                          currentDraft
                            ? {
                                ...currentDraft,
                                model: event.target.value,
                              }
                            : currentDraft,
                        )
                      }
                    />
                    <datalist id="orchestration-dispatch-models">
                      {dispatchModelOptions.map((option) => {
                        const value = modelOptionValue(option);
                        if (!value) {
                          return null;
                        }
                        return (
                          <option key={value} value={value}>
                            {modelOptionLabel(option)}
                          </option>
                        );
                      })}
                    </datalist>
                  </label>
                  <label>
                    <span>{t("agentOrchestration.dispatch.threadStrategy")}</span>
                    <select
                      value={dispatchDraft.threadStrategy}
                      onChange={(event) =>
                        setDispatchDraft((currentDraft) =>
                          currentDraft
                            ? {
                                ...currentDraft,
                                threadStrategy: event.target.value as OrchestrationTask["threadStrategy"],
                              }
                            : currentDraft,
                        )
                      }
                    >
                      {(["new_thread", "reuse_active_thread", "choose_thread"] as const).map((strategy) => (
                        <option key={strategy} value={strategy}>
                          {t(`agentOrchestration.threadStrategy.${strategy}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <dl className="orchestration-center__facts">
                    <div>
                      <dt>{t("agentOrchestration.dispatch.promptSummary")}</dt>
                      <dd>{selectedTask.promptSummary ?? selectedTask.scopeSummary}</dd>
                    </div>
                    <div>
                      <dt>{t("agentOrchestration.dispatch.acceptance")}</dt>
                      <dd>{selectedTask.acceptanceSummary || t("agentOrchestration.unavailable")}</dd>
                    </div>
                  </dl>
                  <div className="orchestration-center__review-actions">
                    <button type="button" onClick={() => setDispatchDraft(null)}>
                      {t("agentOrchestration.dispatch.cancel")}
                    </button>
                    <button type="button" onClick={() => dispatchToTaskCenter(selectedTask)}>
                      {t("agentOrchestration.dispatch.confirm")}
                    </button>
                  </div>
                </section>
              ) : null}
              {selectedCanReview ? (
                <section
                  className="orchestration-center__review-gate"
                  aria-label={t("agentOrchestration.review.label")}
                >
                  <div>
                    <h4>{t("agentOrchestration.review.title")}</h4>
                    <p>{t("agentOrchestration.review.description")}</p>
                  </div>
                  <div className="orchestration-center__review-actions">
                    <button
                      type="button"
                      disabled={!onReviewAction}
                      onClick={() => {
                        onReviewAction?.({ task: selectedTask, action: "accept_result" });
                        setReviewFeedbackKey("accepted");
                      }}
                    >
                      {t("agentOrchestration.review.accept")}
                    </button>
                    <button
                      type="button"
                      disabled={!onReviewAction}
                      onClick={() => {
                        onReviewAction?.({ task: selectedTask, action: "request_changes" });
                        setReviewFeedbackKey("changesRequested");
                      }}
                    >
                      {t("agentOrchestration.review.requestChanges")}
                    </button>
                    <button
                      type="button"
                      disabled={!onReviewAction}
                      onClick={() => {
                        onReviewAction?.({ task: selectedTask, action: "create_follow_up" });
                        setReviewFeedbackKey("followUpCreated");
                      }}
                    >
                      {t("agentOrchestration.review.createFollowUp")}
                    </button>
                  </div>
                  {reviewFeedbackKey ? (
                    <p className="orchestration-center__review-feedback" role="status">
                      {t(`agentOrchestration.review.feedback.${reviewFeedbackKey}`)}
                    </p>
                  ) : null}
                </section>
              ) : null}
              <dl className="orchestration-center__facts">
                <div>
                  <dt>{t("agentOrchestration.detail.scope")}</dt>
                  <dd>{selectedTask.scopeSummary || t("agentOrchestration.unavailable")}</dd>
                </div>
                <div>
                  <dt>{t("agentOrchestration.detail.acceptance")}</dt>
                  <dd>{selectedTask.acceptanceSummary || t("agentOrchestration.unavailable")}</dd>
                </div>
                <div>
                  <dt>{t("agentOrchestration.detail.updatedAt")}</dt>
                  <dd>{formatOrchestrationTime(selectedTask.updatedAt)}</dd>
                </div>
                <div>
                  <dt>{t("agentOrchestration.detail.linkCountsLabel")}</dt>
                  <dd>
                    {t("agentOrchestration.detail.linkCounts", {
                      runs: selectedTask.linkedRunIds.length,
                      sessions: selectedTask.linkedSessionIds.length,
                    })}
                  </dd>
                </div>
              </dl>

              <section className="orchestration-center__detail-section">
                <div className="orchestration-center__section-head">
                  <h4>{t("agentOrchestration.detail.providerSources")}</h4>
                  <span>{selectedTask.sourceRefs.length}</span>
                </div>
                {selectedTask.sourceRefs.length > 0 ? (
                  <ul className="orchestration-center__ref-list">
                    {selectedTask.sourceRefs.map((sourceRef) => (
                      <li key={`${sourceRef.providerId}:${sourceRef.kind}:${sourceRef.id}`}>
                        <strong>{sourceRef.label}</strong>
                        <span>{sourceRefMetaLabels(sourceRef).join(" · ")}</span>
                        {sourceRefLocationLabel(sourceRef) ? (
                          <small>{sourceRefLocationLabel(sourceRef)}</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="orchestration-center__empty-inline">{t("agentOrchestration.noRefs")}</p>
                )}
              </section>

              <section className="orchestration-center__detail-section">
                <div className="orchestration-center__section-head">
                  <h4>{t("agentOrchestration.detail.evidence")}</h4>
                  <span>
                    {t("agentOrchestration.detail.evidenceCount", {
                      count: selectedTask.evidenceRefs.length,
                    })}
                  </span>
                </div>
                {selectedTask.evidenceRefs.length > 0 ? (
                  <ul className="orchestration-center__ref-list">
                    {selectedTask.evidenceRefs.map((evidenceRef) => (
                      <li key={`${evidenceRef.providerId}:${evidenceRef.kind}:${evidenceRef.id}`}>
                        <strong>{evidenceRef.label}</strong>
                        <span>{sourceRefMetaLabels(evidenceRef).join(" · ")}</span>
                        {sourceRefLocationLabel(evidenceRef) ? (
                          <small>{sourceRefLocationLabel(evidenceRef)}</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="orchestration-center__empty-inline">{t("agentOrchestration.noEvidenceRefs")}</p>
                )}
              </section>

              <section className="orchestration-center__detail-section">
                <div className="orchestration-center__section-head">
                  <h4>{t("agentOrchestration.detail.risks")}</h4>
                  <span>{selectedTask.riskMarkers.length}</span>
                </div>
                {selectedTask.riskMarkers.length > 0 ? (
                  <div className="orchestration-center__chip-list">
                    {selectedTask.riskMarkers.map((risk) => (
                      <span
                        key={`${risk.kind}:${risk.sourceRefId ?? risk.label}`}
                        className={`orchestration-center__risk-chip orchestration-center__risk-chip--${risk.kind}`}
                      >
                        {risk.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="orchestration-center__empty-inline">{t("agentOrchestration.noRisks")}</p>
                )}
              </section>

              <section className="orchestration-center__detail-section">
                <div className="orchestration-center__section-head">
                  <h4>{t("agentOrchestration.detail.runManagement")}</h4>
                </div>
                {selectedTask.linkedRunIds.length > 0 ? (
                  <div className="orchestration-center__run-list">
                    {selectedTask.linkedRunIds.map((runId) => {
                      const linkedRun = selectedLinkedRuns.find((run) => run.runId === runId) ?? null;
                      const sessionId = linkedRun?.linkedThreadId ?? null;

                      return (
                        <article key={runId} className="orchestration-center__run-card">
                          <div className="orchestration-center__run-card-head">
                            <div>
                              <strong>{linkedRun?.task.title || runId}</strong>
                              <small>{runId}</small>
                            </div>
                            {linkedRun ? (
                              <span className={`orchestration-center__status-chip orchestration-center__status-chip--${linkedRun.status}`}>
                                {t(`taskCenter.status.${linkedRun.status}`)}
                              </span>
                            ) : (
                              <span className="orchestration-center__risk-chip orchestration-center__risk-chip--missing_linked_session">
                                {t("agentOrchestration.detail.linkedRunMissing")}
                              </span>
                            )}
                          </div>
                          {linkedRun ? (
                            <dl className="orchestration-center__run-facts">
                              <div>
                                <dt>{t("agentOrchestration.detail.runEngine")}</dt>
                                <dd>{linkedRun.engine}</dd>
                              </div>
                              <div>
                                <dt>{t("agentOrchestration.detail.runUpdatedAt")}</dt>
                                <dd>{formatRunTime(linkedRun.updatedAt)}</dd>
                              </div>
                              <div>
                                <dt>{t("agentOrchestration.detail.runCurrentStep")}</dt>
                                <dd>{linkedRun.currentStep || t("agentOrchestration.unavailable")}</dd>
                              </div>
                              <div>
                                <dt>{t("agentOrchestration.detail.runLatestOutput")}</dt>
                                <dd>{linkedRun.latestOutputSummary || t("agentOrchestration.unavailable")}</dd>
                              </div>
                            </dl>
                          ) : null}
                          <div className="orchestration-center__run-actions">
                            {sessionId && onOpenSession ? (
                              <button type="button" onClick={() => onOpenSession(selectedTask, sessionId)}>
                                {t("agentOrchestration.actions.openSession")}
                              </button>
                            ) : null}
                            {canCancelRun(linkedRun) && onCancelRun ? (
                              <button type="button" onClick={() => onCancelRun({ task: selectedTask, run: linkedRun })}>
                                {t("agentOrchestration.actions.cancelQueuedRun")}
                              </button>
                            ) : null}
                            {!sessionId && !canCancelRun(linkedRun) ? (
                              <span>{t("agentOrchestration.detail.noLinkedSessions")}</span>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="orchestration-center__empty-inline">{t("agentOrchestration.detail.noLinkedRuns")}</p>
                )}
              </section>

              <section className="orchestration-center__detail-section">
                <div className="orchestration-center__section-head">
                  <h4>{t("agentOrchestration.detail.activity")}</h4>
                </div>
                <dl className="orchestration-center__activity">
                  <div>
                    <dt>{t("agentOrchestration.detail.createdAt")}</dt>
                    <dd>{formatOrchestrationTime(selectedTask.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>{t("agentOrchestration.detail.updatedAt")}</dt>
                    <dd>{formatOrchestrationTime(selectedTask.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>{t("agentOrchestration.detail.reviewState")}</dt>
                    <dd>{t(`agentOrchestration.reviewState.${selectedTask.reviewState ?? "not_started"}`)}</dd>
                  </div>
                  <div>
                    <dt>{t("agentOrchestration.detail.threadStrategy")}</dt>
                    <dd>{t(`agentOrchestration.threadStrategy.${selectedTask.threadStrategy}`)}</dd>
                  </div>
                  <div>
                    <dt>{t("agentOrchestration.detail.preferredEngine")}</dt>
                    <dd>{selectedTask.preferredEngine ?? t("agentOrchestration.filters.noEngine")}</dd>
                  </div>
                  <div>
                    <dt>{t("agentOrchestration.detail.preferredModel")}</dt>
                    <dd>{selectedTask.preferredModel ?? t("agentOrchestration.dispatch.defaultModel")}</dd>
                  </div>
                  <div>
                    <dt>{t("agentOrchestration.detail.parentTask")}</dt>
                    <dd>{selectedTask.parentTaskId ?? t("agentOrchestration.unavailable")}</dd>
                  </div>
                </dl>
              </section>
            </article>
          ) : null}
        </div>
      )}

    </section>
  );
}
