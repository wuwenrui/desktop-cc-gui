import { describe, expect, it } from "vitest";
import { createOrchestrationTask } from "./taskStore";
import { applyOrchestrationReviewAction } from "./reviewTask";

function makeReviewTask() {
  return createOrchestrationTask({
    taskId: "review-task-1",
    workspaceId: "workspace-1",
    title: "Review completed run",
    status: "review_needed",
    reviewState: "needs_review",
    scopeSummary: "Review the completed run output.",
    acceptanceSummary: "Output is accepted or follow-up is created.",
    now: "2026-06-03T00:00:00.000Z",
  });
}

describe("applyOrchestrationReviewAction", () => {
  it("accepts a review result and completes the orchestration task", () => {
    const task = makeReviewTask();
    const result = applyOrchestrationReviewAction({
      task,
      action: "accept_result",
      store: { version: 1, tasks: [task] },
      now: "2026-06-03T00:01:00.000Z",
      persist: false,
    });

    expect(result.task).toMatchObject({
      status: "completed",
      reviewState: "accepted",
      updatedAt: "2026-06-03T00:01:00.000Z",
    });
  });

  it("requests changes without creating a follow-up task", () => {
    const task = makeReviewTask();
    const result = applyOrchestrationReviewAction({
      task,
      action: "request_changes",
      store: { version: 1, tasks: [task] },
      now: "2026-06-03T00:02:00.000Z",
      persist: false,
    });

    expect(result.task).toMatchObject({
      status: "planned",
      reviewState: "changes_requested",
    });
    expect(result.store.tasks).toHaveLength(1);
  });

  it("creates a follow-up task with parent lineage", () => {
    const task = makeReviewTask();
    const result = applyOrchestrationReviewAction({
      task,
      action: "create_follow_up",
      store: { version: 1, tasks: [task] },
      now: "2026-06-03T00:03:00.000Z",
      persist: false,
    });

    expect(result.task).toMatchObject({
      reviewState: "changes_requested",
    });
    expect(result.followUpTask).toMatchObject({
      parentTaskId: task.taskId,
      status: "planned",
      title: "Follow-up: Review completed run",
    });
    expect(result.store.tasks).toHaveLength(2);
  });
});
