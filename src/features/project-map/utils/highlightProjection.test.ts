import { describe, expect, it } from "vitest";

import {
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
  PROJECT_MAP_FIXTURE_NOW,
} from "../testUtils/fixtures";
import type { ProjectMapAdvisorHint } from "../types";
import { buildProjectMapActivityProjection } from "./activityProjection";
import {
  buildProjectMapHighlightProjection,
  getProjectMapHighlightPriority,
} from "./highlightProjection";
import { searchProjectMapGrouped, buildProjectMapShortestPath } from "./navigation";

describe("buildProjectMapHighlightProjection", () => {
  it("keeps deterministic priority when selected, path, search, activity, advisor, filter, and base overlap", () => {
    const relation = createProjectMapRelationFixture({
      id: "relation-api-data",
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
    });
    const dataset = createProjectMapDatasetFixture({ relations: [relation] });
    const activityProjection = buildProjectMapActivityProjection({
      dataset,
      changedFilePaths: ["src/api/controller.ts"],
      now: PROJECT_MAP_FIXTURE_NOW,
    });
    const queryResults = searchProjectMapGrouped({ dataset, query: "controller" });
    const pathResult = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not found",
    });
    const advisorHints: ProjectMapAdvisorHint[] = [
      {
        id: "advisor:test",
        kind: "query-neighborhood",
        title: "advisor",
        summary: "advisor",
        nodeIds: ["api-controller"],
        relationIds: ["relation-api-data"],
        filePaths: [],
        severity: "info",
        deterministic: true,
      },
    ];

    const projection = buildProjectMapHighlightProjection({
      dataset,
      selectedNodeId: "api-controller",
      selectedRelationId: "relation-api-data",
      pathResult,
      queryResults,
      activityProjection,
      advisorHints,
      quickFilters: ["changed"],
    });

    expect(projection.nodeStates.get("api-controller")).toMatchObject({
      primary: "selected",
      priority: getProjectMapHighlightPriority("selected"),
    });
    expect(projection.nodeStates.get("api-controller")?.sources).toEqual([
      "selected",
      "path",
      "search",
      "activity-changed",
      "advisor",
      "filter",
      "base",
    ]);
    expect(projection.relationStates.get("relation-api-data")).toMatchObject({
      primary: "selected",
    });
    expect(projection.relationStates.get("relation-api-data")?.sources).toContain("path");
  });

  it("separates recent changed and affected graph highlights", () => {
    const relation = createProjectMapRelationFixture({
      id: "relation-api-data",
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
    });
    const dataset = createProjectMapDatasetFixture({ relations: [relation] });
    const activityProjection = buildProjectMapActivityProjection({
      dataset,
      changedFilePaths: ["src/api/controller.ts"],
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    const projection = buildProjectMapHighlightProjection({ dataset, activityProjection });

    expect([...projection.activityChangedNodeIds]).toEqual(["api-controller"]);
    expect([...projection.activityAffectedNodeIds].sort()).toEqual(["data-store", "project-core"]);
    expect(projection.nodeStates.get("api-controller")?.primary).toBe("activity-changed");
    expect(projection.nodeStates.get("data-store")?.primary).toBe("activity-affected");
  });

  it("adds advisor-driven node and relation highlights without requiring filters", () => {
    const relation = createProjectMapRelationFixture({
      id: "relation-health",
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      confidence: "low",
    });
    const dataset = createProjectMapDatasetFixture({ relations: [relation] });
    const advisorHints: ProjectMapAdvisorHint[] = [
      {
        id: "advisor:health",
        kind: "graph-health",
        title: "health",
        summary: "low confidence relation",
        nodeIds: ["data-store"],
        relationIds: ["relation-health"],
        filePaths: [],
        severity: "warning",
        deterministic: true,
      },
    ];

    const projection = buildProjectMapHighlightProjection({ dataset, advisorHints });

    expect([...projection.advisorNodeIds]).toEqual(["data-store"]);
    expect([...projection.advisorRelationIds]).toEqual(["relation-health"]);
    expect(projection.nodeStates.get("data-store")?.primary).toBe("advisor");
    expect(projection.relationStates.get("relation-health")?.primary).toBe("advisor");
    expect(projection.filterNodeIds.size).toBe(0);
    expect(projection.filterRelationIds.size).toBe(0);
  });

  it("projects quick filter chips for stale, candidate, low-confidence, and inferred relations", () => {
    const apiNode = createProjectMapNodeFixture({
      id: "api-controller",
      title: "API Controller",
      stale: true,
      confidence: "low",
      sources: [{ type: "file", label: "controller.ts", path: "src/api/controller.ts" }],
    });
    const dataNode = createProjectMapNodeFixture({
      id: "data-store",
      title: "Data Store",
      candidate: true,
      sources: [{ type: "file", label: "store.ts", path: "src/db/store.ts" }],
    });
    const relation = createProjectMapRelationFixture({
      id: "relation-inferred",
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      sourceKind: "llm-inferred",
      confidence: "unknown",
      stale: true,
    });
    const dataset = createProjectMapDatasetFixture({
      nodes: [apiNode, dataNode],
      relations: [relation],
      candidates: [
        {
          id: "candidate-data",
          status: "pending",
          createdAt: PROJECT_MAP_FIXTURE_NOW,
          updatedAt: PROJECT_MAP_FIXTURE_NOW,
          source: "organizer",
          targetLensId: "overview",
          targetNodeId: "data-store",
          patch: { nodeId: "data-store", candidate: true },
          evidence: [],
        },
      ],
    });

    const projection = buildProjectMapHighlightProjection({
      dataset,
      quickFilters: ["stale", "candidate", "low-confidence", "inferred-relations"],
    });

    expect([...projection.filterNodeIds].sort()).toEqual(["api-controller", "data-store"]);
    expect([...projection.filterRelationIds]).toEqual(["relation-inferred"]);
    expect(projection.nodeStates.get("api-controller")?.sources).toContain("filter");
    expect(projection.relationStates.get("relation-inferred")?.sources).toContain("filter");
  });
});
