import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, WheelEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ArrowDownRightFromCircle from "lucide-react/dist/esm/icons/arrow-down-right-from-circle";
import ArrowUpLeftFromCircle from "lucide-react/dist/esm/icons/arrow-up-left-from-circle";
import CircleX from "lucide-react/dist/esm/icons/circle-x";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import ListChecks from "lucide-react/dist/esm/icons/list-checks";
import RefreshCcw from "lucide-react/dist/esm/icons/refresh-ccw";
import Network from "lucide-react/dist/esm/icons/network";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-react/dist/esm/icons/zoom-out";

import { cn } from "../../../lib/utils";
import type { EngineType, ModelOption, WorkspaceInfo } from "../../../types";
import { useProjectMapDataset } from "../hooks/useProjectMapDataset";
import {
  normalizeEngineType,
  useProjectMapGenerationOptions,
} from "../hooks/useProjectMapGenerationOptions";
import type {
  ProjectMapDataset,
  ProjectMapGenerationRequest,
  ProjectMapLens,
  ProjectMapNode,
  ProjectMapNodeKind,
  ProjectMapRunMetadata,
  ProjectMapStorageLocation,
  ProjectMapSource,
} from "../types";

type ProjectMapPanelProps = {
  activeWorkspace?: WorkspaceInfo | null;
  workspaceName?: string | null;
  selectedEngine?: EngineType | null;
  selectedModelId?: string | null;
  models?: ModelOption[];
  dataset?: ProjectMapDataset;
};

type GraphNodePosition = {
  id: string;
  x: number;
  y: number;
};

type GraphEdge = {
  id: string;
  source: GraphNodePosition;
  target: GraphNodePosition;
};

type GraphViewport = {
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
};

type GraphBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const GRAPH_WIDTH = 2400;
const GRAPH_HEIGHT = 1600;
const DEFAULT_OVERVIEW_ZOOM = 0.52;
const DEFAULT_FOCUS_ZOOM = 0.56;
const GRAPH_NODE_GAP = 42;
const GRAPH_NODE_CANVAS_PADDING = 110;
const GRAPH_FIT_PADDING = 72;
const GRAPH_NODE_FOOTPRINT = {
  default: { width: 176, height: 106 },
  hub: { width: 188, height: 112 },
  core: { width: 208, height: 126 },
};
const PROJECT_CORE_NODE_ID = "project-core";
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.36;
const MAX_ZOOM = 1.08;
const ACTIVE_RUN_STATUSES = new Set<ProjectMapRunMetadata["status"]>(["pending", "running"]);

function normalizePathForComparing(value: string): string {
  return value.replace(/[\\/]+$/g, "").replace(/\\/g, "/");
}

function resolveGenerationWritePath(
  workspacePath: string | null,
  storageKey: string,
  storageLocation: ProjectMapStorageLocation,
  writePath: string,
): string {
  if (storageLocation === "project" && workspacePath) {
    const pathSeparator = workspacePath.includes("\\") ? "\\" : "/";
    const trimmedWorkspacePath = workspacePath.replace(/[\\/]+$/g, "");
    return `${trimmedWorkspacePath}${pathSeparator}.ccgui${pathSeparator}project-map${pathSeparator}${storageKey}`;
  }

  if (storageLocation === "global" && workspacePath) {
    const expected = normalizePathForComparing(
      `${workspacePath.replace(/[\\/]+$/g, "")}/.ccgui/project-map/${storageKey}`,
    );
    const normalized = normalizePathForComparing(writePath);
    const isCaseInsensitive = typeof process !== "undefined" && process.platform === "win32";
    if (isCaseInsensitive ? normalized.toLowerCase() === expected.toLowerCase() : normalized === expected) {
      return `.ccgui/project-map/${storageKey}`;
    }
  }

  return writePath;
}

function resolveSelectedGenerationModel(
  selectedModelId: string | null | undefined,
  models: ModelOption[] | undefined,
): string | null {
  const trimmedSelection = selectedModelId?.trim() ?? "";
  if (!trimmedSelection) {
    return null;
  }
  const matchedModel = models?.find(
    (model) => model.id === trimmedSelection || model.model === trimmedSelection,
  );
  return matchedModel?.model ?? trimmedSelection;
}

const CONFIDENCE_ORDER: Record<ProjectMapNode["confidence"], number> = {
  high: 4,
  medium: 3,
  low: 2,
  unknown: 1,
};

function buildNodeIndex(nodes: ProjectMapNode[]): Map<string, ProjectMapNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getProjectCoreNode(dataset: ProjectMapDataset): ProjectMapNode | null {
  return (
    dataset.nodes.find((node) => node.id === PROJECT_CORE_NODE_ID) ??
    dataset.nodes.find((node) => !node.parentId) ??
    dataset.nodes[0] ??
    null
  );
}

function getSortedChildren(
  node: ProjectMapNode,
  nodeIndex: Map<string, ProjectMapNode>,
): ProjectMapNode[] {
  return node.children
    .map((childId) => nodeIndex.get(childId))
    .filter((child): child is ProjectMapNode => Boolean(child))
    .sort(compareNodesForMap);
}

function compareNodesForMap(left: ProjectMapNode, right: ProjectMapNode): number {
  const leftSignal =
    Number(left.stale) * 8 +
    Number(left.candidate) * 4 +
    (5 - CONFIDENCE_ORDER[left.confidence]);
  const rightSignal =
    Number(right.stale) * 8 +
    Number(right.candidate) * 4 +
    (5 - CONFIDENCE_ORDER[right.confidence]);

  return rightSignal - leftSignal || left.title.localeCompare(right.title);
}

function getVisibleLenses(dataset: ProjectMapDataset): ProjectMapLens[] {
  return dataset.lenses.filter((lens) => lens.status !== "notApplicable");
}

function buildLensIndex(lenses: ProjectMapLens[]): Map<string, ProjectMapLens> {
  return new Map(lenses.map((lens) => [lens.id, lens]));
}

function getLensAngle(lensId: string, visibleLenses: ProjectMapLens[]): number {
  const lensIndex = Math.max(
    0,
    visibleLenses.findIndex((lens) => lens.id === lensId),
  );
  const lensCount = Math.max(visibleLenses.length, 1);
  return -90 + lensIndex * (360 / lensCount);
}

function getGraphNodeFootprint(
  node: ProjectMapNode,
  rootNodeId: string,
): {
  width: number;
  height: number;
} {
  if (node.id === rootNodeId) {
    return GRAPH_NODE_FOOTPRINT.core;
  }

  if (node.parentId === rootNodeId) {
    return GRAPH_NODE_FOOTPRINT.hub;
  }

  return GRAPH_NODE_FOOTPRINT.default;
}

function clampGraphPosition(
  position: GraphNodePosition,
  footprint: {
    width: number;
    height: number;
  },
): GraphNodePosition {
  const halfWidth = footprint.width / 2;
  const halfHeight = footprint.height / 2;
  return {
    ...position,
    x: Math.min(
      GRAPH_WIDTH - GRAPH_NODE_CANVAS_PADDING - halfWidth,
      Math.max(GRAPH_NODE_CANVAS_PADDING + halfWidth, position.x),
    ),
    y: Math.min(
      GRAPH_HEIGHT - GRAPH_NODE_CANVAS_PADDING - halfHeight,
      Math.max(GRAPH_NODE_CANVAS_PADDING + halfHeight, position.y),
    ),
  };
}

function clampGraphZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function getGraphPositionBounds(
  position: GraphNodePosition,
  node: ProjectMapNode,
  rootNodeId: string,
): GraphBounds {
  const footprint = getGraphNodeFootprint(node, rootNodeId);
  return {
    left: position.x - footprint.width / 2,
    right: position.x + footprint.width / 2,
    top: position.y - footprint.height / 2,
    bottom: position.y + footprint.height / 2,
  };
}

function buildGraphLayoutBounds(
  positions: GraphNodePosition[],
  nodes: ProjectMapNode[],
  rootNodeId: string,
): GraphBounds | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let bounds: GraphBounds | null = null;

  for (const position of positions) {
    const node = nodeById.get(position.id);
    if (!node) {
      continue;
    }

    const nodeBounds = getGraphPositionBounds(position, node, rootNodeId);
    bounds = bounds
      ? {
          left: Math.min(bounds.left, nodeBounds.left),
          right: Math.max(bounds.right, nodeBounds.right),
          top: Math.min(bounds.top, nodeBounds.top),
          bottom: Math.max(bounds.bottom, nodeBounds.bottom),
        }
      : nodeBounds;
  }

  return bounds;
}

function calculateFitGraphViewport(
  bounds: GraphBounds,
  canvasSize: {
    width: number;
    height: number;
  },
  fallbackZoom: number,
): GraphViewport {
  const boundsWidth = Math.max(1, bounds.right - bounds.left);
  const boundsHeight = Math.max(1, bounds.bottom - bounds.top);
  const availableWidth = Math.max(1, canvasSize.width - GRAPH_FIT_PADDING * 2);
  const availableHeight = Math.max(1, canvasSize.height - GRAPH_FIT_PADDING * 2);
  const fitZoom = clampGraphZoom(Math.min(
    fallbackZoom,
    availableWidth / boundsWidth,
    availableHeight / boundsHeight,
  ));
  const boundsCenter = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
  const graphCenter = {
    x: GRAPH_WIDTH / 2,
    y: GRAPH_HEIGHT / 2,
  };

  return {
    zoom: fitZoom,
    pan: {
      x: Number((-(boundsCenter.x - graphCenter.x) * fitZoom).toFixed(2)),
      y: Number((-(boundsCenter.y - graphCenter.y) * fitZoom).toFixed(2)),
    },
  };
}

function resolveGraphNodeCollisions(
  initialPositions: GraphNodePosition[],
  nodes: ProjectMapNode[],
  rootNodeId: string,
): GraphNodePosition[] {
  const center = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const positions = initialPositions.map((position) => {
    const node = nodeById.get(position.id);
    return node
      ? clampGraphPosition(position, getGraphNodeFootprint(node, rootNodeId))
      : position;
  });

  for (let passIndex = 0; passIndex < 90; passIndex += 1) {
    let didMoveNode = false;

    for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
        const leftNode = nodeById.get(positions[leftIndex]?.id ?? "");
        const rightNode = nodeById.get(positions[rightIndex]?.id ?? "");
        const leftPosition = positions[leftIndex];
        const rightPosition = positions[rightIndex];

        if (!leftNode || !rightNode || !leftPosition || !rightPosition) {
          continue;
        }

        const leftFootprint = getGraphNodeFootprint(leftNode, rootNodeId);
        const rightFootprint = getGraphNodeFootprint(rightNode, rootNodeId);
        const minimumDeltaX = (leftFootprint.width + rightFootprint.width) / 2 + GRAPH_NODE_GAP;
        const minimumDeltaY = (leftFootprint.height + rightFootprint.height) / 2 + GRAPH_NODE_GAP;
        const deltaX = rightPosition.x - leftPosition.x;
        const deltaY = rightPosition.y - leftPosition.y;
        const overlapX = minimumDeltaX - Math.abs(deltaX);
        const overlapY = minimumDeltaY - Math.abs(deltaY);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        const leftIsRoot = leftNode.id === rootNodeId;
        const rightIsRoot = rightNode.id === rootNodeId;
        const shouldMoveOnX = overlapX <= overlapY;
        const leftRadialSign = shouldMoveOnX
          ? Math.sign(leftPosition.x - center.x) || -1
          : Math.sign(leftPosition.y - center.y) || -1;
        const rightRadialSign = shouldMoveOnX
          ? Math.sign(rightPosition.x - center.x) || 1
          : Math.sign(rightPosition.y - center.y) || 1;
        const pairSign = shouldMoveOnX
          ? Math.sign(deltaX) || rightRadialSign
          : Math.sign(deltaY) || rightRadialSign;
        const pushDistance = (shouldMoveOnX ? overlapX : overlapY) + 2;
        const leftShare = leftIsRoot ? 0 : rightIsRoot ? 1 : 0.5;
        const rightShare = rightIsRoot ? 0 : leftIsRoot ? 1 : 0.5;

        if (shouldMoveOnX) {
          const nextLeftX = leftPosition.x - pairSign * pushDistance * leftShare;
          positions[leftIndex] = clampGraphPosition(
            {
              ...leftPosition,
              x: Number.isFinite(nextLeftX) ? nextLeftX : leftPosition.x + leftRadialSign,
            },
            leftFootprint,
          );
          positions[rightIndex] = clampGraphPosition(
            {
              ...rightPosition,
              x: rightPosition.x + pairSign * pushDistance * rightShare,
            },
            rightFootprint,
          );
        } else {
          const nextLeftY = leftPosition.y - pairSign * pushDistance * leftShare;
          positions[leftIndex] = clampGraphPosition(
            {
              ...leftPosition,
              y: Number.isFinite(nextLeftY) ? nextLeftY : leftPosition.y + leftRadialSign,
            },
            leftFootprint,
          );
          positions[rightIndex] = clampGraphPosition(
            {
              ...rightPosition,
              y: rightPosition.y + pairSign * pushDistance * rightShare,
            },
            rightFootprint,
          );
        }

        didMoveNode = true;
      }
    }

    if (!didMoveNode) {
      break;
    }
  }

  return positions;
}

function buildExpandedGraphSlots(count: number): Array<{ x: number; y: number }> {
  const centerX = GRAPH_WIDTH / 2;
  const columnOffsets = [760, 460, 1040];
  const rowY = [170, 365, 560, 755, 950, 1145, 1340, 1500];
  const slots: Array<{ x: number; y: number }> = [];

  for (const offset of columnOffsets) {
    for (const y of rowY) {
      slots.push({ x: centerX - offset, y });
      slots.push({ x: centerX + offset, y });
    }
  }

  return slots.slice(0, count);
}

function resolveVisibleNodes(
  dataset: ProjectMapDataset,
  focusNodeId: string | null,
): ProjectMapNode[] {
  const rootNode = getProjectCoreNode(dataset);
  if (!focusNodeId && rootNode) {
    const nodeIndex = buildNodeIndex(dataset.nodes);
    return [rootNode, ...getSortedChildren(rootNode, nodeIndex)];
  }

  if (!focusNodeId) {
    return dataset.nodes;
  }

  const nodeIndex = buildNodeIndex(dataset.nodes);
  const focusNode = nodeIndex.get(focusNodeId);
  if (!focusNode) {
    return dataset.nodes;
  }

  const visibleIds = new Set<string>([
    focusNode.id,
    focusNode.parentId ?? "",
    ...focusNode.children,
    ...dataset.nodes
      .filter((node) => node.children.includes(focusNode.id))
      .map((node) => node.id),
  ].filter(Boolean));

  return dataset.nodes
    .filter((node) => visibleIds.has(node.id))
    .sort((left, right) => {
      if (left.id === focusNode.id) {
        return -1;
      }
      if (right.id === focusNode.id) {
        return 1;
      }
      return compareNodesForMap(left, right);
    });
}

function buildOverviewPositions(
  nodes: ProjectMapNode[],
  rootNode: ProjectMapNode,
  nodeIndex: Map<string, ProjectMapNode>,
  visibleLenses: ProjectMapLens[],
): GraphNodePosition[] {
  const center = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  const positions: GraphNodePosition[] = [
    { id: rootNode.id, x: center.x, y: center.y },
  ];
  const directChildren = getSortedChildren(rootNode, nodeIndex);
  if (directChildren.length > 10) {
    const expandedSlots = buildExpandedGraphSlots(directChildren.length);
    for (const [index, hub] of directChildren.entries()) {
      const slot = expandedSlots[index];
      if (!slot) {
        continue;
      }
      positions.push({ id: hub.id, x: slot.x, y: slot.y });
    }
    return resolveGraphNodeCollisions(
      positions.filter((position) => nodes.some((node) => node.id === position.id)),
      nodes,
      rootNode.id,
    );
  }

  const hubRadiusX = 720;
  const hubRadiusY = 470;
  const shouldUseUniformHubAngles = directChildren.length > visibleLenses.length + 1;
  const childCountByLensId = new Map<string, number>();
  const placedCountByLensId = new Map<string, number>();

  for (const hub of directChildren) {
    childCountByLensId.set(hub.lensId, (childCountByLensId.get(hub.lensId) ?? 0) + 1);
  }

  for (const [index, hub] of directChildren.entries()) {
    const lensChildCount = childCountByLensId.get(hub.lensId) ?? 1;
    const lensChildIndex = placedCountByLensId.get(hub.lensId) ?? 0;
    placedCountByLensId.set(hub.lensId, lensChildIndex + 1);
    const lensFanOffset = shouldUseUniformHubAngles
      ? 0
      : (lensChildIndex - (lensChildCount - 1) / 2) * 24;
    const baseAngle = shouldUseUniformHubAngles
      ? -90 + index * (360 / Math.max(directChildren.length, 1))
      : visibleLenses.some((lens) => lens.id === hub.lensId)
        ? getLensAngle(hub.lensId, visibleLenses)
        : index * 52 - 90;
    const angle = toRadians(baseAngle + lensFanOffset);
    const hubX = center.x + Math.cos(angle) * hubRadiusX;
    const hubY = center.y + Math.sin(angle) * hubRadiusY;
    positions.push({ id: hub.id, x: hubX, y: hubY });
  }

  return resolveGraphNodeCollisions(
    positions.filter((position) => nodes.some((node) => node.id === position.id)),
    nodes,
    rootNode.id,
  );
}

function buildFocusPositions(
  nodes: ProjectMapNode[],
  focusNode: ProjectMapNode,
): GraphNodePosition[] {
  const center = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  const contextNodes = nodes.filter((node) => node.id !== focusNode.id);
  const positions: GraphNodePosition[] = [
    { id: focusNode.id, x: center.x, y: center.y },
  ];
  const expandedSlots = contextNodes.length > 9 ? buildExpandedGraphSlots(contextNodes.length) : [];

  contextNodes.forEach((node, index) => {
    const expandedSlot = expandedSlots[index];
    if (expandedSlot) {
      positions.push({ id: node.id, x: expandedSlot.x, y: expandedSlot.y });
      return;
    }

    const angle = toRadians(index * (360 / Math.max(contextNodes.length, 1)) - 90);
    const childRadius = 650;
    const contextRadius = 440;
    const radius = node.parentId === focusNode.id ? childRadius : contextRadius;
    positions.push({
      id: node.id,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * (radius * 0.78),
    });
  });

  return resolveGraphNodeCollisions(positions, nodes, focusNode.id);
}

function buildGraphLayout(
  visibleNodes: ProjectMapNode[],
  dataset: ProjectMapDataset,
  focusNodeId: string | null,
): {
  positions: GraphNodePosition[];
  edges: GraphEdge[];
} {
  const nodeIndex = buildNodeIndex(dataset.nodes);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const rootNode = getProjectCoreNode(dataset);
  const focusNode = focusNodeId ? nodeIndex.get(focusNodeId) ?? null : null;
  const visibleLenses = getVisibleLenses(dataset);
  const positions =
    focusNode && visibleIds.has(focusNode.id)
      ? buildFocusPositions(visibleNodes, focusNode)
      : rootNode
        ? buildOverviewPositions(visibleNodes, rootNode, nodeIndex, visibleLenses)
        : [];
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const edges = visibleNodes.flatMap((node) => {
    const source = positionById.get(node.id);
    if (!source) {
      return [];
    }
    return node.children.flatMap((childId) => {
      const target = positionById.get(childId);
      if (!target || !visibleIds.has(childId)) {
        return [];
      }
      return [{ id: `${node.id}-${childId}`, source, target }];
    });
  });

  return { positions, edges };
}

function buildNeighborSet(
  nodes: ProjectMapNode[],
  selectedNodeId: string | null,
  hoverNodeId: string | null,
  isFocusedView: boolean,
): Set<string> {
  const focusNodeId = hoverNodeId ?? (isFocusedView ? selectedNodeId : null);
  if (!focusNodeId) {
    return new Set(nodes.map((node) => node.id));
  }
  const focusedNode = nodes.find((node) => node.id === focusNodeId);
  if (!focusedNode) {
    return new Set(nodes.map((node) => node.id));
  }
  return new Set([
    focusedNode.id,
    focusedNode.parentId ?? "",
    ...focusedNode.children,
    ...nodes
      .filter((node) => node.children.includes(focusedNode.id))
      .map((node) => node.id),
  ].filter(Boolean));
}

function getDescendantStats(
  node: ProjectMapNode,
  nodeIndex: Map<string, ProjectMapNode>,
): {
  count: number;
  stale: number;
  candidate: number;
} {
  const children = getSortedChildren(node, nodeIndex);
  return {
    count: children.length,
    stale: children.filter((child) => child.stale).length,
    candidate: children.filter((child) => child.candidate).length,
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFallbackLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase()) || value;
}

function translateNodeKind(
  t: TFunction,
  nodeKind: ProjectMapNodeKind | string,
): string {
  return t(`projectMap.nodeKind.${nodeKind}`, {
    defaultValue: formatFallbackLabel(String(nodeKind)),
  });
}

function translateSourceType(
  t: TFunction,
  sourceType: ProjectMapSource["type"] | string,
): string {
  return t(`projectMap.sourceType.${sourceType}`, {
    defaultValue: String(sourceType).toUpperCase(),
  });
}

function getGenerationQueue(runs: ProjectMapRunMetadata[]): ProjectMapRunMetadata[] {
  return runs
    .filter((run) => ACTIVE_RUN_STATUSES.has(run.status))
    .sort((left, right) => {
      const statusDelta = Number(right.status === "running") - Number(left.status === "running");
      return statusDelta || new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime();
    });
}

function getRecentRuns(runs: ProjectMapRunMetadata[]): ProjectMapRunMetadata[] {
  return runs
    .filter((run) => !ACTIVE_RUN_STATUSES.has(run.status))
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
}

function SourceChip({ source }: { source: ProjectMapSource }) {
  const { t } = useTranslation();

  return (
    <span className="project-map-source-chip" title={source.path ?? source.label}>
      <span className="project-map-source-type">{translateSourceType(t, source.type)}</span>
      {source.label}
    </span>
  );
}

export function ProjectMapPanel({
  activeWorkspace = null,
  workspaceName,
  selectedEngine = null,
  selectedModelId = null,
  models,
  dataset: controlledDataset,
}: ProjectMapPanelProps) {
  const { t } = useTranslation();
  const selectedGenerationModel = useMemo(
    () => resolveSelectedGenerationModel(selectedModelId, models),
    [models, selectedModelId],
  );
  const generationDefaults = useMemo(
    () => ({
      engine: selectedEngine,
      model: selectedGenerationModel,
    }),
    [selectedEngine, selectedGenerationModel],
  );
  const datasetController = useProjectMapDataset(
    controlledDataset ? null : activeWorkspace,
    { generationDefaults },
  );
  const dataset = controlledDataset ?? datasetController.dataset;
  const nodeIndex = useMemo(() => buildNodeIndex(dataset.nodes), [dataset.nodes]);
  const visibleLenses = useMemo(() => getVisibleLenses(dataset), [dataset]);
  const lensIndex = useMemo(() => buildLensIndex(dataset.lenses), [dataset.lenses]);
  const rootNode = getProjectCoreNode(dataset);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => rootNode?.id ?? null,
  );
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [isLensStripCollapsed, setIsLensStripCollapsed] = useState(true);
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [viewport, setViewport] = useState<GraphViewport>({
    zoom: DEFAULT_OVERVIEW_ZOOM,
    pan: { x: 0, y: 0 },
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const visibleNodes = useMemo(
    () => resolveVisibleNodes(dataset, focusNodeId),
    [dataset, focusNodeId],
  );
  const selectedNode =
    (selectedNodeId ? nodeIndex.get(selectedNodeId) : null) ??
    (focusNodeId ? nodeIndex.get(focusNodeId) : rootNode) ??
    visibleNodes[0] ??
    null;
  const graphLayout = useMemo(
    () => buildGraphLayout(visibleNodes, dataset, focusNodeId),
    [dataset, focusNodeId, visibleNodes],
  );
  const neighborNodeIds = useMemo(
    () => buildNeighborSet(visibleNodes, selectedNode?.id ?? null, hoverNodeId, Boolean(focusNodeId)),
    [focusNodeId, hoverNodeId, selectedNode?.id, visibleNodes],
  );
  const projectName = workspaceName?.trim() || dataset.manifest.projectName;
  const candidateCount = dataset.nodes.filter((node) => node.candidate).length;
  const staleCount = dataset.nodes.filter((node) => node.stale).length;
  const generationQueue = useMemo(() => getGenerationQueue(dataset.runs), [dataset.runs]);
  const recentRuns = useMemo(() => getRecentRuns(dataset.runs), [dataset.runs]);
  const activeGenerationRun = generationQueue[0] ?? null;
  const queuedGenerationRuns = generationQueue.slice(1);
  const previousGenerationQueueCountRef = useRef(generationQueue.length);
  const hubNodes = rootNode ? getSortedChildren(rootNode, nodeIndex) : [];
  const detectedLensCount = visibleLenses.filter((lens) => lens.status === "detected").length;
  const candidateLensCount = visibleLenses.filter((lens) => lens.status === "candidate").length;
  const activeLens = selectedNode ? lensIndex.get(selectedNode.lensId) ?? null : null;
  const isPersistenceBacked = Boolean(activeWorkspace?.id) && !controlledDataset;
  const fitGraphToViewport = useCallback(() => {
    const rootNodeId = (focusNodeId ? nodeIndex.get(focusNodeId)?.id : rootNode?.id) ?? rootNode?.id;
    if (!rootNodeId) {
      return;
    }

    const bounds = buildGraphLayoutBounds(graphLayout.positions, visibleNodes, rootNodeId);
    if (!bounds) {
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const canvasSize = {
      width: canvasRect?.width && canvasRect.width > 0 ? canvasRect.width : 1100,
      height: canvasRect?.height && canvasRect.height > 0 ? canvasRect.height : 680,
    };
    const fallbackZoom = focusNodeId ? DEFAULT_FOCUS_ZOOM : DEFAULT_OVERVIEW_ZOOM;
    setViewport(calculateFitGraphViewport(bounds, canvasSize, fallbackZoom));
  }, [focusNodeId, graphLayout.positions, nodeIndex, rootNode?.id, visibleNodes]);

  useEffect(() => {
    if (generationQueue.length > previousGenerationQueueCountRef.current) {
      setIsTaskDrawerOpen(true);
    }
    previousGenerationQueueCountRef.current = generationQueue.length;
  }, [generationQueue.length]);

  useEffect(() => {
    fitGraphToViewport();
  }, [fitGraphToViewport]);

  const handleNodeSelect = (node: ProjectMapNode) => {
    setHoverNodeId(null);
    setSelectedNodeId(node.id);
    setIsDetailCollapsed(false);
  };

  const handleDrillIn = (node: ProjectMapNode | null) => {
    if (!node || node.children.length === 0 || node.id === rootNode?.id) {
      return;
    }
    setHoverNodeId(null);
    setSelectedNodeId(node.id);
    setFocusNodeId(node.id);
  };

  const handleDrillUp = (node: ProjectMapNode | null) => {
    if (!node?.parentId || node.parentId === rootNode?.id) {
      handleBackToOverview();
      return;
    }

    setHoverNodeId(null);
    setSelectedNodeId(node.parentId);
    setFocusNodeId(node.parentId);
  };

  const handleBackToOverview = () => {
    setFocusNodeId(null);
    setSelectedNodeId(rootNode?.id ?? null);
    setHoverNodeId(null);
  };

  const updateZoom = (nextZoom: number) => {
    setViewport((current) => ({
      ...current,
      zoom: clampGraphZoom(nextZoom),
    }));
  };

  const handleCanvasPointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if ((event.target as HTMLElement).closest("button, aside, .project-map-node")) {
      return;
    }
    panStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.pan.x,
      originY: viewport.pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    setViewport((current) => ({
      ...current,
      pan: {
        x: start.originX + event.clientX - start.startX,
        y: start.originY + event.clientY - start.startY,
      },
    }));
  };

  const handleCanvasPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId === event.pointerId) {
      panStartRef.current = null;
    }
  };

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, aside")) {
      return;
    }

    event.preventDefault();
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const anchor = {
      x: event.clientX - canvasRect.left - canvasRect.width / 2,
      y: event.clientY - canvasRect.top - canvasRect.height / 2,
    };
    const zoomDelta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;

    setViewport((current) => {
      const nextZoom = clampGraphZoom(current.zoom + zoomDelta);
      if (nextZoom === current.zoom) {
        return current;
      }

      const anchoredGraphPoint = {
        x: (anchor.x - current.pan.x) / current.zoom,
        y: (anchor.y - current.pan.y) / current.zoom,
      };

      return {
        zoom: nextZoom,
        pan: {
          x: Number((anchor.x - anchoredGraphPoint.x * nextZoom).toFixed(2)),
          y: Number((anchor.y - anchoredGraphPoint.y * nextZoom).toFixed(2)),
        },
      };
    });
  };

  const handleNodeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    node: ProjectMapNode,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleNodeSelect(node);
  };

  const handleNodeDrillClick = (
    event: MouseEvent<HTMLButtonElement>,
    node: ProjectMapNode,
  ) => {
    event.stopPropagation();
    handleNodeSelect(node);
    handleDrillIn(node);
  };

  const handleNodeDrillUpClick = (
    event: MouseEvent<HTMLButtonElement>,
    node: ProjectMapNode,
  ) => {
    event.stopPropagation();
    handleDrillUp(node);
  };

  return (
    <section className="project-map-panel" aria-label={t("projectMap.panelTitle")}>
      <header className="project-map-topbar">
        <div className="project-map-header-copy">
          <div className="project-map-title-line">
            <span className="project-map-eyebrow">{t("projectMap.eyebrow")}</span>
            <h2>{t("projectMap.title", { projectName })}</h2>
          </div>
          <div className="project-map-meta-row">
            <span>
              {t("projectMap.lastGenerated", {
                value: formatDateTime(dataset.manifest.updatedAt),
              })}
            </span>
            <span>
              {t("projectMap.storageKey", { value: dataset.manifest.storageKey })}
            </span>
            <span>
              {t("projectMap.profileSummary", {
                language: dataset.profile.primaryLanguage,
                shapes: dataset.profile.shapes.join(" / "),
              })}
            </span>
          </div>
        </div>
        <div className="project-map-actions">
          {isPersistenceBacked ? (
            <div
              className="project-map-storage-switch"
              role="group"
              aria-label={t("projectMap.storage.readLocation")}
            >
              <span>{t("projectMap.storage.readLocation")}</span>
              <button
                type="button"
                className={cn(datasetController.activeReadLocation === "global" && "is-active")}
                aria-pressed={datasetController.activeReadLocation === "global"}
                onClick={() => datasetController.switchReadLocation("global")}
              >
                {t("projectMap.storage.global")}
              </button>
              <button
                type="button"
                className={cn(datasetController.activeReadLocation === "project" && "is-active")}
                aria-pressed={datasetController.activeReadLocation === "project"}
                onClick={() => datasetController.switchReadLocation("project")}
              >
                {t("projectMap.storage.project")}
              </button>
            </div>
          ) : null}
          {candidateCount > 0 ? (
            <span className="project-map-candidate-badge">
              {t("projectMap.candidateBadge", { count: candidateCount })}
            </span>
          ) : null}
          <button
            className="project-map-icon-button"
            type="button"
            onClick={() => datasetController.openRefreshEvidence(selectedNode)}
          >
            <RefreshCw aria-hidden />
            {t("projectMap.refreshEvidence")}
          </button>
          <button
            className={cn("project-map-task-button", generationQueue.length > 0 && "has-active-task")}
            type="button"
            aria-expanded={isTaskDrawerOpen}
            onClick={() => setIsTaskDrawerOpen((current) => !current)}
          >
            <ListChecks aria-hidden />
            {t("projectMap.tasks.button")}
            <span>{generationQueue.length}</span>
          </button>
          <button
            className="project-map-primary-button"
            type="button"
            onClick={datasetController.openGlobalCollection}
          >
            <Sparkles aria-hidden />
            {t("projectMap.collectFramework")}
          </button>
        </div>
      </header>

      <main className="project-map-stage" aria-label={t("projectMap.stageAria")}>
        {activeGenerationRun ? (
          <GenerationQueueBanner
            activeRun={activeGenerationRun}
            queuedCount={queuedGenerationRuns.length}
          />
        ) : null}
        <div className={cn("project-map-lens-shell", isLensStripCollapsed && "is-collapsed")}>
        <div className="project-map-stage-toolbar">
          <div className="project-map-breadcrumb" aria-label={t("projectMap.breadcrumb")}>
            <button type="button" onClick={handleBackToOverview}>
              <Network aria-hidden />
              {t("projectMap.breadcrumbRoot")}
            </button>
            {activeLens && focusNodeId ? (
              <>
                <span>/</span>
                <strong>{activeLens.title}</strong>
              </>
            ) : null}
          </div>
          <div className="project-map-stage-stats">
            <span>{t("projectMap.totalNodes", { count: dataset.nodes.length })}</span>
            <span>{t("projectMap.lensStats", { detected: detectedLensCount, candidate: candidateLensCount })}</span>
            <span>{t("projectMap.staleNodes", { count: staleCount })}</span>
            <span>{t("projectMap.candidateNodes", { count: candidateCount })}</span>
            <button
              className="project-map-lens-toggle"
              type="button"
              aria-expanded={!isLensStripCollapsed}
              onClick={() => setIsLensStripCollapsed((current) => !current)}
            >
              {isLensStripCollapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
              {isLensStripCollapsed ? t("projectMap.expandLenses") : t("projectMap.collapseLenses")}
            </button>
          </div>
        </div>

        {!isLensStripCollapsed ? (
          <div className="project-map-domain-strip" aria-label={t("projectMap.domainStrip")}>
            <button
              className={cn("project-map-domain-chip", !focusNodeId && "is-active")}
              type="button"
              onClick={handleBackToOverview}
            >
              <span>{t("projectMap.breadcrumbRoot")}</span>
            </button>
            {hubNodes.map((node) => (
              <button
                key={node.id}
                className={cn("project-map-domain-chip", focusNodeId === node.id && "is-active")}
                type="button"
                onClick={() => {
                  handleNodeSelect(node);
                  handleDrillIn(node);
                  setIsLensStripCollapsed(true);
                }}
              >
                <span>{lensIndex.get(node.lensId)?.shortTitle ?? node.lensId}</span>
                <strong>{node.title}</strong>
                <em>{t(`projectMap.lensStatus.${lensIndex.get(node.lensId)?.status ?? "candidate"}`)}</em>
              </button>
            ))}
        </div>
        ) : null}
        </div>

        {datasetController.status === "error" && !controlledDataset ? (
          <div className="project-map-empty-state">
            <Crosshair aria-hidden />
            <h3>{t("projectMap.loadErrorTitle")}</h3>
            <p>{datasetController.error}</p>
            <button className="project-map-primary-button" type="button" onClick={datasetController.reload}>
              <RefreshCw aria-hidden />
              {t("projectMap.retryLoad")}
            </button>
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="project-map-empty-state">
            <Crosshair aria-hidden />
            <h3>{t("projectMap.emptyTitle")}</h3>
            <p>{t("projectMap.emptyDescription")}</p>
            <button
              className="project-map-empty-action"
              type="button"
              onClick={datasetController.openGlobalCollection}
            >
              <Sparkles aria-hidden />
              {t("projectMap.collectFramework")}
            </button>
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="project-map-graph-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerEnd}
            onPointerCancel={handleCanvasPointerEnd}
            onWheel={handleCanvasWheel}
          >
            <div className="project-map-zoom-controls" aria-label={t("projectMap.zoomControls")}>
              <button
                type="button"
                onClick={() => updateZoom(viewport.zoom - ZOOM_STEP)}
                aria-label={t("projectMap.zoomOut")}
              >
                <ZoomOut aria-hidden />
              </button>
              <button
                type="button"
                onClick={fitGraphToViewport}
              >
                {t("projectMap.resetView")}
              </button>
              <button
                type="button"
                onClick={() => updateZoom(viewport.zoom + ZOOM_STEP)}
                aria-label={t("projectMap.zoomIn")}
              >
                <ZoomIn aria-hidden />
              </button>
            </div>
            <div
              className="project-map-graph-viewport"
              style={{
                transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
              }}
            >
              <svg
                className="project-map-graph-lines"
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                aria-hidden
              >
                {graphLayout.edges.map((edge) => {
                  const isFocused =
                    neighborNodeIds.has(edge.source.id) &&
                    neighborNodeIds.has(edge.target.id);
                  return (
                    <line
                      key={edge.id}
                      x1={edge.source.x}
                      y1={edge.source.y}
                      x2={edge.target.x}
                      y2={edge.target.y}
                      className={cn("project-map-edge", isFocused && "is-focused")}
                    />
                  );
                })}
              </svg>
              {graphLayout.positions.map((position) => {
                const node = nodeIndex.get(position.id);
                if (!node) {
                  return null;
                }
                const isSelected = selectedNode?.id === node.id;
                const isFocused = neighborNodeIds.has(node.id);
                const isHub = node.parentId === rootNode?.id;
                const descendantStats = getDescendantStats(node, nodeIndex);
                return (
                  <div
                    key={node.id}
                    className={cn(
                      "project-map-node",
                      isHub && "is-hub",
                      node.id === rootNode?.id && "is-core",
                      `confidence-${node.confidence}`,
                      node.stale && "is-stale",
                      node.candidate && "is-candidate",
                      isSelected && "is-selected",
                      !isFocused && "is-dimmed",
                    )}
                    role="button"
                    tabIndex={0}
                    style={{ left: position.x, top: position.y }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => handleNodeSelect(node)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node)}
                    onDoubleClick={() => handleDrillIn(node)}
                    onMouseEnter={() => setHoverNodeId(node.id)}
                    onMouseLeave={() => setHoverNodeId(null)}
                    aria-pressed={isSelected}
                    aria-label={`${t("projectMap.nodeAria", { title: node.title })}: ${node.title}`}
                  >
                    <span className="project-map-node-kind">
                      {translateNodeKind(t, node.nodeKind)}
                    </span>
                    <strong>{node.title}</strong>
                    <span>{lensIndex.get(node.lensId)?.shortTitle ?? node.lensId}</span>
                    <span className="project-map-node-status">
                      {node.stale ? t("projectMap.status.stale") : t("projectMap.status.current")}
                      {" · "}
                      {t(`projectMap.confidence.${node.confidence}`)}
                    </span>
                    {descendantStats.count > 0 ? (
                      <span className="project-map-node-counts">
                        {t("projectMap.nodeCounts", {
                          count: descendantStats.count,
                          stale: descendantStats.stale,
                          candidate: descendantStats.candidate,
                        })}
                      </span>
                    ) : null}
                    <span className="project-map-node-drill-actions">
                      {focusNodeId === node.id && node.parentId ? (
                        <button
                          className="project-map-node-drill-action is-up"
                          type="button"
                          onClick={(event) => handleNodeDrillUpClick(event, node)}
                          aria-label={t("projectMap.drillUpNode", { title: node.title })}
                          title={t("projectMap.drillUp")}
                        >
                          <ArrowUpLeftFromCircle aria-hidden />
                        </button>
                      ) : null}
                      {node.children.length > 0 && node.id !== rootNode?.id ? (
                        <button
                          className="project-map-node-drill-action is-down"
                          type="button"
                          onClick={(event) => handleNodeDrillClick(event, node)}
                          aria-label={t("projectMap.drillDownNode", { title: node.title })}
                          title={t("projectMap.drillDown")}
                        >
                          <ArrowDownRightFromCircle aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>

            <DetailPanel
              node={selectedNode}
              dataset={dataset}
              lens={selectedNode ? lensIndex.get(selectedNode.lensId) ?? null : null}
              staleCount={staleCount}
              canDrill={Boolean(selectedNode?.children.length && selectedNode.id !== rootNode?.id)}
              collapsed={isDetailCollapsed}
              onCollapsedChange={setIsDetailCollapsed}
              onBack={focusNodeId ? handleBackToOverview : null}
              onDrill={() => handleDrillIn(selectedNode)}
              onCompleteNode={() => selectedNode ? datasetController.openNodeGeneration("node", selectedNode) : undefined}
              onCalibrateNode={() => selectedNode ? datasetController.openNodeGeneration("calibrate", selectedNode) : undefined}
              onRefreshEvidence={() => datasetController.openRefreshEvidence(selectedNode)}
            />
          </div>
        )}
      </main>
      <ProjectMapSettingsPanel
        dataset={dataset}
        disabled={!isPersistenceBacked}
        onUpdate={datasetController.updateDataset}
      />
      <GenerationConfirmationDialog
        activeWorkspace={activeWorkspace}
        request={datasetController.pendingRequest}
        storageKey={dataset.manifest.storageKey}
        onCancel={datasetController.closeGenerationRequest}
        onConfirm={datasetController.confirmGenerationRequest}
      />
      {isTaskDrawerOpen ? (
        <GenerationTaskDrawer
          activeRun={activeGenerationRun}
          queuedRuns={queuedGenerationRuns}
          recentRuns={recentRuns}
          onCancelRun={datasetController.cancelGenerationRun}
          onClearFinished={datasetController.clearFinishedRuns}
          onClose={() => setIsTaskDrawerOpen(false)}
        />
      ) : null}
    </section>
  );
}

function GenerationQueueBanner({
  activeRun,
  queuedCount,
}: {
  activeRun: ProjectMapRunMetadata;
  queuedCount: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="project-map-task-banner" aria-label={t("projectMap.tasks.bannerAria")}>
      <div>
        <span className="project-map-task-state">
          {activeRun.status === "running"
            ? t("projectMap.tasks.running")
            : t("projectMap.tasks.activeSlot")}
        </span>
        <strong>{t("projectMap.tasks.bannerTitle")}</strong>
        <p>
          {t("projectMap.tasks.bannerBody", {
            engine: activeRun.engine,
            model: activeRun.model,
            queued: queuedCount,
          })}
        </p>
      </div>
      <code>{activeRun.writePath ?? "-"}</code>
    </section>
  );
}

function GenerationTaskDrawer({
  activeRun,
  queuedRuns,
  recentRuns,
  onCancelRun,
  onClearFinished,
  onClose,
}: {
  activeRun: ProjectMapRunMetadata | null;
  queuedRuns: ProjectMapRunMetadata[];
  recentRuns: ProjectMapRunMetadata[];
  onCancelRun: (runId: string) => Promise<void>;
  onClearFinished: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hasClearableRuns = recentRuns.length > 0;

  return (
    <aside
      className="project-map-task-drawer"
      role="dialog"
      aria-modal="false"
      aria-label={t("projectMap.tasks.drawerTitle")}
    >
      <header>
        <div>
          <span className="project-map-eyebrow">{t("projectMap.tasks.eyebrow")}</span>
          <h3>{t("projectMap.tasks.drawerTitle")}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label={t("projectMap.tasks.close")}>
          <X aria-hidden />
        </button>
      </header>
      <section className="project-map-task-active-card">
        <h4>{t("projectMap.tasks.activeTitle")}</h4>
        {activeRun ? (
          <ProjectMapRunCard
            run={activeRun}
            badge={t("projectMap.tasks.activeBadge")}
            mode="active"
            onCancel={() => void onCancelRun(activeRun.id)}
          />
        ) : (
          <p>{t("projectMap.tasks.emptyActive")}</p>
        )}
      </section>
      <section>
        <h4>{t("projectMap.tasks.queueTitle", { count: queuedRuns.length })}</h4>
        {queuedRuns.length > 0 ? (
          <div className="project-map-task-list">
            {queuedRuns.map((run, index) => (
              <ProjectMapRunCard
                key={run.id}
                run={run}
                badge={t("projectMap.tasks.queueBadge", { index: index + 1 })}
                mode="queue"
                onCancel={() => void onCancelRun(run.id)}
              />
            ))}
          </div>
        ) : (
          <p>{t("projectMap.tasks.emptyQueue")}</p>
        )}
      </section>
      <section>
        <div className="project-map-task-section-heading">
          <h4>{t("projectMap.tasks.recentTitle")}</h4>
          {hasClearableRuns ? (
            <button
              className="project-map-task-clear"
              type="button"
              onClick={() => void onClearFinished()}
            >
              <Trash2 aria-hidden />
              {t("projectMap.tasks.clearDone")}
            </button>
          ) : null}
        </div>
        {recentRuns.length > 0 ? (
          <div className="project-map-task-list">
            {recentRuns.slice(0, 6).map((run) => (
              <ProjectMapRunCard
                key={`${run.id}-recent`}
                run={run}
                badge={t(`projectMap.tasks.status.${run.status}`)}
                mode="recent"
              />
            ))}
          </div>
        ) : (
          <p>{t("projectMap.tasks.emptyRecent")}</p>
        )}
      </section>
      <footer>
        <p>{t("projectMap.tasks.closeHint")}</p>
      </footer>
    </aside>
  );
}

function ProjectMapRunCard({
  run,
  badge,
  mode = "recent",
  onCancel,
}: {
  run: ProjectMapRunMetadata;
  badge: string;
  mode?: "active" | "queue" | "recent";
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const showProgress = mode === "active" && ACTIVE_RUN_STATUSES.has(run.status);
  const showCancelButton = Boolean(onCancel) && ACTIVE_RUN_STATUSES.has(run.status);
  const cancelTitle =
    mode === "active"
      ? t("projectMap.tasks.stop")
      : t("projectMap.tasks.cancel");
  const cancelAriaLabel =
    mode === "active"
      ? t("projectMap.tasks.stopRun", { runId: run.id })
      : t("projectMap.tasks.cancelRun", { runId: run.id });
  const phase = run.phase ?? (run.status === "running" ? "askingAi" : "queued");
  const progress = typeof run.progress === "number" ? run.progress : run.status === "running" ? 45 : 8;
  const latestLog = run.logs?.[run.logs.length - 1] ?? null;

  return (
    <article className={cn("project-map-task-card", `status-${run.status}`, `mode-${mode}`)}>
      <div className="project-map-task-card-head">
        <span>{badge}</span>
        <strong>{run.id}</strong>
        {showCancelButton ? (
          <button
            className="project-map-task-cancel"
            type="button"
            onClick={onCancel}
            aria-label={cancelAriaLabel}
            title={cancelTitle}
          >
            <CircleX aria-hidden />
          </button>
        ) : null}
      </div>
      {showProgress ? (
        <div className="project-map-task-progress" aria-label={t("projectMap.tasks.progressAria")}>
          <span style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
      {mode === "active" ? (
        <p className="project-map-task-phase">
          {t(`projectMap.tasks.phase.${phase}`)}
        </p>
      ) : null}
      {latestLog ? (
        <p className="project-map-task-log">
          {formatDateTime(latestLog.at)} · {latestLog.message}
        </p>
      ) : null}
      <dl>
        <div>
          <dt>{t("projectMap.confirmation.engine")}</dt>
          <dd>{run.engine}</dd>
        </div>
        <div>
          <dt>{t("projectMap.confirmation.model")}</dt>
          <dd>{run.model}</dd>
        </div>
        <div>
          <dt>{t("projectMap.confirmation.scope")}</dt>
          <dd>{run.scope}</dd>
        </div>
        <div>
          <dt>{t("projectMap.tasks.startedAt")}</dt>
          <dd>{formatDateTime(run.startedAt)}</dd>
        </div>
        {run.threadId ? (
          <div>
            <dt>{t("projectMap.tasks.threadId")}</dt>
            <dd>{run.threadId}</dd>
          </div>
        ) : null}
      </dl>
      <code>{run.writePath ?? "-"}</code>
      {run.error ? <p className="project-map-task-error">{run.error}</p> : null}
    </article>
  );
}

function DetailPanel({
  node,
  dataset,
  lens,
  staleCount,
  canDrill,
  collapsed,
  onCollapsedChange,
  onBack,
  onDrill,
  onCompleteNode,
  onCalibrateNode,
  onRefreshEvidence,
}: {
  node: ProjectMapNode | null;
  dataset: ProjectMapDataset;
  lens: ProjectMapLens | null;
  staleCount: number;
  canDrill: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onBack: (() => void) | null;
  onDrill: () => void;
  onCompleteNode: () => void;
  onCalibrateNode: () => void;
  onRefreshEvidence: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside
      className={cn("project-map-detail-panel", collapsed && "is-collapsed")}
      aria-label={t("projectMap.detailPanel")}
    >
      <button
        className="project-map-detail-toggle"
        type="button"
        aria-expanded={!collapsed}
        onClick={() => onCollapsedChange(!collapsed)}
      >
        {collapsed ? <ChevronLeft aria-hidden /> : <ChevronRight aria-hidden />}
        <span>
          {collapsed
            ? t("projectMap.expandDetail")
            : t("projectMap.collapseDetail")}
        </span>
      </button>
      {collapsed ? (
        <div className="project-map-detail-peek">
          <span className="project-map-node-kind">
            {node ? translateNodeKind(t, node.nodeKind) : t("projectMap.inspector")}
          </span>
          <strong>{node?.title ?? t("projectMap.emptyInspector")}</strong>
        </div>
      ) : null}
      {!collapsed ? (
        <>
      {onBack ? (
        <button className="project-map-back-button" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden />
          {t("projectMap.backToOverview")}
        </button>
      ) : null}
      {node ? (
        <>
          <div className="project-map-inspector-heading">
            <span className="project-map-node-kind">{translateNodeKind(t, node.nodeKind)}</span>
            <h3>{node.title}</h3>
            <p>{node.summary}</p>
            <div className="project-map-inspector-badges">
              {lens ? <span>{lens.title}</span> : null}
              {lens ? <span>{t(`projectMap.lensStatus.${lens.status}`)}</span> : null}
              <span className={`confidence-${node.confidence}`}>
                {t(`projectMap.confidence.${node.confidence}`)}
              </span>
              {node.stale ? <span>{t("projectMap.status.stale")}</span> : null}
              {node.candidate ? <span>{t("projectMap.status.candidate")}</span> : null}
            </div>
          </div>

          <section>
            <h4>{t("projectMap.detail.coreDescription")}</h4>
            <p>{node.detail.coreDescription}</p>
          </section>
          <InspectorList
            title={t("projectMap.detail.keyFacts")}
            items={node.detail.keyFacts}
          />
          <InspectorList
            title={t("projectMap.detail.keyLogic")}
            items={node.detail.keyLogic}
          />
          <InspectorList
            title={t("projectMap.detail.riskSignals")}
            items={node.detail.riskSignals}
            emptyLabel={t("projectMap.none")}
          />
          <section>
            <h4>{t("projectMap.detail.relatedArtifacts")}</h4>
            <div className="project-map-artifact-list">
              {node.detail.relatedArtifacts.map((artifact) => (
                <span
                  key={`${artifact.type}-${artifact.label}-${artifact.path ?? artifact.ref ?? ""}`}
                  className="project-map-artifact-chip"
                  title={artifact.path ?? artifact.ref ?? artifact.label}
                >
                  <GitBranch aria-hidden />
                  {artifact.label}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h4>{t("projectMap.evidenceTitle")}</h4>
            <div className="project-map-source-list">
              {node.sources.map((source) => (
                <SourceChip
                  key={`${source.type}-${source.label}-${source.path ?? source.hash ?? ""}`}
                  source={source}
                />
              ))}
            </div>
          </section>
          <section>
            <h4>{t("projectMap.detail.generation")}</h4>
            <dl className="project-map-definition-grid">
              <div>
                <dt>{t("projectMap.detail.lastGeneratedAt")}</dt>
                <dd>{formatDateTime(node.lastGeneratedAt)}</dd>
              </div>
              <div>
                <dt>{t("projectMap.detail.generatedBy")}</dt>
                <dd>
                  {node.generatedBy.engine} / {node.generatedBy.model}
                </dd>
              </div>
              <div>
                <dt>{t("projectMap.runLogTitle")}</dt>
                <dd>
                  {t("projectMap.runLogSummary", {
                    runId: dataset.runs[0]?.id ?? "-",
                    stale: staleCount,
                  })}
                </dd>
              </div>
            </dl>
          </section>
          <div className="project-map-node-actions">
            {canDrill ? (
              <button type="button" onClick={onDrill}>
                {t("projectMap.drillIn")}
              </button>
            ) : null}
            <button type="button" onClick={onCompleteNode}>{t("projectMap.completeNode")}</button>
            <button type="button" onClick={onCalibrateNode}>{t("projectMap.calibrateNode")}</button>
            <button type="button" onClick={onRefreshEvidence}>{t("projectMap.refreshEvidence")}</button>
          </div>
        </>
      ) : (
        <p>{t("projectMap.emptyInspector")}</p>
      )}
      </>
      ) : null}
    </aside>
  );
}

function InspectorList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </section>
  );
}

function ProjectMapSettingsPanel({
  dataset,
  disabled,
  onUpdate,
}: {
  dataset: ProjectMapDataset;
  disabled: boolean;
  onUpdate: (updater: (dataset: ProjectMapDataset) => ProjectMapDataset) => Promise<void>;
}) {
  const { t } = useTranslation();
  const settings = dataset.autoIngestionSettings;

  return (
    <section className="project-map-settings" aria-label={t("projectMap.settings.title")}>
      <div>
        <strong>{t("projectMap.settings.title")}</strong>
        <span>{t("projectMap.settings.subtitle")}</span>
      </div>
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                enabled,
              },
            }));
          }}
        />
        {t("projectMap.settings.autoIngestion")}
      </label>
      <label>
        {t("projectMap.settings.threshold")}
        <input
          type="number"
          min={1}
          max={50}
          value={settings.newSessionThreshold}
          disabled={disabled}
          onChange={(event) => {
            const nextThreshold = Math.max(1, Math.min(50, Number(event.currentTarget.value) || 5));
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                newSessionThreshold: nextThreshold,
              },
            }));
          }}
        />
      </label>
      <label>
        {t("projectMap.settings.applyMode")}
        <select
          value={settings.applyMode}
          disabled={disabled}
          onChange={(event) => {
            const applyMode =
              event.currentTarget.value === "autoApplyEvidenceBacked"
                ? "autoApplyEvidenceBacked"
                : "createCandidate";
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                applyMode,
              },
            }));
          }}
        >
          <option value="createCandidate">{t("projectMap.settings.createCandidate")}</option>
          <option value="autoApplyEvidenceBacked">{t("projectMap.settings.autoApplyEvidenceBacked")}</option>
        </select>
      </label>
    </section>
  );
}

function GenerationConfirmationDialog({
  activeWorkspace,
  request,
  storageKey,
  onCancel,
  onConfirm,
}: {
  activeWorkspace: WorkspaceInfo | null;
  request: ProjectMapGenerationRequest | null;
  storageKey: string;
  onCancel: () => void;
  onConfirm: (requestOverride?: ProjectMapGenerationRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<EngineType>(() =>
    normalizeEngineType(request?.engine),
  );
  const [selectedModel, setSelectedModel] = useState(request?.model ?? "default");
  const [selectedStorageLocation, setSelectedStorageLocation] =
    useState<ProjectMapStorageLocation>(() => request?.storageLocation ?? "global");
  const generationOptions = useProjectMapGenerationOptions({
    workspace: activeWorkspace,
    selectedEngine,
  });

  useEffect(() => {
    if (!request) {
      return;
    }
    setSelectedEngine(normalizeEngineType(request.engine));
    setSelectedModel(request.model);
    setSelectedStorageLocation(request.storageLocation);
    setIsConfirming(false);
  }, [request]);

  useEffect(() => {
    if (!request || generationOptions.modelsLoading) {
      return;
    }
    if (generationOptions.models.length === 0) {
      setSelectedModel("");
      return;
    }
    const selectedModelStillExists = generationOptions.models.some(
      (model) => model.model === selectedModel || model.id === selectedModel,
    );
    if (selectedModelStillExists) {
      return;
    }
    const defaultModel =
      generationOptions.models.find((model) => model.isDefault) ?? generationOptions.models[0];
    setSelectedModel(defaultModel?.model ?? "");
  }, [generationOptions.models, generationOptions.modelsLoading, request, selectedModel]);

  if (!request) {
    return null;
  }

  const selectedModelOption =
    generationOptions.models.find((model) => model.model === selectedModel) ??
    generationOptions.models.find((model) => model.id === selectedModel) ??
    null;
  const resolvedWritePath = request
    ? resolveGenerationWritePath(
        activeWorkspace?.path ?? null,
        storageKey,
        selectedStorageLocation,
        request.writePath,
      )
    : "";
  const canConfirm =
    !isConfirming &&
    !generationOptions.modelsLoading &&
    generationOptions.models.length > 0 &&
    Boolean(selectedModelOption);
  const confirmedRequest: ProjectMapGenerationRequest = {
    ...request,
    engine: selectedEngine,
    model: selectedModelOption?.model ?? selectedModel.trim(),
    storageLocation: selectedStorageLocation,
    writePath: resolvedWritePath,
  };

  return (
    <div className="project-map-dialog-backdrop" role="presentation">
      <section
        className="project-map-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("projectMap.confirmation.title")}
      >
        <header>
          <h3>{t("projectMap.confirmation.title")}</h3>
          <p>{t("projectMap.confirmation.subtitle")}</p>
        </header>
        <dl className="project-map-definition-grid">
          <div>
            <dt>{t("projectMap.confirmation.engine")}</dt>
            <dd>
              <select
                className="project-map-dialog-control"
                value={selectedEngine}
                aria-label={t("projectMap.confirmation.engine")}
                onChange={(event) => setSelectedEngine(normalizeEngineType(event.currentTarget.value))}
              >
                {generationOptions.engines.map((engine) => (
                  <option key={engine.id} value={engine.id} disabled={!engine.installed}>
                    {engine.label}
                  </option>
                ))}
              </select>
              {generationOptions.enginesLoading ? (
                <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingEngines")}</span>
              ) : null}
              {generationOptions.enginesError ? (
                <span className="project-map-dialog-warning">{generationOptions.enginesError}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t("projectMap.confirmation.model")}</dt>
            <dd>
              <select
                className="project-map-dialog-control"
                value={selectedModel}
                aria-label={t("projectMap.confirmation.model")}
                onChange={(event) => setSelectedModel(event.currentTarget.value)}
                disabled={generationOptions.modelsLoading || generationOptions.models.length === 0}
              >
                {generationOptions.models.map((model) => (
                  <option key={`${model.id}-${model.model}`} value={model.model}>
                    {model.displayName}
                  </option>
                ))}
              </select>
              <button
                className="project-map-dialog-refresh"
                type="button"
                onClick={() => void generationOptions.refreshModels()}
                disabled={generationOptions.modelsLoading}
              >
                <RefreshCcw aria-hidden />
                {t("projectMap.confirmation.refreshModels")}
              </button>
              {generationOptions.modelsLoading ? (
                <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingModels")}</span>
              ) : null}
              {!generationOptions.modelsLoading && generationOptions.models.length === 0 ? (
                <span className="project-map-dialog-warning">
                  {generationOptions.modelsError ?? t("projectMap.confirmation.noModels")}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t("projectMap.confirmation.scope")}</dt>
            <dd>{request.scope.kind}</dd>
          </div>
          <div>
            <dt>{t("projectMap.confirmation.storageLocation")}</dt>
            <dd>
              <label>
                <input
                  type="radio"
                  name="projectMapStorageLocation"
                  value="global"
                  checked={selectedStorageLocation === "global"}
                  onChange={() => setSelectedStorageLocation("global")}
                />
                {t("projectMap.confirmation.storageLocationGlobal")}
              </label>
              <label>
                <input
                  type="radio"
                  name="projectMapStorageLocation"
                  value="project"
                  checked={selectedStorageLocation === "project"}
                  onChange={() => setSelectedStorageLocation("project")}
                />
                {t("projectMap.confirmation.storageLocationProject")}
              </label>
            </dd>
          </div>
          <div>
            <dt>{t("projectMap.confirmation.writePath")}</dt>
            <dd>{resolvedWritePath}</dd>
          </div>
        </dl>
        <section>
          <h4>{t("projectMap.confirmation.readSources")}</h4>
          <div className="project-map-source-list">
            {request.readSources.slice(0, 8).map((source) => (
              <SourceChip
                key={`${source.type}-${source.label}-${source.path ?? source.hash ?? ""}`}
                source={source}
              />
            ))}
          </div>
        </section>
        <footer>
          <button type="button" onClick={onCancel} disabled={isConfirming}>
            {t("projectMap.confirmation.cancel")}
          </button>
          <button
            className="project-map-primary-button"
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              setIsConfirming(true);
              void onConfirm(confirmedRequest).finally(() => setIsConfirming(false));
            }}
          >
            <Sparkles aria-hidden />
            {isConfirming ? t("projectMap.confirmation.confirming") : t("projectMap.confirmation.confirm")}
          </button>
        </footer>
      </section>
    </div>
  );
}
