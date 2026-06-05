import { describe, expect, it } from "vitest";

import type { ProjectMapDataset, ProjectMapNode } from "../types";
import { buildProjectMapEvidenceFileIndex } from "./evidenceFileIndex";

function createNode(overrides: Partial<ProjectMapNode>): ProjectMapNode {
  return {
    id: "node-a",
    lensId: "lens-main",
    nodeKind: "module",
    title: "Module A",
    summary: "Module summary",
    detail: {
      coreDescription: "Core description",
      keyFacts: [],
      keyLogic: [],
      riskSignals: [],
      relatedArtifacts: [],
    },
    parentId: "root",
    children: [],
    sources: [],
    confidence: "high",
    stale: false,
    candidate: false,
    lastGeneratedAt: "2026-06-03T00:00:00.000Z",
    generatedBy: { engine: "codex", model: "gpt", runId: "run-1" },
    ...overrides,
  };
}

function createDataset(overrides: Partial<ProjectMapDataset>): ProjectMapDataset {
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
    nodes: [],
    relations: [],
    runs: [],
    candidates: [],
    evidenceRecords: [],
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
    ...overrides,
  };
}

describe("buildProjectMapEvidenceFileIndex", () => {
  it("groups file-backed node and relation evidence by workspace-relative path", () => {
    const dataset = createDataset({
      nodes: [
        createNode({
          id: "node-a",
          title: "Module A",
          stale: true,
          confidence: "low",
          sources: [
            { type: "file", label: "App source", path: "src/app.ts", line: 10 },
            { type: "commit", label: "Initial commit", hash: "abc123" },
          ],
          detail: {
            coreDescription: "Core description",
            keyFacts: [],
            keyLogic: [],
            riskSignals: [],
            relatedArtifacts: [
              { type: "spec", label: "Spec", path: "openspec/specs/project-xray-panel/spec.md", line: 42 },
            ],
          },
        }),
        createNode({
          id: "node-b",
          title: "Module B",
          sources: [{ type: "document", label: "README.md" }],
        }),
      ],
      relations: [
        {
          id: "relation-a-b",
          sourceNodeId: "node-a",
          targetNodeId: "node-b",
          type: "depends_on",
          direction: "forward",
          confidence: "medium",
          stale: false,
          sourceKind: "deterministic",
          evidence: [
            {
              id: "evidence-relation-app",
              source: { type: "file", label: "Callsite", path: "src/app.ts", line: 14 },
              priority: "code",
              observedHash: null,
              observedAt: "2026-06-03T00:00:00.000Z",
            },
            {
              id: "evidence-relation-hash",
              source: { type: "commit", label: "Diff hash", hash: "def456" },
              priority: "commit",
              observedHash: null,
              observedAt: "2026-06-03T00:00:00.000Z",
            },
          ],
        },
      ],
    });

    const index = buildProjectMapEvidenceFileIndex({ dataset });
    const appEntry = index.files.find((entry) => entry.path === "src/app.ts");

    expect(appEntry).toMatchObject({
      path: "src/app.ts",
      evidenceCount: 2,
      nodeCount: 1,
      relationCount: 1,
      staleCount: 1,
      lowConfidenceCount: 1,
    });
    expect(appEntry?.nodeLinks[0]?.nodeId).toBe("node-a");
    expect(appEntry?.relationLinks[0]?.relationId).toBe("relation-a-b");
    expect(appEntry?.lineRefs.map((lineRef) => lineRef.line)).toEqual([10, 14]);
  });

  it("keeps non-file evidence separate and promotes strongly path-like labels", () => {
    const dataset = createDataset({
      nodes: [
        createNode({
          id: "node-a",
          sources: [
            { type: "document", label: "README.md" },
            { type: "conversation", label: "Session note" },
          ],
        }),
      ],
    });

    const index = buildProjectMapEvidenceFileIndex({ dataset });

    expect(index.files.some((entry) => entry.path === "README.md")).toBe(true);
    expect(index.nonFileEvidence).toEqual([
      expect.objectContaining({ label: "Session note", reason: "missing-path", nodeId: "node-a" }),
    ]);
  });
});
