import { describe, expect, it } from "vitest";

import {
  PROJECT_MAP_FIXTURE_NOW,
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
} from "../testUtils/fixtures";
import { buildProjectMapActivityProjection } from "./activityProjection";

describe("project map activity projection", () => {
  it("projects changed-file impact into changed and affected activity", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    const activity = buildProjectMapActivityProjection({
      dataset,
      changedFilePaths: ["src/api/controller.ts"],
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    expect(activity.changedNodeIds.has("api-controller")).toBe(true);
    expect(activity.affectedNodeIds.has("data-store")).toBe(true);
    expect(activity.groups.find((group) => group.id === "changed-files")?.items[0]).toMatchObject({
      kind: "git-change",
      sourceCategory: "changed-files",
      deterministic: true,
    });
  });

  it("shows degraded changed-file state when no changed input is available", () => {
    const activity = buildProjectMapActivityProjection({
      dataset: createProjectMapDatasetFixture(),
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    expect(activity.degraded).toBe(true);
    expect(activity.items[0]).toMatchObject({
      id: "activity:changed-files:unavailable",
      degraded: true,
    });
  });

  it("includes stale, candidate, run, and evidence map-derived activity", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "stale-node",
          stale: true,
          staleReasons: [{
            id: "stale-reason",
            kind: "source-changed",
            label: "Source changed",
            path: "src/stale.ts",
            recommendation: "partial-refresh",
          }],
        }),
      ],
      runs: [{
        id: "run-1",
        kind: "global",
        status: "completed",
        engine: "codex",
        model: "gpt-test",
        startedAt: PROJECT_MAP_FIXTURE_NOW,
        completedAt: PROJECT_MAP_FIXTURE_NOW,
        scope: "global",
      }],
      candidates: [{
        id: "candidate-1",
        status: "pending",
        createdAt: PROJECT_MAP_FIXTURE_NOW,
        updatedAt: PROJECT_MAP_FIXTURE_NOW,
        source: "global",
        targetLensId: "overview",
        targetNodeId: "stale-node",
        patch: { nodeId: "stale-node" },
        evidence: [],
      }],
      evidenceRecords: [{
        id: "evidence-1",
        source: { type: "file", label: "Evidence", path: "src/stale.ts" },
        priority: "code",
        observedHash: null,
        observedAt: PROJECT_MAP_FIXTURE_NOW,
      }],
    });

    const activity = buildProjectMapActivityProjection({ dataset, now: PROJECT_MAP_FIXTURE_NOW });
    const groupIds = activity.groups.map((group) => group.id);

    expect(groupIds).toEqual(expect.arrayContaining([
      "degraded",
      "map-runs",
      "stale-state",
      "candidate-state",
      "evidence-state",
    ]));
  });
});
