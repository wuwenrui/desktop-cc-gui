import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import type {
  CreateOrchestrationTaskInput,
  OrchestrationProviderCapability,
  OrchestrationReviewState,
  OrchestrationRiskMarker,
  OrchestrationRiskMarkerKind,
  OrchestrationSourceRef,
  OrchestrationTask,
  OrchestrationTaskPatch,
  OrchestrationTaskStatus,
  OrchestrationTaskStoreData,
  OrchestrationThreadStrategy,
} from "../types";

export const ORCHESTRATION_TASK_STORE_KEY = "agentOrchestration.tasks";

const STORE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const normalized = normalizeString(entry);
        return normalized ? [normalized] : [];
      })
    : [];
}

function normalizeTaskStatus(value: unknown): OrchestrationTaskStatus {
  return value === "candidate" ||
    value === "planned" ||
    value === "ready" ||
    value === "running" ||
    value === "waiting_input" ||
    value === "blocked" ||
    value === "review_needed" ||
    value === "completed" ||
    value === "archived"
    ? value
    : "candidate";
}

function normalizeThreadStrategy(value: unknown): OrchestrationThreadStrategy {
  return value === "reuse_active_thread" || value === "choose_thread"
    ? value
    : "new_thread";
}

function normalizeReviewState(value: unknown): OrchestrationReviewState | undefined {
  return value === "not_started" ||
    value === "needs_review" ||
    value === "accepted" ||
    value === "changes_requested"
    ? value
    : undefined;
}

function normalizeCapabilities(value: unknown): OrchestrationProviderCapability[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.filter((entry): entry is OrchestrationProviderCapability =>
    entry === "read_candidates" ||
    entry === "open_source" ||
    entry === "create_task" ||
    entry === "dispatch" ||
    entry === "write_back",
  )));
}

function normalizeRiskKind(value: unknown): OrchestrationRiskMarkerKind | null {
  return value === "provider_degraded" ||
    value === "stale_source" ||
    value === "low_confidence" ||
    value === "unknown_confidence" ||
    value === "candidate_source" ||
    value === "missing_evidence" ||
    value === "missing_linked_session"
    ? value
    : null;
}

function normalizeMetadata(value: unknown): OrchestrationSourceRef["metadata"] {
  if (!isRecord(value)) {
    return undefined;
  }
  const metadata: NonNullable<OrchestrationSourceRef["metadata"]> = {};
  for (const [key, metadataValue] of Object.entries(value)) {
    if (
      typeof metadataValue === "string" ||
      typeof metadataValue === "number" ||
      typeof metadataValue === "boolean" ||
      metadataValue === null
    ) {
      metadata[key] = metadataValue;
    }
  }
  return metadata;
}

function normalizeSourceRefs(value: unknown): OrchestrationSourceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry): OrchestrationSourceRef[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const providerId = normalizeString(entry.providerId);
    const kind = normalizeString(entry.kind);
    const id = normalizeString(entry.id);
    const label = normalizeString(entry.label);
    if (!providerId || !kind || !id || !label) {
      return [];
    }
    return [{
      providerId,
      kind,
      id,
      label,
      path: normalizeString(entry.path) ?? undefined,
      workspaceRelativePath: normalizeString(entry.workspaceRelativePath) ?? undefined,
      confidence:
        entry.confidence === "high" ||
        entry.confidence === "medium" ||
        entry.confidence === "low" ||
        entry.confidence === "unknown"
          ? entry.confidence
          : undefined,
      stale: entry.stale === true,
      capabilities: normalizeCapabilities(entry.capabilities),
      metadata: normalizeMetadata(entry.metadata),
    }];
  });
}

function normalizeRiskMarkers(value: unknown): OrchestrationRiskMarker[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry): OrchestrationRiskMarker[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const kind = normalizeRiskKind(entry.kind);
    const label = normalizeString(entry.label);
    if (!kind || !label) {
      return [];
    }
    return [{
      kind,
      label,
      sourceRefId: normalizeString(entry.sourceRefId) ?? undefined,
    }];
  });
}

function normalizeTask(raw: unknown): OrchestrationTask | null {
  if (!isRecord(raw)) {
    return null;
  }
  const taskId = normalizeString(raw.taskId);
  const workspaceId = normalizeString(raw.workspaceId);
  const title = normalizeString(raw.title);
  const scopeSummary = normalizeString(raw.scopeSummary);
  if (!taskId || !workspaceId || !title || !scopeSummary) {
    return null;
  }
  const now = new Date(0).toISOString();
  return {
    taskId,
    workspaceId,
    title,
    status: normalizeTaskStatus(raw.status),
    sourceRefs: normalizeSourceRefs(raw.sourceRefs),
    evidenceRefs: normalizeSourceRefs(raw.evidenceRefs),
    riskMarkers: normalizeRiskMarkers(raw.riskMarkers),
    scopeSummary,
    acceptanceSummary: normalizeString(raw.acceptanceSummary) ?? "",
    promptSummary: normalizeString(raw.promptSummary),
    preferredEngine:
      raw.preferredEngine === "claude" ||
      raw.preferredEngine === "codex" ||
      raw.preferredEngine === "gemini"
        ? raw.preferredEngine
        : null,
    preferredModel: normalizeString(raw.preferredModel),
    threadStrategy: normalizeThreadStrategy(raw.threadStrategy),
    linkedRunIds: normalizeStringArray(raw.linkedRunIds),
    linkedSessionIds: normalizeStringArray(raw.linkedSessionIds),
    parentTaskId: normalizeString(raw.parentTaskId),
    reviewState: normalizeReviewState(raw.reviewState),
    createdAt: normalizeString(raw.createdAt) ?? now,
    updatedAt: normalizeString(raw.updatedAt) ?? now,
    archivedAt: normalizeString(raw.archivedAt),
  };
}

function sortTasksNewestFirst(tasks: OrchestrationTask[]): OrchestrationTask[] {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function makeTaskId(title: string, now: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "task";
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `orchestration-${slug}-${Date.parse(now) || 0}-${suffix}`;
}

export function normalizeOrchestrationTaskStore(raw: unknown): OrchestrationTaskStoreData {
  if (!isRecord(raw)) {
    return { version: STORE_VERSION, tasks: [] };
  }
  const tasksById = new Map<string, OrchestrationTask>();
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  for (const rawTask of rawTasks) {
    const task = normalizeTask(rawTask);
    if (!task) {
      continue;
    }
    const previous = tasksById.get(task.taskId);
    if (!previous || previous.updatedAt <= task.updatedAt) {
      tasksById.set(task.taskId, task);
    }
  }
  return {
    version: STORE_VERSION,
    tasks: sortTasksNewestFirst([...tasksById.values()]),
  };
}

export function loadOrchestrationTaskStore(): OrchestrationTaskStoreData {
  return normalizeOrchestrationTaskStore(
    getClientStoreSync<Record<string, unknown>>("app", ORCHESTRATION_TASK_STORE_KEY),
  );
}

export function saveOrchestrationTaskStore(store: OrchestrationTaskStoreData): void {
  writeClientStoreValue("app", ORCHESTRATION_TASK_STORE_KEY, normalizeOrchestrationTaskStore(store), {
    immediate: true,
  });
}

export function listOrchestrationTasksForWorkspace(
  store: OrchestrationTaskStoreData,
  workspaceId: string,
  options?: { includeArchived?: boolean },
): OrchestrationTask[] {
  return store.tasks.filter((task) =>
    task.workspaceId === workspaceId &&
    (options?.includeArchived || task.status !== "archived"),
  );
}

export function createOrchestrationTask(
  input: CreateOrchestrationTaskInput,
): OrchestrationTask {
  const now = input.now ?? new Date().toISOString();
  return {
    taskId: input.taskId ?? makeTaskId(input.title, now),
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    status: input.status ?? "planned",
    sourceRefs: input.sourceRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    riskMarkers: input.riskMarkers ?? [],
    scopeSummary: input.scopeSummary.trim(),
    acceptanceSummary: input.acceptanceSummary.trim(),
    promptSummary: input.promptSummary ?? null,
    preferredEngine: input.preferredEngine ?? null,
    preferredModel: input.preferredModel ?? null,
    threadStrategy: input.threadStrategy ?? "new_thread",
    linkedRunIds: input.linkedRunIds ?? [],
    linkedSessionIds: input.linkedSessionIds ?? [],
    parentTaskId: input.parentTaskId ?? null,
    reviewState: input.reviewState ?? "not_started",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}

export function upsertOrchestrationTask(
  store: OrchestrationTaskStoreData,
  task: OrchestrationTask,
): OrchestrationTaskStoreData {
  return normalizeOrchestrationTaskStore({
    version: STORE_VERSION,
    tasks: [task, ...store.tasks.filter((entry) => entry.taskId !== task.taskId)],
  });
}

export function patchOrchestrationTask(
  store: OrchestrationTaskStoreData,
  taskId: string,
  patch: OrchestrationTaskPatch,
): OrchestrationTaskStoreData {
  const task = store.tasks.find((entry) => entry.taskId === taskId);
  if (!task) {
    return store;
  }
  const now = patch.now ?? new Date().toISOString();
  return upsertOrchestrationTask(store, {
    ...task,
    ...patch,
    taskId: task.taskId,
    workspaceId: task.workspaceId,
    createdAt: task.createdAt,
    updatedAt: now,
  });
}

export function archiveOrchestrationTask(
  store: OrchestrationTaskStoreData,
  taskId: string,
  now = new Date().toISOString(),
): OrchestrationTaskStoreData {
  return patchOrchestrationTask(store, taskId, {
    status: "archived",
    archivedAt: now,
    now,
  });
}
