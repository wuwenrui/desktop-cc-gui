import { describe, expect, it } from "vitest";

import {
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
} from "../testUtils/fixtures";
import { buildProjectMapActivityProjection } from "./activityProjection";
import {
  buildProjectMapAdvisorHints,
  buildProjectMapDiffImpactAdvisor,
  buildProjectMapGraphHealthAdvisor,
  buildProjectMapGuideTopologyAdvisor,
  buildProjectMapNodeExplainAdvisor,
  buildProjectMapQueryNeighborhoodAdvisor,
} from "./advisorProjections";
import { searchProjectMapGrouped } from "./navigation";

describe("project map advisor projections", () => {
  it("builds diff-impact hints from Project Map impact data", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    const hints = buildProjectMapDiffImpactAdvisor({
      dataset,
      changedFilePaths: ["src/api/controller.ts"],
    });

    expect(hints[0]).toMatchObject({
      kind: "diff-impact",
      deterministic: true,
    });
    expect(hints[0]?.nodeIds).toEqual(expect.arrayContaining(["api-controller", "data-store"]));
  });

  it("builds query-neighborhood and node-explain hints without UA runtime dependency", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });
    const queryResults = searchProjectMapGrouped({ dataset, query: "controller" });

    const queryHints = buildProjectMapQueryNeighborhoodAdvisor({ dataset, queryResults });
    const explainHints = buildProjectMapNodeExplainAdvisor({ dataset, nodeId: "api-controller" });

    expect(queryHints[0]?.kind).toBe("query-neighborhood");
    expect(queryHints[0]?.nodeIds).toContain("api-controller");
    expect(explainHints[0]).toMatchObject({
      kind: "node-explain",
      deterministic: true,
    });
  });

  it("suggests guide topology nodes from graph structure", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    const hints = buildProjectMapGuideTopologyAdvisor({ dataset, limit: 2 });

    expect(hints[0]).toMatchObject({
      kind: "guide-topology",
      deterministic: true,
    });
    expect(hints[0]?.nodeIds.length).toBeLessThanOrEqual(2);
  });

  it("surfaces graph health warnings without mutating semantic data", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "project-core",
          children: ["missing-child"],
        }),
      ],
      relations: [
        createProjectMapRelationFixture({
          id: "inferred-relation",
          sourceNodeId: "project-core",
          targetNodeId: "missing-node",
          sourceKind: "llm-inferred",
          confidence: "low",
        }),
      ],
    });

    const hints = buildProjectMapGraphHealthAdvisor({ dataset });

    expect(hints[0]).toMatchObject({
      kind: "graph-health",
      severity: "warning",
      deterministic: true,
    });
    expect(dataset.relations?.[0]?.targetNodeId).toBe("missing-node");
  });

  it("combines advisor hints from local Project Map utilities only", () => {
    const dataset = createProjectMapDatasetFixture();
    const activityProjection = buildProjectMapActivityProjection({ dataset });

    const hints = buildProjectMapAdvisorHints({
      dataset,
      activityProjection,
      selectedNodeId: "project-core",
    });

    expect(hints.map((hint) => hint.kind)).toEqual(expect.arrayContaining([
      "diff-impact",
      "node-explain",
      "guide-topology",
    ]));
    expect(hints.every((hint) => hint.deterministic)).toBe(true);
  });
});
