import type { TaskRunRecord, TaskRunStoreData } from "../../tasks/types";
import {
  beginTaskRunFromDefinition,
  type BeginTaskRunResult,
} from "../../tasks/utils/taskRunCoordinator";
import {
  loadTaskRunStore,
  saveTaskRunStore,
} from "../../tasks/utils/taskRunStorage";
import type {
  OrchestrationSourceRef,
  OrchestrationTask,
  OrchestrationTaskStoreData,
} from "../types";
import { mapTaskRunStatusToOrchestrationStatus } from "../types";
import {
  loadOrchestrationTaskStore,
  patchOrchestrationTask,
  saveOrchestrationTaskStore,
  upsertOrchestrationTask,
} from "./taskStore";

export type OrchestrationTaskDispatchInput = {
  task: OrchestrationTask;
  engine: TaskRunRecord["engine"];
  model?: string | null;
  threadStrategy: OrchestrationTask["threadStrategy"];
  promptSummary: string;
  acceptanceSummary: string;
  sourceRefs: OrchestrationSourceRef[];
  taskRunStore?: TaskRunStoreData;
  orchestrationTaskStore?: OrchestrationTaskStoreData;
  now?: number;
  persist?: boolean;
};

export type OrchestrationTaskDispatchResult =
  | {
      ok: true;
      run: TaskRunRecord;
      taskRunStore: TaskRunStoreData;
      orchestrationTaskStore: OrchestrationTaskStoreData;
      orchestrationTask: OrchestrationTask;
    }
  | {
      ok: false;
      reason: Extract<BeginTaskRunResult, { ok: false }>["reason"];
      activeRun?: TaskRunRecord;
      taskRunStore: TaskRunStoreData;
      orchestrationTaskStore: OrchestrationTaskStoreData;
    };

function findOrchestrationTask(
  store: OrchestrationTaskStoreData,
  taskId: string,
  fallbackTask: OrchestrationTask,
): OrchestrationTask {
  return store.tasks.find((task) => task.taskId === taskId) ?? fallbackTask;
}

function dispatchThreadId(input: OrchestrationTaskDispatchInput): string | null {
  if (input.threadStrategy !== "reuse_active_thread") {
    return null;
  }
  return input.task.linkedSessionIds[0] ?? null;
}

export function beginOrchestrationTaskDispatch(
  input: OrchestrationTaskDispatchInput,
): OrchestrationTaskDispatchResult {
  const taskRunStore = input.taskRunStore ?? loadTaskRunStore();
  const orchestrationTaskStore = upsertOrchestrationTask(
    input.orchestrationTaskStore ?? loadOrchestrationTaskStore(),
    input.task,
  );
  const result = beginTaskRunFromDefinition({
    store: taskRunStore,
    task: {
      taskId: input.task.taskId,
      workspaceId: input.task.workspaceId,
      title: input.task.title,
      source: "orchestration",
      orchestrationTaskId: input.task.taskId,
      engine: input.engine,
      model: input.model ?? null,
      linkedThreadId: dispatchThreadId(input),
    },
    trigger: "manual",
    now: input.now,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      activeRun: result.activeRun,
      taskRunStore,
      orchestrationTaskStore,
    };
  }

  const nextLinkedRunIds = [...new Set([...input.task.linkedRunIds, result.run.runId])];
  const nextOrchestrationTaskStore = patchOrchestrationTask(
    orchestrationTaskStore,
    input.task.taskId,
    {
      linkedRunIds: nextLinkedRunIds,
      status: mapTaskRunStatusToOrchestrationStatus(result.run.status),
      preferredEngine: input.engine,
      preferredModel: input.model ?? null,
      threadStrategy: input.threadStrategy,
      promptSummary: input.promptSummary,
      acceptanceSummary: input.acceptanceSummary,
      sourceRefs: input.sourceRefs,
      now: new Date(input.now ?? Date.now()).toISOString(),
    },
  );
  const nextOrchestrationTask = findOrchestrationTask(
    nextOrchestrationTaskStore,
    input.task.taskId,
    input.task,
  );

  if (input.persist !== false) {
    saveTaskRunStore(result.store);
    saveOrchestrationTaskStore(nextOrchestrationTaskStore);
  }

  return {
    ok: true,
    run: result.run,
    taskRunStore: result.store,
    orchestrationTaskStore: nextOrchestrationTaskStore,
    orchestrationTask: nextOrchestrationTask,
  };
}

export function buildOrchestrationDispatchPrompt(input: OrchestrationTaskDispatchInput): string {
  const taskTitle = input.task.title?.trim() || "Untitled orchestration task";
  const scopeSummary = input.task.scopeSummary?.trim() || "No scope summary provided.";
  const promptSummary =
    typeof input.promptSummary === "string" ? input.promptSummary.trim() : "";
  const acceptanceSummary =
    (typeof input.acceptanceSummary === "string" ? input.acceptanceSummary.trim() : "") ||
    input.task.acceptanceSummary?.trim() ||
    "No acceptance criteria provided.";
  const sourceRefs = Array.isArray(input.sourceRefs) ? input.sourceRefs : [];
  const evidenceRefs = Array.isArray(input.task.evidenceRefs) ? input.task.evidenceRefs : [];
  const sourceLines = sourceRefs.map((sourceRef) => {
    const location = sourceRef.workspaceRelativePath ?? sourceRef.path ?? sourceRef.id;
    return `- ${sourceRef.label} (${sourceRef.providerId}/${sourceRef.kind}): ${location}`;
  });
  const evidenceLines = evidenceRefs.map((evidenceRef) => {
    const location = evidenceRef.workspaceRelativePath ?? evidenceRef.path ?? evidenceRef.id;
    return `- ${evidenceRef.label} (${evidenceRef.providerId}/${evidenceRef.kind}): ${location}`;
  });
  return [
    `Task: ${taskTitle}`,
    "",
    promptSummary || scopeSummary,
    "",
    "Scope:",
    scopeSummary,
    "",
    "Acceptance:",
    acceptanceSummary,
    sourceLines.length > 0 ? "\nSources:" : "",
    ...sourceLines,
    evidenceLines.length > 0 ? "\nEvidence:" : "",
    ...evidenceLines,
  ].filter((line) => line !== "").join("\n");
}
