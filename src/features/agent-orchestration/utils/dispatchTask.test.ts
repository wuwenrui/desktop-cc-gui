import { describe, expect, it } from "vitest";
import { createOrchestrationSourceRef } from "./sourceRefs";
import { createOrchestrationTask } from "./taskStore";
import { beginOrchestrationTaskDispatch } from "./dispatchTask";

function makeDispatchTask() {
  return createOrchestrationTask({
    taskId: "orchestration-task-1",
    workspaceId: "workspace-1",
    title: "Review Project Map node",
    scopeSummary: "Review node and evidence.",
    acceptanceSummary: "Node review is complete.",
    sourceRefs: [
      createOrchestrationSourceRef({
        providerId: "project-map",
        kind: "project_map_node",
        id: "node-1",
        label: "Project Map node",
        capabilities: ["open_source", "dispatch"],
      }),
    ],
    now: "2026-06-03T00:00:00.000Z",
  });
}

describe("beginOrchestrationTaskDispatch", () => {
  it("creates a linked non-Kanban TaskRun and projects queued run status to orchestration running", () => {
    const task = makeDispatchTask();
    const result = beginOrchestrationTaskDispatch({
      task,
      engine: "codex",
      model: "gpt-5-codex",
      threadStrategy: "new_thread",
      promptSummary: "Dispatch prompt summary.",
      acceptanceSummary: task.acceptanceSummary,
      sourceRefs: task.sourceRefs,
      taskRunStore: { version: 1, runs: [] },
      orchestrationTaskStore: { version: 1, tasks: [task] },
      now: 300,
      persist: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.task).toMatchObject({
        taskId: "orchestration-task-1",
        source: "orchestration",
        orchestrationTaskId: "orchestration-task-1",
      });
      expect(result.run.status).toBe("queued");
      expect(result.orchestrationTask).toMatchObject({
        status: "running",
        linkedRunIds: [result.run.runId],
        preferredEngine: "codex",
        preferredModel: "gpt-5-codex",
        threadStrategy: "new_thread",
        promptSummary: "Dispatch prompt summary.",
      });
      expect(result.taskRunStore.runs).toHaveLength(1);
    }
  });

  it("does not create a duplicate orchestration run while an active run exists", () => {
    const task = makeDispatchTask();
    const first = beginOrchestrationTaskDispatch({
      task,
      engine: "codex",
      threadStrategy: "new_thread",
      promptSummary: "Dispatch prompt summary.",
      acceptanceSummary: task.acceptanceSummary,
      sourceRefs: task.sourceRefs,
      taskRunStore: { version: 1, runs: [] },
      orchestrationTaskStore: { version: 1, tasks: [task] },
      now: 300,
      persist: false,
    });
    if (!first.ok) {
      throw new Error("expected first orchestration dispatch");
    }

    const second = beginOrchestrationTaskDispatch({
      task,
      engine: "codex",
      threadStrategy: "new_thread",
      promptSummary: "Dispatch prompt summary.",
      acceptanceSummary: task.acceptanceSummary,
      sourceRefs: task.sourceRefs,
      taskRunStore: first.taskRunStore,
      orchestrationTaskStore: first.orchestrationTaskStore,
      now: 400,
      persist: false,
    });

    expect(second).toMatchObject({
      ok: false,
      reason: "active_run_exists",
      activeRun: first.run,
    });
  });
});
