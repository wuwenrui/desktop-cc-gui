import type { ProjectMapFileRelation, ProjectMapScannedFile } from "../types";

export const PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH = 1320;
export const PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT = 760;
export const PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_WIDTH = 172;
export const PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X = PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_WIDTH / 2;
export const PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y = 42;

const PROJECT_MAP_RELATIONSHIP_GRAPH_SIDE_LIMIT = 6;
const PROJECT_MAP_RELATIONSHIP_GRAPH_EXPANDED_SIDE_LIMIT = 8;
const PROJECT_MAP_RELATIONSHIP_GRAPH_SECONDARY_LIMIT = 4;

type ProjectMapRelationshipLayoutPreset = "radial" | "tree" | "force";

type ProjectMapRelationshipFileDirectionCount = {
  incoming: number;
  outgoing: number;
};

type ProjectMapRelationshipGraphSide = "incoming" | "outgoing" | null;

export type ProjectMapRelationshipGraphProjectionNode = {
  file: ProjectMapScannedFile;
  x: number;
  y: number;
  incoming: number;
  outgoing: number;
  total: number;
  isSelected: boolean;
  isNeighbor: boolean;
};

export type ProjectMapRelationshipGraphProjectionEdge = {
  relation: ProjectMapFileRelation;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  labelX: number;
  labelY: number;
  isSelected: boolean;
};

export type ProjectMapRelationshipGraphAggregateNode = {
  id: string;
  kind: "incoming" | "outgoing";
  count: number;
  isExpanded: boolean;
  x: number;
  y: number;
};

export type ProjectMapRelationshipGraphAggregateEdge = {
  id: string;
  kind: "incoming" | "outgoing";
  count: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

export type ProjectMapRelationshipGraphProjection = {
  nodes: ProjectMapRelationshipGraphProjectionNode[];
  edges: ProjectMapRelationshipGraphProjectionEdge[];
  aggregateNodes: ProjectMapRelationshipGraphAggregateNode[];
  aggregateEdges: ProjectMapRelationshipGraphAggregateEdge[];
};

export function buildProjectMapRelationshipGraphProjection(input: {
  selectedRelationshipFile: ProjectMapScannedFile;
  selectedRelationshipRelations: ProjectMapFileRelation[];
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, ProjectMapRelationshipFileDirectionCount>;
  relationshipDashboardRelationCountByFile: ReadonlyMap<string, number>;
  relationshipDashboardLayoutPreset: ProjectMapRelationshipLayoutPreset;
  relationshipGraphExpandedSide: ProjectMapRelationshipGraphSide;
  selectedRelationshipRelationId: string | null;
}): ProjectMapRelationshipGraphProjection {
  const selectedFileId = input.selectedRelationshipFile.id;
  const graphRelations = input.selectedRelationshipRelations.slice(0, 48);
  const allIncomingIds: string[] = [];
  const allOutgoingIds: string[] = [];
  const seenIncoming = new Set<string>();
  const seenOutgoing = new Set<string>();
  graphRelations.forEach((relation) => {
    if (relation.targetFileId === selectedFileId && !seenIncoming.has(relation.sourceFileId)) {
      seenIncoming.add(relation.sourceFileId);
      allIncomingIds.push(relation.sourceFileId);
    }
    if (relation.sourceFileId === selectedFileId && !seenOutgoing.has(relation.targetFileId)) {
      seenOutgoing.add(relation.targetFileId);
      allOutgoingIds.push(relation.targetFileId);
    }
  });

  const incomingLimit = input.relationshipGraphExpandedSide === "incoming"
    ? PROJECT_MAP_RELATIONSHIP_GRAPH_EXPANDED_SIDE_LIMIT
    : PROJECT_MAP_RELATIONSHIP_GRAPH_SIDE_LIMIT;
  const outgoingLimit = input.relationshipGraphExpandedSide === "outgoing"
    ? PROJECT_MAP_RELATIONSHIP_GRAPH_EXPANDED_SIDE_LIMIT
    : PROJECT_MAP_RELATIONSHIP_GRAPH_SIDE_LIMIT;
  const incomingIds = allIncomingIds.slice(0, incomingLimit);
  const outgoingIds = allOutgoingIds.slice(0, outgoingLimit);
  const hiddenIncomingCount = Math.max(0, allIncomingIds.length - incomingIds.length);
  const hiddenOutgoingCount = Math.max(0, allOutgoingIds.length - outgoingIds.length);
  const allNeighborIds = new Set<string>([...allIncomingIds, ...allOutgoingIds]);
  const visibleNeighborIds = new Set<string>([...incomingIds, ...outgoingIds]);
  const nodeIds = new Set<string>([selectedFileId, ...visibleNeighborIds]);
  const secondaryIds: string[] = [];
  for (const file of input.relationshipDashboardFilteredFiles) {
    if (secondaryIds.length >= PROJECT_MAP_RELATIONSHIP_GRAPH_SECONDARY_LIMIT) {
      break;
    }
    if (nodeIds.has(file.id) || allNeighborIds.has(file.id)) {
      continue;
    }
    nodeIds.add(file.id);
    secondaryIds.push(file.id);
  }

  const yFor = (index: number, total: number, hasAggregate: boolean) => {
    const topPadding = 92;
    const bottomPadding = hasAggregate ? 200 : 126;
    const laneBottom = PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT - bottomPadding;
    if (total <= 1) {
      return Math.round((topPadding + laneBottom) / 2);
    }
    return Math.round(topPadding + index * ((laneBottom - topPadding) / Math.max(total - 1, 1)));
  };
  const positions = new Map<string, { x: number; y: number }>();
  const incomingX = 128;
  const selectedX = Math.round(PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH / 2 - PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X);
  const outgoingX = PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH - incomingX - PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_WIDTH;
  const selectedY = Math.round(PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT / 2 - PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y);
  positions.set(selectedFileId, { x: selectedX, y: selectedY });

  if (input.relationshipDashboardLayoutPreset === "radial") {
    const radialIds = [...incomingIds, ...outgoingIds, ...secondaryIds];
    const centerX = selectedX + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X;
    const centerY = selectedY + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y;
    const radiusX = 430;
    const radiusY = 245;
    radialIds.forEach((nodeId, index) => {
      const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / Math.max(radialIds.length, 1);
      positions.set(nodeId, {
        x: Math.round(centerX + Math.cos(angle) * radiusX - PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X),
        y: Math.round(centerY + Math.sin(angle) * radiusY - PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y),
      });
    });
  } else if (input.relationshipDashboardLayoutPreset === "force") {
    const forceIds = [...incomingIds, ...outgoingIds, ...secondaryIds];
    forceIds.forEach((nodeId, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      positions.set(nodeId, {
        x: 150 + column * 250 + (row % 2) * 56,
        y: 92 + row * 132,
      });
    });
  } else {
    incomingIds.forEach((nodeId, index) => {
      positions.set(nodeId, { x: incomingX, y: yFor(index, incomingIds.length, hiddenIncomingCount > 0) });
    });
    outgoingIds.forEach((nodeId, index) => {
      positions.set(nodeId, { x: outgoingX, y: yFor(index, outgoingIds.length, hiddenOutgoingCount > 0) });
    });
    secondaryIds.forEach((nodeId, index) => {
      const topRow = index % 2 === 0;
      positions.set(nodeId, {
        x: 360 + (index % 3) * 210,
        y: topRow ? 58 : PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT - 150,
      });
    });
  }

  const nodes = Array.from(nodeIds)
    .flatMap((nodeId) => {
      const file = input.relationshipDashboardFileIndex.get(nodeId);
      const position = positions.get(nodeId);
      if (!file || !position) {
        return [];
      }
      const directionCount =
        input.relationshipDashboardDirectionCountByFile.get(file.id)
        ?? { incoming: 0, outgoing: 0 };
      return [{
        file,
        x: position.x,
        y: position.y,
        incoming: directionCount.incoming,
        outgoing: directionCount.outgoing,
        total: input.relationshipDashboardRelationCountByFile.get(file.id) ?? 0,
        isSelected: file.id === selectedFileId,
        isNeighbor: file.id !== selectedFileId
          && (seenIncoming.has(file.id) || seenOutgoing.has(file.id)),
      }];
    });

  const selectedNode = nodes.find((node) => node.file.id === selectedFileId);
  const aggregateNodes = [
    ...(hiddenIncomingCount > 0 ? [{
      id: "aggregate-incoming",
      kind: "incoming" as const,
      count: hiddenIncomingCount,
      isExpanded: input.relationshipGraphExpandedSide === "incoming",
      x: incomingX,
      y: PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT - 104,
    }] : []),
    ...(hiddenOutgoingCount > 0 ? [{
      id: "aggregate-outgoing",
      kind: "outgoing" as const,
      count: hiddenOutgoingCount,
      isExpanded: input.relationshipGraphExpandedSide === "outgoing",
      x: outgoingX,
      y: PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT - 104,
    }] : []),
  ];

  const positionById = new Map(nodes.map((node) => [node.file.id, node]));
  const edges = graphRelations
    .filter((relation) => positionById.has(relation.sourceFileId) && positionById.has(relation.targetFileId))
    .slice(0, 64)
    .map((relation) => {
      const source = positionById.get(relation.sourceFileId)!;
      const target = positionById.get(relation.targetFileId)!;
      return {
        relation,
        sourceX: source.x + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X,
        sourceY: source.y + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y,
        targetX: target.x + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X,
        targetY: target.y + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y,
        labelX: (source.x + target.x) / 2 + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X,
        labelY: (source.y + target.y) / 2 + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y,
        isSelected: input.selectedRelationshipRelationId === relation.id,
      };
    });
  const aggregateEdges = selectedNode ? aggregateNodes.map((node) => ({
    id: `${node.id}:edge`,
    kind: node.kind,
    count: node.count,
    sourceX: node.kind === "incoming"
      ? node.x + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X
      : selectedNode.x + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X,
    sourceY: node.kind === "incoming"
      ? node.y + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y
      : selectedNode.y + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y,
    targetX: node.kind === "incoming"
      ? selectedNode.x + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X
      : node.x + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_X,
    targetY: node.kind === "incoming"
      ? selectedNode.y + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y
      : node.y + PROJECT_MAP_RELATIONSHIP_GRAPH_NODE_CENTER_Y,
  })) : [];

  return { nodes, edges, aggregateNodes, aggregateEdges };
}
