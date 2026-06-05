import { describe, expect, it } from "vitest";

import type { TaskRunRecord } from "../../tasks/types";
import { buildTaskRunOrchestrationCandidate, readTaskRunOrchestrationCandidates } from "./taskRunProvider";

function makeRun(overrides: Partial<TaskRunRecord> = {}): TaskRunRecord {
  return {
    runId: "run-1",
    task: {
      taskId: "task-1",
      source: "kanban",
      workspaceId: "workspace-a",
      title: "Build",
      orchestrationTaskId: null,
    },
    engine: "codex",
    status: "completed",
    trigger: "manual",
    linkedThreadId: "thread-1",
    latestOutputSummary: "Implemented feature.",
    blockedReason: null,
    failureReason: null,
    artifacts: [{ kind: "file", label: "src/app.ts", ref: "src/app.ts" }],
    availableRecoveryActions: ["open_conversation"],
    updatedAt: 100,
    ...overrides,
  };
}

describe("task run orchestration provider", () => {
  it("maps completed TaskRuns to review-needed orchestration candidates", () => {
    const task = buildTaskRunOrchestrationCandidate({ run: makeRun() });

    expect(task).toMatchObject({
      taskId: "task-run-run-1",
      status: "review_needed",
      reviewState: "needs_review",
      linkedRunIds: ["run-1"],
      linkedSessionIds: ["thread-1"],
      evidenceRefs: [expect.objectContaining({ path: "src/app.ts" })],
    });
  });

  it("marks failed runs and missing linked sessions as degraded context", () => {
    const task = buildTaskRunOrchestrationCandidate({
      run: makeRun({
        runId: "failed",
        status: "failed",
        linkedThreadId: null,
        failureReason: "boom",
      }),
    });

    expect(task.status).toBe("blocked");
    expect(task.riskMarkers.map((marker) => marker.kind)).toEqual([
      "missing_linked_session",
      "provider_degraded",
    ]);
  });

  it("filters TaskRun candidates by workspace", () => {
    const candidates = readTaskRunOrchestrationCandidates({
      workspaceId: "workspace-a",
      runs: [
        makeRun({ runId: "run-a", task: { ...makeRun().task, workspaceId: "workspace-a" } }),
        makeRun({ runId: "run-b", task: { ...makeRun().task, workspaceId: "workspace-b" } }),
      ],
    });

    expect(candidates.map((candidate) => candidate.linkedRunIds[0])).toEqual(["run-a"]);
  });

  it("skips TaskRuns already owned by orchestration tasks to avoid duplicate shadow tasks", () => {
    const candidates = readTaskRunOrchestrationCandidates({
      workspaceId: "workspace-a",
      runs: [
        makeRun({ runId: "external-kanban-run" }),
        makeRun({
          runId: "orchestration-run",
          task: {
            ...makeRun().task,
            taskId: "orchestration-task-1",
            source: "orchestration",
            orchestrationTaskId: "orchestration-task-1",
          },
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.linkedRunIds[0])).toEqual([
      "external-kanban-run",
    ]);
  });
});
