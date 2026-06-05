import { describe, expect, it } from "vitest";

import {
  PROJECT_MAP_FIXTURE_NOW,
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
} from "../testUtils/fixtures";
import { buildProjectMapActivityProjection } from "./activityProjection";
import { buildProjectMapEvidenceFileIndex } from "./evidenceFileIndex";
import {
  buildProjectMapShortestPath,
  explainProjectMapAssociationPath,
  searchProjectMapGrouped,
  searchProjectMapNodes,
} from "./navigation";

describe("project map navigation utilities", () => {
  it("searches title, summary, kind, lens, and source fields with stable ranking", () => {
    const dataset = createProjectMapDatasetFixture();

    const results = searchProjectMapNodes({
      dataset,
      query: "controller",
    });

    expect(results[0]?.node.id).toBe("api-controller");
    expect(results[0]?.matchedFields).toEqual(expect.arrayContaining(["title", "summary", "source"]));
  });

  it("finds relation-backed shortest paths and exposes edge keys", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    const result = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });

    expect(result.status).toBe("found");
    expect(result.steps.map((step) => step.via)).toEqual(["self", "relation"]);
    expect(result.edgeKeys.has("api-controller::data-store")).toBe(true);
  });

  it("explains relation-backed shortest paths with confidence and evidence metadata", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture({ confidence: "low", sourceKind: "llm-inferred", stale: true })],
    });
    const path = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });

    const explanation = explainProjectMapAssociationPath({
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      pathResult: path,
    });

    expect(explanation).toMatchObject({ status: "found" });
    expect(explanation.reasons[0]).toMatchObject({
      relationId: "relation-api-data",
      sourceKind: "llm-inferred",
      confidence: "low",
      stale: true,
      deterministic: false,
    });
  });

  it("falls back to hierarchy paths and returns not-found for unreachable endpoints", () => {
    const dataset = createProjectMapDatasetFixture();

    const hierarchyPath = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "project-core",
      targetNodeId: "api-controller",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });
    const missingPath = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "project-core",
      targetNodeId: "missing-node",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });

    expect(hierarchyPath.status).toBe("found");
    expect(hierarchyPath.steps[0]?.via).toBe("self");
    expect(hierarchyPath.steps.slice(1).every((step) => step.via === "hierarchy")).toBe(true);
    expect(hierarchyPath.steps.at(-1)?.node.id).toBe("api-controller");
    expect(missingPath).toMatchObject({ status: "not-found", message: "not-found" });
  });

  it("returns grouped query results for nodes, evidence files, relations, artifacts, stale reasons, and activity", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        ...createProjectMapDatasetFixture().nodes,
        createProjectMapNodeFixture({
          id: "governance-node",
          title: "Governance Node",
          stale: true,
          staleReasons: [{
            id: "stale-spec",
            kind: "spec-changed",
            label: "Spec requires review",
            path: "openspec/specs/project-xray-panel/spec.md",
            recommendation: "partial-refresh",
          }],
          detail: {
            coreDescription: "Governance detail",
            keyFacts: [],
            keyLogic: [],
            riskSignals: [],
            relatedArtifacts: [{
              type: "spec",
              label: "Project X-Ray spec",
              path: "openspec/specs/project-xray-panel/spec.md",
              line: 12,
            }],
          },
        }),
      ],
      relations: [createProjectMapRelationFixture({
        label: "Controller depends on store",
      })],
      runs: [{
        id: "run-1",
        kind: "global",
        status: "completed",
        engine: "codex",
        model: "gpt-test",
        startedAt: PROJECT_MAP_FIXTURE_NOW,
        completedAt: PROJECT_MAP_FIXTURE_NOW,
        scope: "spec review",
      }],
    });
    const evidenceFileIndex = buildProjectMapEvidenceFileIndex({ dataset });
    const activityProjection = buildProjectMapActivityProjection({
      dataset,
      changedFilePaths: ["src/api/controller.ts"],
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    const grouped = searchProjectMapGrouped({
      dataset,
      evidenceFileIndex,
      activityProjection,
      query: "spec",
      groupLimit: 3,
    });

    expect(grouped.groups.map((group) => group.group)).toEqual(expect.arrayContaining([
      "nodes",
      "artifact-references",
      "stale-reasons",
      "activity",
    ]));
    expect(grouped.nodeIds.has("governance-node")).toBe(true);
    expect([...grouped.filePaths]).toContain("openspec/specs/project-xray-panel/spec.md");
  });
});
