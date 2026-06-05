import { describe, expect, it } from "vitest";

import { createProjectMapDatasetFixture } from "../../project-map/testUtils/fixtures";
import { createManualOrchestrationTaskDraft } from "./manualProvider";
import {
  collectCoreOrchestrationProviderSnapshots,
  flattenAvailableOrchestrationCandidates,
} from "./coreProviders";

describe("core orchestration provider aggregation", () => {
  it("keeps healthy core providers visible when one provider degrades", () => {
    const manualTask = createManualOrchestrationTaskDraft({
      workspaceId: "workspace-a",
      title: "Manual",
      scopeSummary: "Scope",
      acceptanceSummary: "Acceptance",
    });
    const snapshots = collectCoreOrchestrationProviderSnapshots({
      workspaceId: "workspace-a",
      manualTasks: [manualTask],
      projectMapDataset: createProjectMapDatasetFixture(),
      readProjectMapCandidates: () => {
        throw new Error("project map unavailable");
      },
      readTaskRunCandidates: () => [],
    });

    expect(snapshots.find((snapshot) => snapshot.providerId === "project-map")).toMatchObject({
      available: false,
      degraded: [expect.objectContaining({ reason: "project map unavailable" })],
    });
    expect(flattenAvailableOrchestrationCandidates(snapshots).map((task) => task.title)).toEqual(["Manual"]);
  });

  it("aggregates manual, Project Map, and TaskRun candidate sources", () => {
    const snapshots = collectCoreOrchestrationProviderSnapshots({
      workspaceId: "workspace-a",
      manualTasks: [
        createManualOrchestrationTaskDraft({
          workspaceId: "workspace-a",
          title: "Manual",
          scopeSummary: "Scope",
          acceptanceSummary: "Acceptance",
        }),
      ],
      projectMapDataset: createProjectMapDatasetFixture(),
      taskRuns: [],
    });

    expect(snapshots.map((snapshot) => snapshot.providerId)).toEqual([
      "core:manual",
      "project-map",
      "core:task-run",
    ]);
    expect(flattenAvailableOrchestrationCandidates(snapshots).length).toBeGreaterThan(1);
  });
});
