import { describe, expect, it } from "vitest";

import { createManualOrchestrationTaskDraft } from "./manualProvider";

describe("manual orchestration provider", () => {
  it("creates a no-evidence manual draft with required scope and acceptance", () => {
    const task = createManualOrchestrationTaskDraft({
      workspaceId: "workspace-a",
      title: "Fix UI",
      scopeSummary: "Make the graph visible again.",
      acceptanceSummary: "User can see nodes.",
      now: "2026-06-03T00:00:00.000Z",
    });

    expect(task).toMatchObject({
      workspaceId: "workspace-a",
      title: "Fix UI",
      status: "planned",
      evidenceRefs: [],
      sourceRefs: [expect.objectContaining({ providerId: "core:manual", kind: "manual" })],
      scopeSummary: "Make the graph visible again.",
      acceptanceSummary: "User can see nodes.",
    });
  });

  it("rejects manual drafts without scope or acceptance", () => {
    expect(() =>
      createManualOrchestrationTaskDraft({
        workspaceId: "workspace-a",
        title: "Fix UI",
        scopeSummary: "",
        acceptanceSummary: "Done",
      }),
    ).toThrow("manual_orchestration_task_requires_title_scope_and_acceptance");
  });
});
