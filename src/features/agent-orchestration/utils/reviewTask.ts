import type {
  OrchestrationRiskMarker,
  OrchestrationTask,
  OrchestrationTaskStoreData,
} from "../types";
import {
  createOrchestrationTask,
  loadOrchestrationTaskStore,
  patchOrchestrationTask,
  saveOrchestrationTaskStore,
  upsertOrchestrationTask,
} from "./taskStore";

export type OrchestrationReviewAction =
  | "accept_result"
  | "request_changes"
  | "create_follow_up";

export type OrchestrationReviewActionInput = {
  task: OrchestrationTask;
  action: OrchestrationReviewAction;
  store?: OrchestrationTaskStoreData;
  now?: string;
  persist?: boolean;
};

export type OrchestrationReviewActionResult = {
  store: OrchestrationTaskStoreData;
  task: OrchestrationTask;
  followUpTask?: OrchestrationTask;
};

function findTaskOrFallback(
  store: OrchestrationTaskStoreData,
  taskId: string,
  fallbackTask: OrchestrationTask,
): OrchestrationTask {
  return store.tasks.find((task) => task.taskId === taskId) ?? fallbackTask;
}

function followUpRiskMarker(task: OrchestrationTask): OrchestrationRiskMarker {
  return {
    kind: "candidate_source",
    label: `Follow-up requested from ${task.title}`,
  };
}

function createReviewFollowUpTask(input: {
  task: OrchestrationTask;
  now: string;
}): OrchestrationTask {
  const { task, now } = input;
  return createOrchestrationTask({
    taskId: `${task.taskId}-follow-up-${Date.parse(now) || Date.now()}`,
    workspaceId: task.workspaceId,
    title: `Follow-up: ${task.title}`,
    status: "planned",
    sourceRefs: task.sourceRefs,
    evidenceRefs: task.evidenceRefs,
    riskMarkers: [...task.riskMarkers, followUpRiskMarker(task)],
    scopeSummary: `Address requested changes for: ${task.scopeSummary}`,
    acceptanceSummary: `Requested changes are resolved for: ${task.acceptanceSummary}`,
    promptSummary: task.promptSummary,
    preferredEngine: task.preferredEngine,
    threadStrategy: task.threadStrategy,
    linkedSessionIds: task.linkedSessionIds,
    parentTaskId: task.taskId,
    now,
  });
}

export function applyOrchestrationReviewAction(
  input: OrchestrationReviewActionInput,
): OrchestrationReviewActionResult {
  const now = input.now ?? new Date().toISOString();
  const initialStore = input.store ?? loadOrchestrationTaskStore();

  if (input.action === "accept_result") {
    const store = patchOrchestrationTask(initialStore, input.task.taskId, {
      status: "completed",
      reviewState: "accepted",
      now,
    });
    const task = findTaskOrFallback(store, input.task.taskId, input.task);
    if (input.persist !== false) {
      saveOrchestrationTaskStore(store);
    }
    return { store, task };
  }

  if (input.action === "request_changes") {
    const store = patchOrchestrationTask(initialStore, input.task.taskId, {
      status: "planned",
      reviewState: "changes_requested",
      now,
    });
    const task = findTaskOrFallback(store, input.task.taskId, input.task);
    if (input.persist !== false) {
      saveOrchestrationTaskStore(store);
    }
    return { store, task };
  }

  const followUpTask = createReviewFollowUpTask({ task: input.task, now });
  const patchedStore = patchOrchestrationTask(initialStore, input.task.taskId, {
    reviewState: "changes_requested",
    now,
  });
  const store = upsertOrchestrationTask(patchedStore, followUpTask);
  const task = findTaskOrFallback(store, input.task.taskId, input.task);
  if (input.persist !== false) {
    saveOrchestrationTaskStore(store);
  }
  return { store, task, followUpTask };
}
