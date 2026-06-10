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
      projectMapRelationshipContextPack: {
        schemaVersion: 1,
        generatedAt: "2026-06-05T00:00:00.000Z",
        mustReadFiles: ["src/main.ts"],
        relatedFiles: [],
        testTargets: [],
        contracts: [],
        riskFlags: [],
        provenance: {
          scanRunId: "relationship-scan-test",
          relationIds: [],
          fileIds: ["file-main"],
        },
      },
      taskRuns: [],
    });

    expect(snapshots.map((snapshot) => snapshot.providerId)).toEqual([
      "core:manual",
      "project-map",
      "core:task-run",
    ]);
    expect(flattenAvailableOrchestrationCandidates(snapshots).map((task) => task.taskId)).toContain(
      "project-map-relationship-context-relationship-scan-test",
    );
    expect(flattenAvailableOrchestrationCandidates(snapshots).length).toBeGreaterThan(1);
  });
});
