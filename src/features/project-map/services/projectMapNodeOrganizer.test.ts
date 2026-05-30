import { beforeEach, describe, expect, it, vi } from "vitest";

import { engineSendMessageSync } from "../../../services/tauri";
import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapDataset, ProjectMapNode } from "../types";
import { PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID } from "../utils/incrementalGeneration";
import {
  buildProjectMapNodeOrganizerPrompt,
  getProjectMapUnassignedDiscoveryChildren,
  organizeProjectMapUnassignedDiscoveries,
} from "./projectMapNodeOrganizer";

vi.mock("../../../services/tauri", () => ({
  engineSendMessageSync: vi.fn(),
}));

function datasetWithUnassignedNode(): ProjectMapDataset {
  const movingNode: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
    parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
  };
  const unassignedParent: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
    id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    title: "待整理发现 Unassigned Discoveries",
    parentId: "project-core",
    children: [movingNode.id],
  };

  return {
    ...mockProjectMapData,
    nodes: [
      ...mockProjectMapData.nodes.filter((node) => node.id !== movingNode.id),
      movingNode,
      unassignedParent,
    ],
  };
}

function datasetWithDeepParentCandidate(): ProjectMapDataset {
  const dataset = datasetWithUnassignedNode();
  const deepParent: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
    id: "existing-deep-parent",
    title: "Existing Deep Parent",
    nodeKind: "record",
    parentId: "hub-risk",
    children: [],
    candidate: false,
  };
  return {
    ...dataset,
    nodes: dataset.nodes
      .map((node) =>
        node.id === "hub-risk"
          ? { ...node, children: [...node.children, deepParent.id] }
          : node,
      )
      .concat(deepParent),
  };
}

function datasetWithBroadUnassignedNode(): ProjectMapDataset {
  const dataset = datasetWithDeepParentCandidate();
  const broadNode: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "hub-api")!,
    id: "unassigned-broad-overview",
    title: "Unassigned Broad Overview",
    parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    children: ["broad-child"],
  };
  const broadChild: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "api-http")!,
    id: "broad-child",
    title: "Broad Child",
    parentId: "unassigned-broad-overview",
    children: [],
  };
  return {
    ...dataset,
    nodes: dataset.nodes
      .filter((node) => node.id !== "risk-taxonomy-drift")
      .map((node) =>
        node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID
          ? { ...node, children: [broadNode.id] }
          : node,
      )
      .concat(broadNode, broadChild),
  };
}

function datasetWithSpecificParentedUnassignedNode(): ProjectMapDataset {
  const dataset = datasetWithDeepParentCandidate();
  const workflowNode: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "runtime-package-scripts")!,
    id: "unassigned-workflow-with-child",
    title: "Workspace File Tree Auto Repair Workflow",
    nodeKind: "workflow",
    lensId: "runtime",
    parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    children: ["workflow-child-evidence"],
  };
  const workflowChild: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
    id: "workflow-child-evidence",
    title: "Workflow Child Evidence",
    nodeKind: "diagnostic",
    lensId: "runtime",
    parentId: workflowNode.id,
    children: [],
  };

  return {
    ...dataset,
    nodes: dataset.nodes
      .filter((node) => node.id !== "risk-taxonomy-drift")
      .map((node) =>
        node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID
          ? { ...node, children: [workflowNode.id] }
          : node,
      )
      .concat(workflowNode, workflowChild),
  };
}

function datasetWithStagedStructuralParent(): ProjectMapDataset {
  const dataset = datasetWithUnassignedNode();
  const appNode: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "hub-api")!,
    id: "frontend-application-layer",
    title: "Frontend Application Layer",
    nodeKind: "module",
    lensId: "frontend",
    summary: "React frontend app module that owns user-facing feature modules.",
    parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    children: ["messages-module"],
  };
  const featureNode: ProjectMapNode = {
    ...mockProjectMapData.nodes.find((node) => node.id === "api-http")!,
    id: "messages-module",
    title: "Messages Rendering Module",
    nodeKind: "module",
    lensId: "frontend",
    summary: "Feature module for chat message rendering.",
    parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    children: [],
  };

  return {
    ...dataset,
    nodes: dataset.nodes
      .filter((node) => node.id !== "risk-taxonomy-drift")
      .map((node) =>
        node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID
          ? { ...node, children: [appNode.id, featureNode.id] }
          : node,
      )
      .concat(appNode, featureNode),
  };
}

beforeEach(() => {
  vi.mocked(engineSendMessageSync).mockReset();
});

describe("project map node organizer", () => {
  it("builds a compact prompt with unassigned nodes and parent candidates", () => {
    const prompt = buildProjectMapNodeOrganizerPrompt({
      dataset: datasetWithUnassignedNode(),
      preferredLanguage: "zh",
    });

    expect(prompt).toContain("unassignedNodes");
    expect(prompt).toContain("parentCandidates");
    expect(prompt).toContain("risk-taxonomy-drift");
    expect(prompt).toContain("hub-risk");
    expect(prompt).toContain("Return pure JSON only");
    expect(prompt).toContain("Account for every unassigned node exactly once");
    expect(prompt).toContain("correct abstraction level");
    expect(prompt).toContain('"skips"');
  });

  it("includes the project root so broad discoveries can return to the root layer", () => {
    const prompt = buildProjectMapNodeOrganizerPrompt({
      dataset: datasetWithBroadUnassignedNode(),
      preferredLanguage: "zh",
    });

    expect(prompt).toContain("project-core");
  });

  it("offers graph-safe deep existing nodes as parent candidates without domain-specific allowlists", () => {
    const prompt = buildProjectMapNodeOrganizerPrompt({
      dataset: datasetWithDeepParentCandidate(),
      preferredLanguage: "zh",
    });

    expect(prompt).toContain("existing-deep-parent");
  });

  it("offers staged structural unassigned nodes as parent candidates", () => {
    const prompt = buildProjectMapNodeOrganizerPrompt({
      dataset: datasetWithStagedStructuralParent(),
      preferredLanguage: "en",
    });

    expect(prompt).toContain("frontend-application-layer");
    expect(prompt).toContain("messages-module");
  });

  it("detects direct children of unassigned discoveries", () => {
    expect(getProjectMapUnassignedDiscoveryChildren(datasetWithUnassignedNode()).map((node) => node.id)).toEqual([
      "risk-taxonomy-drift",
    ]);
  });

  it("detects unassigned direct children when persisted child ids are stale", () => {
    const dataset = datasetWithUnassignedNode();
    const staleChildrenDataset = {
      ...dataset,
      nodes: dataset.nodes.map((node) =>
        node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID
          ? { ...node, children: ["missing-child-id"] }
          : node,
      ),
    };

    expect(getProjectMapUnassignedDiscoveryChildren(staleChildrenDataset).map((node) => node.id)).toEqual([
      "risk-taxonomy-drift",
    ]);
  });

  it("creates parent-move candidates from safe AI suggestions", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "risk-taxonomy-drift",
            suggestedParentId: "hub-risk",
            confidence: "medium",
            reason: "风险节点应归入 Risk hub。",
          },
        ],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result).toMatchObject({
      unassignedCount: 1,
      skippedCount: 0,
      unsafeCount: 0,
    });
    const candidates = result.candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: "organizer",
      kind: "parentMove",
      targetNodeId: "risk-taxonomy-drift",
      move: {
        suggestedParentId: "hub-risk",
      },
    });
    expect(engineSendMessageSync).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        accessMode: "read-only",
        continueSession: false,
      }),
    );
  });

  it("creates parent-move candidates for safe deep parents", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "risk-taxonomy-drift",
            suggestedParentId: "existing-deep-parent",
            confidence: "medium",
            reason: "Move to the most specific existing parent.",
          },
        ],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithDeepParentCandidate(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result).toMatchObject({
      unassignedCount: 1,
      skippedCount: 0,
      unsafeCount: 0,
    });
    expect(result.candidates[0]).toMatchObject({
      kind: "parentMove",
      move: {
        suggestedParentId: "existing-deep-parent",
      },
    });
  });

  it("creates parent-move candidates that place broad discoveries back under root", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "unassigned-broad-overview",
            suggestedParentId: "project-core",
            confidence: "medium",
            reason: "Broad overview belongs at the root layer.",
          },
        ],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithBroadUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result).toMatchObject({
      unassignedCount: 1,
      skippedCount: 0,
      unsafeCount: 0,
    });
    expect(result.candidates[0]).toMatchObject({
      kind: "parentMove",
      move: {
        suggestedParentId: "project-core",
      },
    });
  });

  it("blocks broad discoveries from being placed under narrower cross-lens parents", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "unassigned-broad-overview",
            suggestedParentId: "existing-deep-parent",
            confidence: "medium",
            reason: "Incorrect deep parent.",
          },
        ],
        skips: [],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithBroadUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result.candidates).toEqual([]);
    expect(result).toMatchObject({
      unsafeCount: 1,
      unsafe: [
        expect.objectContaining({
          nodeId: "unassigned-broad-overview",
          reason: expect.stringContaining("Broad overview"),
        }),
      ],
    });
  });

  it("allows specific discoveries with children to move under narrower cross-lens parents", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "unassigned-workflow-with-child",
            suggestedParentId: "existing-deep-parent",
            confidence: "medium",
            reason: "A workflow detail with evidence should attach to the specific implementation parent.",
          },
        ],
        skips: [],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithSpecificParentedUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result).toMatchObject({
      unassignedCount: 1,
      skippedCount: 0,
      unsafeCount: 0,
    });
    expect(result.candidates[0]).toMatchObject({
      kind: "parentMove",
      targetNodeId: "unassigned-workflow-with-child",
      move: {
        suggestedParentId: "existing-deep-parent",
      },
    });
  });

  it("creates staged parent-move candidates for feature modules under same-batch structural parents", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "frontend-application-layer",
            suggestedParentId: "project-core",
            confidence: "high",
            reason: "Application layer is a structural top-level module.",
          },
          {
            nodeId: "messages-module",
            suggestedParentId: "frontend-application-layer",
            confidence: "medium",
            reason: "Feature module belongs under the frontend application layer.",
          },
        ],
        skips: [],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithStagedStructuralParent(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "en",
    });

    expect(result).toMatchObject({
      unassignedCount: 2,
      skippedCount: 0,
      unsafeCount: 0,
    });
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetNodeId: "frontend-application-layer",
          move: expect.objectContaining({ suggestedParentId: "project-core" }),
        }),
        expect.objectContaining({
          targetNodeId: "messages-module",
          move: expect.objectContaining({ suggestedParentId: "frontend-application-layer" }),
        }),
      ]),
    );
  });

  it("rejects child-only staged moves when the staged parent is not moved out too", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "messages-module",
            suggestedParentId: "frontend-application-layer",
            confidence: "medium",
            reason: "Feature module belongs under the frontend application layer.",
          },
        ],
        skips: [
          {
            nodeId: "frontend-application-layer",
            reason: "No top-level parent selected.",
          },
        ],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithStagedStructuralParent(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "en",
    });

    expect(result.candidates).toEqual([]);
    expect(result).toMatchObject({
      unsafeCount: 1,
      unsafe: [
        expect.objectContaining({
          nodeId: "messages-module",
          reason: expect.stringContaining("Unassigned Discoveries"),
        }),
      ],
    });
  });

  it("blocks detail discoveries from being flattened directly under root", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "risk-taxonomy-drift",
            suggestedParentId: "project-core",
            confidence: "medium",
            reason: "Incorrect root flattening.",
          },
        ],
        skips: [],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result.candidates).toEqual([]);
    expect(result).toMatchObject({
      unsafeCount: 1,
      unsafe: [
        expect.objectContaining({
          nodeId: "risk-taxonomy-drift",
          reason: expect.stringContaining("Only broad overview"),
        }),
      ],
    });
  });

  it("rejects moves that point inside the unassigned subtree", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "risk-taxonomy-drift",
            suggestedParentId: "risk-taxonomy-drift",
            confidence: "medium",
            reason: "Unsafe self parent.",
          },
        ],
        skips: [],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result.candidates).toEqual([]);
    expect(result).toMatchObject({
      unsafeCount: 1,
      unsafe: [
        expect.objectContaining({
          nodeId: "risk-taxonomy-drift",
        }),
      ],
    });
  });

  it("fails closed when AI returns malformed organizer JSON", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: "not-json",
    });

    await expect(
      organizeProjectMapUnassignedDiscoveries({
        workspaceId: "ws-1",
        dataset: datasetWithUnassignedNode(),
        engine: "claude",
        model: "claude-sonnet",
        preferredLanguage: "zh",
      }),
    ).rejects.toThrow("AI organizer output did not contain a JSON object.");
  });

  it("records unsafe parent moves without creating candidates", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "risk-taxonomy-drift",
            suggestedParentId: "project-core",
            confidence: "medium",
            reason: "Unsafe root parent.",
          },
        ],
        skips: [],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result.candidates).toEqual([]);
    expect(result).toMatchObject({
      unassignedCount: 1,
      skippedCount: 0,
      unsafeCount: 1,
      unsafe: [
        expect.objectContaining({
          nodeId: "risk-taxonomy-drift",
          reason: expect.stringContaining("project root"),
        }),
      ],
    });
  });

  it("records explicit and implicit skips so users can understand why nothing moved", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [],
        skips: [
          {
            nodeId: "risk-taxonomy-drift",
            reason: "No structural parent is specific enough.",
          },
        ],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result.candidates).toEqual([]);
    expect(result.skips).toEqual([
      expect.objectContaining({
        nodeId: "risk-taxonomy-drift",
        title: expect.stringContaining("Taxonomy Drift"),
        reason: "No structural parent is specific enough.",
      }),
    ]);
  });

  it("fails closed when AI returns both move and skip for the same node", async () => {
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        moves: [
          {
            nodeId: "risk-taxonomy-drift",
            suggestedParentId: "hub-risk",
            confidence: "medium",
            reason: "Move decision.",
          },
        ],
        skips: [
          {
            nodeId: "risk-taxonomy-drift",
            reason: "Skip decision.",
          },
          {
            nodeId: "risk-taxonomy-drift",
            reason: "Duplicate skip decision.",
          },
        ],
      }),
    });

    const result = await organizeProjectMapUnassignedDiscoveries({
      workspaceId: "ws-1",
      dataset: datasetWithUnassignedNode(),
      engine: "claude",
      model: "claude-sonnet",
      preferredLanguage: "zh",
    });

    expect(result.candidates).toEqual([]);
    expect(result.skips).toEqual([]);
    expect(result).toMatchObject({
      unsafeCount: 1,
      unsafe: [
        expect.objectContaining({
          nodeId: "risk-taxonomy-drift",
          reason: expect.stringContaining("both a move and a skip"),
        }),
      ],
    });
  });
});
