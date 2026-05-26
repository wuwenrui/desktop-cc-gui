import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapNode } from "../types";
import {
  markStaleNodesBySourceHash,
  sortSourcesByEvidencePriority,
  validateProjectMapNodePatch,
} from "./evidenceGate";

const baseNode = mockProjectMapData.nodes[0] as ProjectMapNode;

describe("project map evidence gate", () => {
  it("rejects confirmed deterministic claims without sources", () => {
    const result = validateProjectMapNodePatch(
      { ...baseNode, sources: [] },
      { nodeId: baseNode.id, confidence: "high" },
    );

    expect(result.ok).toBe(false);
    expect(result.confidence).toBe("unknown");
    expect(result.issues.some((issue) => issue.code === "missing_source")).toBe(true);
  });

  it("blocks memory-only evidence from producing high-confidence code facts", () => {
    const result = validateProjectMapNodePatch(
      {
        ...baseNode,
        sources: [
          {
            type: "conversation",
            label: "Q&A",
            excerpt: "ProjectMap types mention project profile",
          },
        ],
      },
      {
        nodeId: baseNode.id,
        confidence: "high",
        detail: {
          keyFacts: ["ProjectMap types"],
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "memory_only_high_confidence")).toBe(true);
  });

  it("orders sources by code, spec, tests, commit, then memory", () => {
    const sorted = sortSourcesByEvidencePriority([
      { type: "conversation", label: "Memory" },
      { type: "commit", label: "Commit" },
      { type: "test", label: "Test" },
      { type: "spec", label: "Spec" },
      { type: "file", label: "File" },
    ]);

    expect(sorted.map((source) => source.type)).toEqual([
      "file",
      "spec",
      "test",
      "commit",
      "conversation",
    ]);
  });

  it("marks nodes stale when current source hashes drift", () => {
    const source = { type: "file" as const, label: "types", path: "src/types.ts", hash: "old" };
    const [staleNode] = markStaleNodesBySourceHash(
      [{ ...baseNode, sources: [source], confidence: "high", stale: false }],
      new Map([["src/types.ts", "new"]]),
    );

    expect(staleNode.stale).toBe(true);
    expect(staleNode.confidence).toBe("medium");
  });
});
