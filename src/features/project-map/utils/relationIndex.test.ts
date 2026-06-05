import { describe, expect, it } from "vitest";

import type { ProjectMapDataset, ProjectMapNode, ProjectMapRelation } from "../types";
import { buildProjectMapRelationIndex, filterProjectMapRelations } from "./relationIndex";

function createNode(id: string, title = id): ProjectMapNode {
  return {
    id,
    lensId: "lens-main",
    nodeKind: "module",
    title,
    summary: title,
    detail: {
      coreDescription: title,
      keyFacts: [],
      keyLogic: [],
      riskSignals: [],
      relatedArtifacts: [],
    },
    children: [],
    sources: [],
    confidence: "high",
    stale: false,
    candidate: false,
    lastGeneratedAt: "2026-06-03T00:00:00.000Z",
    generatedBy: { engine: "codex", model: "gpt", runId: "run-1" },
  };
}

function createRelation(overrides: Partial<ProjectMapRelation>): ProjectMapRelation {
  return {
    id: "relation-a-b",
    sourceNodeId: "node-a",
    targetNodeId: "node-b",
    type: "depends_on",
    direction: "forward",
    confidence: "high",
    sourceKind: "deterministic",
    evidence: [],
    ...overrides,
  };
}

function createDataset(relations: ProjectMapRelation[]): ProjectMapDataset {
  return {
    manifest: {
      schemaVersion: 1,
      projectName: "Fixture",
      workspacePath: "/workspace/fixture",
      storageKey: "fixture",
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      lastRunId: null,
      sourceRootHash: null,
      lensStats: [],
    },
    profile: {
      primaryLanguage: "typescript",
      languages: ["typescript"],
      shapes: ["frontend-app"],
      frameworks: [],
      interfaceKinds: [],
      buildSystems: [],
    },
    lenses: [],
    nodes: [createNode("node-a", "Node A"), createNode("node-b", "Node B")],
    relations,
    runs: [],
    candidates: [],
    autoIngestionSettings: {
      enabled: false,
      engine: "codex",
      model: "gpt",
      newSessionThreshold: 5,
      checkIntervalMinutes: 30,
      applyMode: "createCandidate",
    },
    memoryCursor: {
      lastCheckedAt: "2026-06-03T00:00:00.000Z",
      processedMessages: [],
      pendingMessages: [],
    },
  };
}

describe("buildProjectMapRelationIndex", () => {
  it("groups incoming and outgoing relations by node", () => {
    const relationIndex = buildProjectMapRelationIndex(createDataset([
      createRelation({ id: "relation-a-b", sourceNodeId: "node-a", targetNodeId: "node-b" }),
    ]));

    expect(relationIndex.byNodeId.get("node-a")?.outgoing.map((item) => item.relation.id)).toEqual(["relation-a-b"]);
    expect(relationIndex.byNodeId.get("node-b")?.incoming.map((item) => item.relation.id)).toEqual(["relation-a-b"]);
    expect(relationIndex.typeCounts).toEqual([{ key: "depends_on", count: 1 }]);
  });

  it("marks missing endpoints and duplicate relation ids as degraded", () => {
    const relationIndex = buildProjectMapRelationIndex(createDataset([
      createRelation({ id: "duplicate", targetNodeId: "missing-node" }),
      createRelation({ id: "duplicate", sourceNodeId: "missing-source" }),
    ]));

    expect(relationIndex.duplicateRelationIds).toEqual(["duplicate"]);
    expect(relationIndex.degradedIssues.map((issue) => issue.kind)).toEqual([
      "missing-relation-target",
      "stale-relation",
      "missing-relation-source",
    ]);
  });
});

describe("filterProjectMapRelations", () => {
  it("filters by type, source kind, and selected-node direction", () => {
    const relationIndex = buildProjectMapRelationIndex(createDataset([
      createRelation({ id: "incoming", sourceNodeId: "node-b", targetNodeId: "node-a", type: "specified_by", sourceKind: "spec-link" }),
      createRelation({ id: "outgoing", sourceNodeId: "node-a", targetNodeId: "node-b", type: "depends_on", sourceKind: "deterministic" }),
    ]));

    expect(filterProjectMapRelations({ relationIndex, selectedNodeId: "node-a", directionFilter: "incoming" }).map((item) => item.relation.id)).toEqual(["incoming"]);
    expect(filterProjectMapRelations({ relationIndex, typeFilter: "depends_on", sourceKindFilter: "deterministic" }).map((item) => item.relation.id)).toEqual(["outgoing"]);
  });
});
