import type { TaskRunRecord } from "../../tasks/types";
import type {
  OrchestrationReviewState,
  OrchestrationTask,
  OrchestrationTaskStoreData,
} from "../types";
import { mapTaskRunStatusToOrchestrationStatus } from "../types";
import { patchOrchestrationTask } from "./taskStore";

function isTaskRunLinkedToOrchestrationTask(
  task: OrchestrationTask,
  run: TaskRunRecord,
): boolean {
  return (
    task.linkedRunIds.includes(run.runId) ||
    run.task.orchestrationTaskId === task.taskId
  );
}

function findLatestLinkedRun(
  task: OrchestrationTask,
  taskRuns: TaskRunRecord[],
): TaskRunRecord | null {
  return taskRuns
    .filter((run) => isTaskRunLinkedToOrchestrationTask(task, run))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

function deriveReviewStateFromRun(run: TaskRunRecord): OrchestrationReviewState | undefined {
  return run.status === "completed" ? "needs_review" : undefined;
}

function hasOrphanReviewIntent(task: OrchestrationTask): boolean {
  return task.status === "review_needed" || task.reviewState === "needs_review";
}

export function projectLinkedTaskRunsToOrchestrationStore(input: {
  orchestrationStore: OrchestrationTaskStoreData;
  taskRuns: TaskRunRecord[];
  now?: string;
}): OrchestrationTaskStoreData {
  let nextStore = input.orchestrationStore;

  for (const task of input.orchestrationStore.tasks) {
    if (task.status === "archived") {
      continue;
    }
    const latestRun = findLatestLinkedRun(task, input.taskRuns);
    if (!latestRun) {
      if (!hasOrphanReviewIntent(task)) {
        continue;
      }
      nextStore = patchOrchestrationTask(nextStore, task.taskId, {
        status: "planned",
        reviewState: "not_started",
        now: input.now ?? new Date().toISOString(),
      });
      continue;
    }

    const nextStatus = mapTaskRunStatusToOrchestrationStatus(latestRun.status);
    const nextReviewState = deriveReviewStateFromRun(latestRun);
    const statusChanged = task.status !== nextStatus;
    const reviewStateChanged = Boolean(
      nextReviewState && task.reviewState !== nextReviewState,
    );

    if (!statusChanged && !reviewStateChanged) {
      continue;
    }

    nextStore = patchOrchestrationTask(nextStore, task.taskId, {
      status: nextStatus,
      reviewState: nextReviewState ?? task.reviewState,
      now: input.now ?? new Date().toISOString(),
    });
  }

  return nextStore;
}
