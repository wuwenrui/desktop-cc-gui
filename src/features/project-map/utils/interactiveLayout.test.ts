import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapDataset, ProjectMapNode } from "../types";
import {
  buildInteractiveProjectMapLayout,
  buildProjectMapMiniMapProjection,
  resolveVisibleProjectMapNodes,
  settleProjectMapLayout,
} from "./interactiveLayout";

function getFootprint(
  node: ProjectMapNode,
  rootNodeId: string,
): {
  width: number;
  height: number;
} {
  if (node.id === rootNodeId) {
    return { width: 208, height: 126 };
  }
  if (node.parentId === rootNodeId) {
    return { width: 188, height: 112 };
  }
  return { width: 176, height: 106 };
}

function expectNoOverlap(
  dataset: ProjectMapDataset,
  rootNodeId: string,
  positions: Array<{ id: string; x: number; y: number }>,
) {
  const nodeById = new Map(dataset.nodes.map((node) => [node.id, node]));
  for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
      const leftPosition = positions[leftIndex]!;
      const rightPosition = positions[rightIndex]!;
      const leftNode = nodeById.get(leftPosition.id)!;
      const rightNode = nodeById.get(rightPosition.id)!;
      const leftFootprint = getFootprint(leftNode, rootNodeId);
      const rightFootprint = getFootprint(rightNode, rootNodeId);
      const overlaps =
        Math.abs(leftPosition.x - rightPosition.x) <
          (leftFootprint.width + rightFootprint.width) / 2 + 26 &&
        Math.abs(leftPosition.y - rightPosition.y) <
          (leftFootprint.height + rightFootprint.height) / 2 + 26;

      expect(overlaps, `${leftPosition.id} overlaps ${rightPosition.id}`).toBe(false);
    }
  }
}

describe("interactive project map layout", () => {
  it("keeps task-like discoveries out of the root overview ring", () => {
    const taskNode: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-api")!,
      id: "root-bugfix-task",
      nodeKind: "bugfix",
      title: "Root Bugfix Task",
      parentId: "project-core",
      children: [],
    };
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: [
        ...mockProjectMapData.nodes.map((node) =>
          node.id === "project-core"
            ? { ...node, children: [...node.children, taskNode.id] }
            : node,
        ),
        taskNode,
      ],
    };

    const visibleNodeIds = resolveVisibleProjectMapNodes(dataset, null).map((node) => node.id);
    expect(visibleNodeIds).not.toContain("root-bugfix-task");
    expect(visibleNodeIds).toContain("unassigned-discoveries");

    const focusedNodeIds = resolveVisibleProjectMapNodes(dataset, "unassigned-discoveries").map(
      (node) => node.id,
    );
    expect(focusedNodeIds).toContain("root-bugfix-task");
  });

  it("keeps the old deterministic overview positions when no view-state exists", () => {
    const visibleNodes = resolveVisibleProjectMapNodes(mockProjectMapData, null);
    const layout = buildInteractiveProjectMapLayout({
      dataset: mockProjectMapData,
      visibleNodes,
      focusNodeId: null,
      preset: "radial",
    });
    const projectCore = layout.positions.find((position) => position.id === "project-core");
    const apiSurface = layout.positions.find((position) => position.id === "hub-api") ?? layout.positions[1];

    expect(projectCore).toMatchObject({ x: 1200, y: 800 });
    expect(apiSurface).toBeTruthy();
    expect(layout.edges.length).toBeGreaterThan(0);
    expect(layout.rootNodeId).toBe("project-core");
    expectNoOverlap(mockProjectMapData, "project-core", layout.positions);
  });

  it("applies persisted pinned positions without treating missing view-state as required", () => {
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      viewState: {
        layoutPreset: "radial",
        nodeLayouts: {
          "project-core": { x: 1111, y: 777, pinned: true },
          "missing-node": { x: 10, y: 10, pinned: true },
        },
      },
    };
    const layout = buildInteractiveProjectMapLayout({
      dataset,
      visibleNodes: resolveVisibleProjectMapNodes(dataset, null),
      focusNodeId: null,
    });

    expect(layout.positions.find((position) => position.id === "project-core")).toMatchObject({
      x: 1111,
      y: 777,
      pinned: true,
    });
    expect(layout.positions.some((position) => position.id === "missing-node")).toBe(false);
  });

  it("settles overlapping nodes while preserving pinned anchors", () => {
    const visibleNodes = mockProjectMapData.nodes.slice(0, 4);
    const positions = visibleNodes.map((node, index) => ({
      id: node.id,
      x: 1200 + index * 8,
      y: 800 + index * 6,
      pinned: node.id === "project-core",
    }));

    const settled = settleProjectMapLayout({
      positions,
      nodes: visibleNodes,
      rootNodeId: "project-core",
      preservePinned: true,
    });

    expect(settled.find((position) => position.id === "project-core")).toMatchObject({
      x: 1200,
      y: 800,
      pinned: true,
    });
    expectNoOverlap(mockProjectMapData, "project-core", settled);
  });

  it("changes unpinned positions when switching presets", () => {
    const radialLayout = buildInteractiveProjectMapLayout({
      dataset: mockProjectMapData,
      visibleNodes: resolveVisibleProjectMapNodes(mockProjectMapData, null),
      focusNodeId: null,
      preset: "radial",
    });
    const treeLayout = buildInteractiveProjectMapLayout({
      dataset: mockProjectMapData,
      visibleNodes: resolveVisibleProjectMapNodes(mockProjectMapData, null),
      focusNodeId: null,
      preset: "tree",
    });
    const radialApi = radialLayout.positions.find((position) => position.id === "hub-api");
    const treeApi = treeLayout.positions.find((position) => position.id === "hub-api");

    expect(radialApi).toBeTruthy();
    expect(treeApi).toBeTruthy();
    expect(treeApi).not.toMatchObject({ x: radialApi?.x, y: radialApi?.y });
  });

  it("ignores unpinned saved positions when building a different preset", () => {
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      viewState: {
        layoutPreset: "radial",
        nodeLayouts: {
          "hub-api": { x: 24, y: 48, pinned: false },
          "hub-risk": { x: 333, y: 444, pinned: true },
        },
      },
    };
    const visibleNodes = resolveVisibleProjectMapNodes(dataset, null);

    const radialLayout = buildInteractiveProjectMapLayout({
      dataset,
      visibleNodes,
      focusNodeId: null,
      preset: "radial",
      settle: false,
    });
    const treeLayout = buildInteractiveProjectMapLayout({
      dataset,
      visibleNodes,
      focusNodeId: null,
      preset: "tree",
      settle: false,
    });

    expect(radialLayout.positions.find((position) => position.id === "hub-api")).toMatchObject({
      x: 24,
      y: 48,
      pinned: false,
    });
    expect(treeLayout.positions.find((position) => position.id === "hub-api")).not.toMatchObject({
      x: 24,
      y: 48,
    });
    expect(treeLayout.positions.find((position) => position.id === "hub-risk")).toMatchObject({
      x: 333,
      y: 444,
      pinned: true,
    });
  });

  it("projects graph coordinates and viewport bounds into mini map space", () => {
    const layout = buildInteractiveProjectMapLayout({
      dataset: mockProjectMapData,
      visibleNodes: resolveVisibleProjectMapNodes(mockProjectMapData, null),
      focusNodeId: null,
      preset: "radial",
    });
    const miniMap = buildProjectMapMiniMapProjection({
      positions: layout.positions,
      nodes: resolveVisibleProjectMapNodes(mockProjectMapData, null),
      rootNodeId: layout.rootNodeId ?? "project-core",
      viewport: { zoom: 0.5, pan: { x: 0, y: 0 } },
      canvasSize: { width: 1000, height: 600 },
      miniMapSize: { width: 180, height: 120 },
    });

    expect(miniMap).toBeTruthy();
    expect(miniMap?.dots).toHaveLength(layout.positions.length);
    expect(miniMap?.viewport.right).toBeGreaterThan(miniMap?.viewport.left ?? 0);
    expect(miniMap?.viewport.bottom).toBeGreaterThan(miniMap?.viewport.top ?? 0);
    const restoredPoint = miniMap?.unprojectPoint(miniMap.projectPoint({ x: 1200, y: 800 }));
    expect(restoredPoint?.x).toBeCloseTo(1200, 1);
    expect(restoredPoint?.y).toBeCloseTo(800, 1);
  });
});
