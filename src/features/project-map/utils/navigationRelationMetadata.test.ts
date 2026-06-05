import { describe, expect, it } from "vitest";

import type { ProjectMapDataset, ProjectMapNode, ProjectMapRelation } from "../types";
import { buildProjectMapShortestPath } from "./navigation";

function createNode(id: string): ProjectMapNode {
  return {
    id,
    lensId: "lens-main",
    nodeKind: "module",
    title: id,
    summary: id,
    detail: {
      coreDescription: id,
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

function createDataset(relation: ProjectMapRelation): ProjectMapDataset {
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
    nodes: [createNode("node-a"), createNode("node-b")],
    relations: [relation],
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

describe("buildProjectMapShortestPath relation metadata", () => {
  it("keeps relation type and source kind on relation-backed path segments", () => {
    const relation: ProjectMapRelation = {
      id: "relation-a-b",
      sourceNodeId: "node-a",
      targetNodeId: "node-b",
      type: "specified_by",
      direction: "forward",
      confidence: "high",
      sourceKind: "spec-link",
      evidence: [],
    };

    const result = buildProjectMapShortestPath({
      dataset: createDataset(relation),
      sourceNodeId: "node-a",
      targetNodeId: "node-b",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });

    expect(result.status).toBe("found");
    expect(result.steps[1]).toMatchObject({
      via: "relation",
      relation: {
        type: "specified_by",
        sourceKind: "spec-link",
      },
    });
  });
});
