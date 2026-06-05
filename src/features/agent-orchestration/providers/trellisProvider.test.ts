import { describe, expect, it } from "vitest";
import { readTrellisOrchestrationCandidates } from "./trellisProvider";

describe("readTrellisOrchestrationCandidates", () => {
  it("treats absent Trellis tasks as optional rather than degraded", () => {
    const snapshot = readTrellisOrchestrationCandidates({
      workspaceId: "workspace-1",
      entries: [],
    });

    expect(snapshot).toEqual({
      providerId: "workflow:trellis",
      available: false,
      candidates: [],
      degraded: [],
    });
  });

  it("reads linked Trellis metadata with PRD evidence", () => {
    const snapshot = readTrellisOrchestrationCandidates({
      workspaceId: "workspace-1",
      entries: [
        {
          taskJsonPath: ".trellis/tasks/task-1/task.json",
          taskJson: {
            id: "task-1",
            title: "Implement orchestration",
            status: "in_progress",
            scope: "Wire orchestration center.",
            acceptance: "The center opens from linked run.",
            openSpecChangeId: "add-agent-task-orchestration-center",
          },
          prdPath: ".trellis/tasks/task-1/prd.md",
          prdContent: "# PRD\n\nBuild the orchestration center.",
        },
      ],
      now: "2026-06-03T00:00:00.000Z",
    });

    expect(snapshot.available).toBe(true);
    expect(snapshot.candidates[0]).toMatchObject({
      taskId: "trellis-task-1",
      status: "running",
      title: "Implement orchestration",
      evidenceRefs: [
        expect.objectContaining({
          label: ".trellis/tasks/task-1/prd.md",
        }),
      ],
      sourceRefs: [
        expect.objectContaining({
          metadata: {
            openSpecChangeId: "add-agent-task-orchestration-center",
          },
        }),
      ],
    });
  });

  it("marks missing PRD as a local risk without hiding the task", () => {
    const snapshot = readTrellisOrchestrationCandidates({
      workspaceId: "workspace-1",
      entries: [
        {
          taskJsonPath: ".trellis/tasks/task-2/task.json",
          taskJson: {
            id: "task-2",
            title: "Task without PRD",
            status: "todo",
          },
        },
      ],
    });

    expect(snapshot.candidates[0]).toMatchObject({
      status: "planned",
      riskMarkers: [
        expect.objectContaining({
          kind: "missing_evidence",
        }),
      ],
    });
  });

  it("degrades malformed Trellis task JSON without crashing healthy entries", () => {
    const snapshot = readTrellisOrchestrationCandidates({
      workspaceId: "workspace-1",
      entries: [
        {
          taskJsonPath: ".trellis/tasks/bad/task.json",
          taskJson: "not-json-object",
        },
        {
          taskJsonPath: ".trellis/tasks/good/task.json",
          taskJson: { id: "good", title: "Good task" },
        },
      ],
    });

    expect(snapshot.degraded).toHaveLength(1);
    expect(snapshot.candidates).toHaveLength(1);
    expect(snapshot.candidates[0]?.taskId).toBe("trellis-good");
  });
});
