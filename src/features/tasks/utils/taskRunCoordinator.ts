import type { KanbanTask, KanbanTaskExecutionSource } from "../../kanban/types";
import type {
  TaskRunDefinitionRef,
  TaskRunRecord,
  TaskRunStoreData,
  TaskRunTrigger,
} from "../types";
import {
  createTaskRunRecord,
  findActiveRunForTask,
  isTaskRunSettled,
  upsertTaskRun,
} from "./taskRunStorage";
import { mapExecutionSourceToRunTrigger } from "./taskRunProjection";

export type BeginTaskRunResult =
  | {
      ok: true;
      run: TaskRunRecord;
      store: TaskRunStoreData;
    }
  | {
      ok: false;
      reason: "active_run_exists" | "unsupported_engine" | "parent_not_settled";
      activeRun?: TaskRunRecord;
      store: TaskRunStoreData;
    };

export type BeginTaskRunDefinition = {
  taskId: string;
  workspaceId: string;
  title?: string | null;
  source?: TaskRunDefinitionRef["source"];
  orchestrationTaskId?: string | null;
  engine: TaskRunRecord["engine"];
  model?: string | null;
  linkedThreadId?: string | null;
};

export function beginTaskRun(params: {
  store: TaskRunStoreData;
  task: KanbanTask;
  source: KanbanTaskExecutionSource;
  now?: number;
  parentRun?: TaskRunRecord | null;
  upstreamRun?: TaskRunRecord | null;
}): BeginTaskRunResult {
  const trigger = mapExecutionSourceToRunTrigger(params.source);
  return beginTaskRunWithTrigger({
    store: params.store,
    task: params.task,
    trigger,
    now: params.now,
    parentRun: params.parentRun,
    upstreamRun: params.upstreamRun,
  });
}

export function beginTaskRunWithTrigger(params: {
  store: TaskRunStoreData;
  task: KanbanTask;
  trigger: TaskRunTrigger;
  now?: number;
  parentRun?: TaskRunRecord | null;
  upstreamRun?: TaskRunRecord | null;
}): BeginTaskRunResult {
  return beginTaskRunFromDefinition({
    store: params.store,
    task: {
      taskId: params.task.id,
      workspaceId: params.task.workspaceId,
      title: params.task.title,
      source: "kanban",
      engine: params.task.engineType as TaskRunRecord["engine"],
      model: params.task.modelId,
      linkedThreadId: params.task.threadId,
    },
    trigger: params.trigger,
    now: params.now,
    parentRun: params.parentRun,
    upstreamRun: params.upstreamRun,
  });
}

export function beginTaskRunFromDefinition(params: {
  store: TaskRunStoreData;
  task: BeginTaskRunDefinition;
  trigger: TaskRunTrigger;
  now?: number;
  parentRun?: TaskRunRecord | null;
  upstreamRun?: TaskRunRecord | null;
}): BeginTaskRunResult {
  const activeRun = findActiveRunForTask(params.store.runs, params.task.taskId);
  if (activeRun) {
    return {
      ok: false,
      reason: "active_run_exists",
      activeRun,
      store: params.store,
    };
  }
  if (
    (params.trigger === "retry" || params.trigger === "resume") &&
    params.parentRun &&
    !isTaskRunSettled(params.parentRun.status)
  ) {
    return {
      ok: false,
      reason: "parent_not_settled",
      store: params.store,
    };
  }
  try {
    const run = createTaskRunRecord({
      taskId: params.task.taskId,
      workspaceId: params.task.workspaceId,
      taskTitle: params.task.title,
      taskSource: params.task.source,
      orchestrationTaskId: params.task.orchestrationTaskId,
      engine: params.task.engine,
      model: params.task.model,
      trigger: params.trigger,
      linkedThreadId: params.task.linkedThreadId,
      parentRunId: params.parentRun?.runId ?? null,
      upstreamRunId: params.upstreamRun?.runId ?? null,
      now: params.now,
    });
    return {
      ok: true,
      run,
      store: upsertTaskRun(params.store, run),
    };
  } catch {
    return {
      ok: false,
      reason: "unsupported_engine",
      store: params.store,
    };
  }
}
