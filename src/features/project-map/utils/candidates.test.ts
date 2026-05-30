import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapCandidate } from "../types";
import {
  confirmProjectMapCandidate,
  confirmProjectMapNodeCandidate,
  rejectProjectMapCandidate,
  rejectProjectMapNodeCandidate,
} from "./candidates";
import { PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID } from "./incrementalGeneration";

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

  it("confirms standalone node candidates when no review candidate record exists", () => {
    const result = confirmProjectMapNodeCandidate({
      dataset: mockProjectMapData,
      nodeId: "risk-taxonomy-drift",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const confirmedNode = result.dataset.nodes.find((node) => node.id === "risk-taxonomy-drift");
      expect(confirmedNode?.candidate).toBe(false);
      expect(result.dataset.manifest.updatedAt).toBe("2026-05-26T01:00:00Z");
      expect(
        result.dataset.manifest.lensStats.find((stats) => stats.lensId === "risk")?.candidateCount,
      ).toBe(0);
    }
  });

  it("rejects standalone node candidates without deleting the node", () => {
    const result = rejectProjectMapNodeCandidate({
      dataset: mockProjectMapData,
      nodeId: "risk-taxonomy-drift",
      rejectedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const rejectedNode = result.dataset.nodes.find((node) => node.id === "risk-taxonomy-drift");
      expect(rejectedNode).toBeTruthy();
      expect(rejectedNode?.candidate).toBe(false);
      expect(rejectedNode?.stale).toBe(true);
    }
  });

  it("confirms parent-move candidates without changing node content", () => {
    const unassignedParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: ["risk-taxonomy-drift"],
    };
    const dataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes
        .map((node) =>
          node.id === "risk-taxonomy-drift"
            ? { ...node, parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID }
            : node,
        )
        .concat(unassignedParent),
      candidates: [
        candidate({
          id: "move-1",
          source: "organizer",
          kind: "parentMove",
          targetNodeId: "risk-taxonomy-drift",
          patch: { nodeId: "risk-taxonomy-drift" },
          move: {
            nodeId: "risk-taxonomy-drift",
            fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
            suggestedParentId: "hub-risk",
            confidence: "medium",
            reason: "风险节点应归入 Risk hub。",
          },
        }),
      ],
    };

    const beforeSummary = dataset.nodes.find((node) => node.id === "risk-taxonomy-drift")?.summary;
    const result = confirmProjectMapCandidate({
      dataset,
      candidateId: "move-1",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const movedNode = result.dataset.nodes.find((node) => node.id === "risk-taxonomy-drift");
      expect(movedNode).toMatchObject({
        parentId: "hub-risk",
        summary: beforeSummary,
      });
      expect(result.dataset.nodes.find((node) => node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID)?.children).not.toContain(
        "risk-taxonomy-drift",
      );
      expect(result.dataset.nodes.find((node) => node.id === "hub-risk")?.children).toContain(
        "risk-taxonomy-drift",
      );
      expect(result.dataset.candidates?.[0].status).toBe("confirmed");
    }
  });

  it("confirms parent-move candidates to safe deep existing parents", () => {
    const unassignedParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: ["risk-taxonomy-drift"],
    };
    const deepParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: "existing-deep-parent",
      title: "Existing Deep Parent",
      nodeKind: "record",
      parentId: "hub-risk",
      children: [],
      candidate: false,
    };
    const dataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes
        .map((node) => {
          if (node.id === "risk-taxonomy-drift") {
            return { ...node, parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID };
          }
          if (node.id === "hub-risk") {
            return { ...node, children: [...node.children, deepParent.id] };
          }
          return node;
        })
        .concat(unassignedParent, deepParent),
      candidates: [
        candidate({
          id: "move-deep",
          source: "organizer",
          kind: "parentMove",
          targetNodeId: "risk-taxonomy-drift",
          patch: { nodeId: "risk-taxonomy-drift" },
          move: {
            nodeId: "risk-taxonomy-drift",
            fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
            suggestedParentId: "existing-deep-parent",
            confidence: "medium",
            reason: "Move to the most specific existing parent.",
          },
        }),
      ],
    };

    const result = confirmProjectMapCandidate({
      dataset,
      candidateId: "move-deep",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataset.nodes.find((node) => node.id === "risk-taxonomy-drift")?.parentId).toBe(
        "existing-deep-parent",
      );
      expect(result.dataset.nodes.find((node) => node.id === "existing-deep-parent")?.children).toContain(
        "risk-taxonomy-drift",
      );
    }
  });

  it("confirms broad parent-move candidates back to the root layer", () => {
    const unassignedParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: ["unassigned-broad-overview"],
    };
    const broadNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-api")!,
      id: "unassigned-broad-overview",
      title: "Unassigned Broad Overview",
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      children: ["broad-child"],
    };
    const broadChild = {
      ...mockProjectMapData.nodes.find((node) => node.id === "api-http")!,
      id: "broad-child",
      title: "Broad Child",
      parentId: "unassigned-broad-overview",
      children: [],
    };
    const dataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes
        .filter((node) => node.id !== "hub-api" && node.id !== "api-http")
        .concat(unassignedParent, broadNode, broadChild),
      candidates: [
        candidate({
          id: "move-broad-root",
          source: "organizer",
          kind: "parentMove",
          targetNodeId: "unassigned-broad-overview",
          patch: { nodeId: "unassigned-broad-overview" },
          move: {
            nodeId: "unassigned-broad-overview",
            fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
            suggestedParentId: "project-core",
            confidence: "medium",
            reason: "Broad overview belongs near the root.",
          },
        }),
      ],
    };

    const result = confirmProjectMapCandidate({
      dataset,
      candidateId: "move-broad-root",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataset.nodes.find((node) => node.id === "unassigned-broad-overview")?.parentId).toBe(
        "project-core",
      );
    }
  });

  it("rejects broad parent-move candidates under narrower cross-lens parents", () => {
    const unassignedParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: ["unassigned-broad-overview"],
    };
    const broadNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-api")!,
      id: "unassigned-broad-overview",
      title: "Unassigned Broad Overview",
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      children: ["broad-child"],
    };
    const broadChild = {
      ...mockProjectMapData.nodes.find((node) => node.id === "api-http")!,
      id: "broad-child",
      title: "Broad Child",
      parentId: "unassigned-broad-overview",
      children: [],
    };
    const deepParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "runtime-package-scripts")!,
      id: "runtime-deep-parent",
      parentId: "hub-runtime",
      children: [],
    };
    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        nodes: mockProjectMapData.nodes
          .filter((node) => node.id !== "hub-api" && node.id !== "api-http")
          .concat(unassignedParent, broadNode, broadChild, deepParent),
        candidates: [
          candidate({
            id: "move-broad-deep",
            source: "organizer",
            kind: "parentMove",
            targetNodeId: "unassigned-broad-overview",
            patch: { nodeId: "unassigned-broad-overview" },
            move: {
              nodeId: "unassigned-broad-overview",
              fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
              suggestedParentId: "runtime-deep-parent",
              confidence: "medium",
              reason: "Incorrect deep parent.",
            },
          }),
        ],
      },
      candidateId: "move-broad-deep",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(false);
  });

  it("confirms specific parent-move candidates with children under narrower cross-lens parents", () => {
    const unassignedParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: ["unassigned-workflow-with-child"],
    };
    const workflowNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "runtime-package-scripts")!,
      id: "unassigned-workflow-with-child",
      title: "Workspace File Tree Auto Repair Workflow",
      nodeKind: "workflow",
      lensId: "runtime",
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      children: ["workflow-child-evidence"],
    };
    const workflowChild = {
      ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
      id: "workflow-child-evidence",
      title: "Workflow Child Evidence",
      nodeKind: "diagnostic",
      lensId: "runtime",
      parentId: "unassigned-workflow-with-child",
      children: [],
    };
    const deepParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
      id: "risk-deep-parent",
      nodeKind: "record",
      parentId: "hub-risk",
      children: [],
      candidate: false,
    };
    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        nodes: mockProjectMapData.nodes
          .filter((node) => node.id !== "runtime-package-scripts" && node.id !== "risk-taxonomy-drift")
          .map((node) =>
            node.id === "hub-risk"
              ? { ...node, children: [...node.children.filter((childId) => childId !== "risk-taxonomy-drift"), deepParent.id] }
              : node,
          )
          .concat(unassignedParent, workflowNode, workflowChild, deepParent),
        candidates: [
          candidate({
            id: "move-specific-with-child",
            source: "organizer",
            kind: "parentMove",
            targetNodeId: "unassigned-workflow-with-child",
            patch: { nodeId: "unassigned-workflow-with-child" },
            move: {
              nodeId: "unassigned-workflow-with-child",
              fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
              suggestedParentId: "risk-deep-parent",
              confidence: "medium",
              reason: "Specific workflow evidence can attach to the narrow parent.",
            },
          }),
        ],
      },
      candidateId: "move-specific-with-child",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataset.nodes.find((node) => node.id === "unassigned-workflow-with-child")?.parentId).toBe(
        "risk-deep-parent",
      );
      expect(result.dataset.nodes.find((node) => node.id === "risk-deep-parent")?.children).toContain(
        "unassigned-workflow-with-child",
      );
    }
  });

  it("rejects parent-move candidates targeting parents that remain under unassigned discoveries", () => {
    const unassignedParent = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: ["frontend-application-layer", "messages-module"],
    };
    const appNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-api")!,
      id: "frontend-application-layer",
      title: "Frontend Application Layer",
      nodeKind: "module",
      summary: "React frontend app module that owns user-facing features.",
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      children: ["messages-module"],
    };
    const featureNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "api-http")!,
      id: "messages-module",
      title: "Messages Rendering Module",
      nodeKind: "module",
      summary: "Concrete feature module for message rendering.",
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      children: [],
    };

    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        nodes: mockProjectMapData.nodes.concat(unassignedParent, appNode, featureNode),
        candidates: [
          candidate({
            id: "move-child-only",
            source: "organizer",
            kind: "parentMove",
            targetNodeId: "messages-module",
            patch: { nodeId: "messages-module" },
            move: {
              nodeId: "messages-module",
              fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
              suggestedParentId: "frontend-application-layer",
              confidence: "medium",
              reason: "Bad child-only staged move.",
            },
          }),
        ],
      },
      candidateId: "move-child-only",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("Unassigned Discoveries")],
    });
  });

  it("rejects unsafe parent-move candidates that point back to root", () => {
    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        candidates: [
          candidate({
            id: "move-root",
            source: "organizer",
            kind: "parentMove",
            targetNodeId: "risk-taxonomy-drift",
            patch: { nodeId: "risk-taxonomy-drift" },
            move: {
              nodeId: "risk-taxonomy-drift",
              fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
              suggestedParentId: "project-core",
              confidence: "medium",
              reason: "Bad root move.",
            },
          }),
        ],
      },
      candidateId: "move-root",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects parent-move candidates that keep the current parent", () => {
    const result = confirmProjectMapCandidate({
      dataset: {
        ...mockProjectMapData,
        candidates: [
          candidate({
            id: "move-same-parent",
            source: "organizer",
            kind: "parentMove",
            targetNodeId: "risk-taxonomy-drift",
            patch: { nodeId: "risk-taxonomy-drift" },
            move: {
              nodeId: "risk-taxonomy-drift",
              fromParentId: "hub-risk",
              suggestedParentId: "hub-risk",
              confidence: "medium",
              reason: "No-op move.",
            },
          }),
        ],
      },
      candidateId: "move-same-parent",
      confirmedAt: "2026-05-26T01:00:00Z",
    });

    expect(result.ok).toBe(false);
  });
});
