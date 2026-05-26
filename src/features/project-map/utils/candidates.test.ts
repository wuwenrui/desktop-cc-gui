import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapCandidate } from "../types";
import { confirmProjectMapCandidate, rejectProjectMapCandidate } from "./candidates";

function candidate(overrides: Partial<ProjectMapCandidate> = {}): ProjectMapCandidate {
  return {
    id: "candidate-1",
    status: "pending",
    createdAt: "2026-05-26T00:00:00Z",
    updatedAt: "2026-05-26T00:00:00Z",
    source: "conversation",
    targetLensId: "overview",
    targetNodeId: "project-core",
    patch: {
      nodeId: "project-core",
      summary: "ProjectMap types",
      sources: [
        {
          type: "file",
          label: "ProjectMap types",
          path: "src/features/project-map/types.ts",
          excerpt: "ProjectMap types",
        },
      ],
      confidence: "high",
    },
    evidence: [
      {
        id: "evidence-1",
        priority: "code",
        observedAt: "2026-05-26T00:00:00Z",
        observedHash: "hash-1",
        source: {
          type: "file",
          label: "ProjectMap types",
          path: "src/features/project-map/types.ts",
          excerpt: "ProjectMap types",
        },
      },
    ],
    ...overrides,
  };
}

describe("project map candidates", () => {
  it("confirms candidates through evidence gate before mutating the target node", () => {
    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        candidates: [candidate()],
        evidenceRecords: [],
      },
      candidateId: "candidate-1",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataset.nodes.find((node) => node.id === "project-core")?.summary).toBe(
        "ProjectMap types",
      );
      expect(result.dataset.candidates?.[0].status).toBe("confirmed");
      expect(result.dataset.evidenceRecords).toHaveLength(1);
    }
  });

  it("rejects unsupported candidate patches without mutating active nodes", () => {
    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        candidates: [
          candidate({
            patch: {
              nodeId: "project-core",
              confidence: "high",
              sources: [],
            },
          }),
        ],
      },
      candidateId: "candidate-1",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(false);
  });

  it("allows explicit candidate rejection without changing active nodes", () => {
    const dataset = rejectProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        candidates: [candidate()],
      },
      candidateId: "candidate-1",
      rejectedAt: "2026-05-26T01:00:00Z",
    });

    expect(dataset.candidates?.[0].status).toBe("rejected");
    expect(dataset.nodes.find((node) => node.id === "project-core")?.summary).toBe(
      mockProjectMapData.nodes.find((node) => node.id === "project-core")?.summary,
    );
  });
});
