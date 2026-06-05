import { describe, expect, it } from "vitest";
import { createTaskRunRecord } from "../../tasks/utils/taskRunStorage";
import type { TaskRunRecord } from "../../tasks/types";
import { createOrchestrationTask } from "./taskStore";
import { projectLinkedTaskRunsToOrchestrationStore } from "./taskRunLifecycleProjection";

function makeTask() {
  return createOrchestrationTask({
    taskId: "orchestration-task-1",
    workspaceId: "workspace-1",
    title: "Review linked run",
    scopeSummary: "Review the linked TaskRun lifecycle.",
    acceptanceSummary: "Lifecycle projection is visible.",
    now: "2026-06-03T00:00:00.000Z",
  });
}

function makeRun(
  taskId: string,
  status: TaskRunRecord["status"],
  updatedAt: number,
): TaskRunRecord {
  return {
    ...createTaskRunRecord({
      taskId,
      taskSource: "orchestration",
      orchestrationTaskId: taskId,
      workspaceId: "workspace-1",
      taskTitle: "Review linked run",
      engine: "codex",
      trigger: "manual",
      now: updatedAt,
    }),
    status,
    updatedAt,
    finishedAt:
      status === "completed" || status === "failed" || status === "blocked"
        ? updatedAt
        : null,
  };
}

describe("projectLinkedTaskRunsToOrchestrationStore", () => {
  it("projects completed linked runs to review_needed", () => {
    const task = makeTask();
    const run = makeRun(task.taskId, "completed", 200);
    const projected = projectLinkedTaskRunsToOrchestrationStore({
      orchestrationStore: {
        version: 1,
        tasks: [{ ...task, linkedRunIds: [run.runId], status: "running" }],
      },
      taskRuns: [run],
      now: "2026-06-03T00:01:00.000Z",
    });

    expect(projected.tasks[0]).toMatchObject({
      status: "review_needed",
      reviewState: "needs_review",
      updatedAt: "2026-06-03T00:01:00.000Z",
    });
  });

  it("projects failed linked runs to blocked using orchestrationTaskId linkage", () => {
    const task = makeTask();
    const run = makeRun(task.taskId, "failed", 200);
    const projected = projectLinkedTaskRunsToOrchestrationStore({
      orchestrationStore: {
        version: 1,
        tasks: [{ ...task, status: "running" }],
      },
      taskRuns: [run],
      now: "2026-06-03T00:02:00.000Z",
    });

    expect(projected.tasks[0]).toMatchObject({
      status: "blocked",
      updatedAt: "2026-06-03T00:02:00.000Z",
    });
  });

  it("projects waiting_input and prefers the latest linked run", () => {
    const task = makeTask();
    const olderRun = makeRun(task.taskId, "failed", 100);
    const newerRun = makeRun(task.taskId, "waiting_input", 300);
    const projected = projectLinkedTaskRunsToOrchestrationStore({
      orchestrationStore: {
        version: 1,
        tasks: [
          {
            ...task,
            linkedRunIds: [olderRun.runId, newerRun.runId],
            status: "running",
          },
        ],
      },
      taskRuns: [olderRun, newerRun],
      now: "2026-06-03T00:03:00.000Z",
    });

    expect(projected.tasks[0]).toMatchObject({
      status: "waiting_input",
      updatedAt: "2026-06-03T00:03:00.000Z",
    });
  });
});
