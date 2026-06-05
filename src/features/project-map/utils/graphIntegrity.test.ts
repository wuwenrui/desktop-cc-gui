import { describe, expect, it } from "vitest";

import {
  PROJECT_MAP_FIXTURE_NOW,
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
} from "../testUtils/fixtures";
import {
  repairProjectMapGraphIntegrity,
  validateProjectMapGraphIntegrity,
} from "./graphIntegrity";

describe("project map graph integrity", () => {
  it("detects missing endpoints, duplicate relation ids, stale relations, and evidence gaps", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "project-core",
          children: ["api-controller", "missing-child"],
        }),
        createProjectMapNodeFixture({
          id: "api-controller",
          parentId: "missing-parent",
          sources: [],
        }),
      ],
      relations: [
        createProjectMapRelationFixture({
          id: "duplicate-relation",
          sourceNodeId: "project-core",
          targetNodeId: "api-controller",
        }),
        createProjectMapRelationFixture({
          id: "duplicate-relation",
          sourceNodeId: "project-core",
          targetNodeId: "api-controller",
        }),
        createProjectMapRelationFixture({
          id: "missing-target",
          sourceNodeId: "project-core",
          targetNodeId: "ghost-node",
        }),
        createProjectMapRelationFixture({
          id: "stale-relation",
          sourceNodeId: "project-core",
          targetNodeId: "api-controller",
          stale: true,
        }),
      ],
    });

    const issues = validateProjectMapGraphIntegrity(dataset);

    expect(issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining([
      "missing-child",
      "missing-parent",
      "missing-node-evidence",
      "duplicate-relation-id",
      "missing-relation-target",
      "stale-relation",
    ]));
  });

  it("repairs missing references, removes invalid relations, and quarantines evidence gaps", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "project-core",
          children: ["api-controller", "missing-child"],
        }),
        createProjectMapNodeFixture({
          id: "api-controller",
          parentId: "missing-parent",
          sources: [],
        }),
      ],
      relations: [
        createProjectMapRelationFixture({
          id: "missing-target",
          sourceNodeId: "project-core",
          targetNodeId: "ghost-node",
        }),
      ],
    });

    const repaired = repairProjectMapGraphIntegrity({
      dataset,
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    expect(repaired.dataset.nodes.find((node) => node.id === "project-core")?.children).toEqual([
      "api-controller",
    ]);
    expect(repaired.dataset.nodes.find((node) => node.id === "api-controller")).toMatchObject({
      parentId: undefined,
      stale: true,
    });
    expect(repaired.dataset.relations).toEqual([]);
    expect(repaired.summary.actions.map((action) => action.kind)).toEqual(expect.arrayContaining([
      "remove-invalid-relation",
      "remove-missing-child-reference",
      "clear-missing-parent",
      "quarantine-evidence-gap",
    ]));
  });
});
