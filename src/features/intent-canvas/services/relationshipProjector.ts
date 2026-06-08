import type {
  CanvasSemanticEdge,
  CanvasSemanticGraph,
  CanvasSemanticNode,
  CanvasSourceAnchor,
} from "../types";
import {
  createProjectMapRelationshipEdgeSnapshot,
  getProjectMapRelationshipEdgeDisplayLabel,
  type ProjectMapRelationshipEdgeSnapshot,
  type ProjectMapRelationshipNeighborhood,
  type ProjectMapRelationshipNodeSnapshot,
} from "./relationshipImportQueries";
import type {
  ProjectMapFileRelation,
  ProjectMapScannedFile,
} from "../../project-map/types";

type Direction = "callers" | "callees" | "both" | "neighborhood";
type ProjectMapRelationshipFileLike = Pick<
  ProjectMapScannedFile,
  "id" | "path" | "basename" | "role" | "layer" | "parseStatus"
>;

function createGraphId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEdgeDirection(
  edge: ProjectMapRelationshipEdgeSnapshot,
  perspectiveNodeId: string,
): CanvasSemanticEdge["direction"] {
  if (edge.relation.targetFileId === perspectiveNodeId && edge.relation.sourceFileId !== perspectiveNodeId) {
    return "in";
  }
  if (edge.relation.sourceFileId === perspectiveNodeId && edge.relation.targetFileId !== perspectiveNodeId) {
    return "out";
  }
  return "undirected";
}

function buildNodeAnchor(input: {
  workspaceId: string;
  scanRunId: string;
  fileId: string;
  filePath: string;
  nodeKind: string;
}): CanvasSourceAnchor {
  return {
    kind: "relationship-node",
    workspaceId: input.workspaceId,
    scanRunId: input.scanRunId,
    nodeId: input.fileId,
    nodeKind: input.nodeKind,
    filePath: input.filePath,
  };
}

function buildEdgeAnchor(input: {
  workspaceId: string;
  scanRunId: string;
  edge: ProjectMapRelationshipEdgeSnapshot;
}): CanvasSourceAnchor {
  return {
    kind: "relationship-edge",
    workspaceId: input.workspaceId,
    scanRunId: input.scanRunId,
    edgeId: input.edge.relation.id,
    relationKind: input.edge.relation.type,
    sourceNodeId: input.edge.relation.sourceFileId,
    targetNodeId: input.edge.relation.targetFileId,
    evidenceIds: input.edge.evidenceIds,
  };
}

function normalizeFilePath(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\\/g, "/") : "";
}

function createPlaceholderFile(fileId: string): ProjectMapRelationshipFileLike {
  return {
    id: fileId,
    path: fileId,
    basename: fileId,
    role: "unknown",
    layer: "unknown",
    parseStatus: "skipped",
  };
}

function createNodeSnapshot(file: ProjectMapRelationshipFileLike, depth: number): ProjectMapRelationshipNodeSnapshot {
  return {
    id: file.id,
    path: normalizeFilePath(file.path),
    basename: file.basename || file.id,
    depth,
    reachable: true,
    role: file.role,
    layer: file.layer,
    parseStatus: file.parseStatus,
  };
}

export function projectRelationshipFileRelationsToCanvasSemanticGraph(input: {
  workspaceId: string;
  centerFile: ProjectMapRelationshipFileLike;
  relations: ProjectMapFileRelation[];
  filesById: ReadonlyMap<string, ProjectMapScannedFile>;
  scan?: { scanRunId: string; generatedAt: string };
  maxNodes?: number;
  maxEdges?: number;
}): CanvasSemanticGraph {
  const maxNodes = Math.max(1, Math.floor(input.maxNodes ?? 40));
  const maxEdges = Math.max(0, Math.floor(input.maxEdges ?? 80));
  const nodesById = new Map<string, ProjectMapRelationshipNodeSnapshot>([
    [input.centerFile.id, createNodeSnapshot(input.centerFile, 0)],
  ]);
  const selectedEdges: ProjectMapRelationshipEdgeSnapshot[] = [];
  const omittedNodeIds = new Set<string>();
  let omittedEdgeCount = 0;
  const uniqueRelations = new Map<string, ProjectMapFileRelation>();

  input.relations.forEach((relation) => {
    if (relation.id && !uniqueRelations.has(relation.id)) {
      uniqueRelations.set(relation.id, relation);
    }
  });

  const includeEndpoint = (fileId: string) => {
    if (!fileId || nodesById.has(fileId)) {
      return true;
    }
    if (nodesById.size >= maxNodes) {
      omittedNodeIds.add(fileId);
      return false;
    }
    const file = input.filesById.get(fileId) ?? createPlaceholderFile(fileId);
    const depth = fileId === input.centerFile.id ? 0 : 1;
    nodesById.set(fileId, createNodeSnapshot(file, depth));
    return true;
  };

  Array.from(uniqueRelations.values()).forEach((relation) => {
    if (!relation.sourceFileId || !relation.targetFileId) {
      return;
    }
    if (selectedEdges.length >= maxEdges) {
      omittedEdgeCount += 1;
      omittedNodeIds.add(relation.sourceFileId);
      omittedNodeIds.add(relation.targetFileId);
      return;
    }
    const hasSource = includeEndpoint(relation.sourceFileId);
    const hasTarget = includeEndpoint(relation.targetFileId);
    if (!hasSource || !hasTarget) {
      omittedEdgeCount += 1;
      return;
    }
    selectedEdges.push(createProjectMapRelationshipEdgeSnapshot(relation));
  });

  return projectRelationshipNeighborhoodToCanvasSemanticGraph({
    workspaceId: input.workspaceId,
    neighborhood: {
      scan: input.scan ?? {
        scanRunId: "relationship-dashboard-current",
        generatedAt: new Date().toISOString(),
      },
      centerFileId: input.centerFile.id,
      nodes: Array.from(nodesById.values()),
      edges: selectedEdges,
      omittedNodeCount: omittedNodeIds.size,
      omittedEdgeCount,
    },
    direction: "neighborhood",
  });
}

export function projectRelationshipNeighborhoodToCanvasSemanticGraph(input: {
  workspaceId: string;
  neighborhood: ProjectMapRelationshipNeighborhood;
  direction?: Direction;
}): CanvasSemanticGraph {
  const graphId = createGraphId("project-map-relations");
  const scanRunId = input.neighborhood.scan.scanRunId;
  const importDirection = input.direction ?? "neighborhood";
  const maxDepth = input.neighborhood.nodes.reduce((currentMax, node) => {
    return Math.max(currentMax, node.depth);
  }, 0);

  const nodes: CanvasSemanticNode[] = input.neighborhood.nodes.map((node) => ({
    id: node.id,
    label: node.basename || node.path,
    kind: "file" as const,
    sourceAnchor: buildNodeAnchor({
      workspaceId: input.workspaceId,
      scanRunId,
      fileId: node.id,
      filePath: node.path,
      nodeKind: node.role ?? "unknown",
    }),
    evidenceIds: [],
    summary: `depth:${node.depth}; role:${node.role ?? "unknown"}`,
    stale: false,
    unresolved: false,
  }));
  if (input.neighborhood.omittedEdgeCount > 0 || input.neighborhood.omittedNodeCount > 0) {
    nodes.push({
      id: `${input.neighborhood.centerFileId}:omitted-relations`,
      label: `+${input.neighborhood.omittedEdgeCount} omitted relations`,
      kind: "group" as const,
      evidenceIds: [],
      summary: `${input.neighborhood.omittedNodeCount} omitted nodes; ${input.neighborhood.omittedEdgeCount} omitted edges`,
      stale: false,
      unresolved: false,
    });
  }

  const edges: CanvasSemanticEdge[] = input.neighborhood.edges
    .map((edge) => ({
      id: edge.relation.id,
      sourceNodeId: edge.relation.sourceFileId,
      targetNodeId: edge.relation.targetFileId,
      relationKind: edge.relation.type,
      direction: getEdgeDirection(edge, input.neighborhood.centerFileId),
      sourceAnchor: buildEdgeAnchor({
        workspaceId: input.workspaceId,
        scanRunId,
        edge,
      }),
      label: getProjectMapRelationshipEdgeDisplayLabel(edge),
      evidenceIds: edge.evidenceIds,
      evidenceRefs: edge.evidenceRefs,
      evidenceSummary: edge.evidenceSummary,
      stale: edge.relation.stale ?? false,
    }))
    .filter((edge) => {
      if (!edge.sourceNodeId || !edge.targetNodeId) {
        return false;
      }
      if (importDirection === "callers") {
        return edge.direction === "in";
      }
      if (importDirection === "callees") {
        return edge.direction === "out";
      }
      if (importDirection === "both") {
        return edge.direction !== undefined;
      }
      return true;
    });
  if (input.neighborhood.omittedEdgeCount > 0) {
    edges.push({
      id: `${input.neighborhood.centerFileId}:omitted-relations-edge`,
      sourceNodeId: input.neighborhood.centerFileId,
      targetNodeId: `${input.neighborhood.centerFileId}:omitted-relations`,
      relationKind: "omitted",
      direction: "out",
      label: `${input.neighborhood.omittedEdgeCount} more relations omitted`,
      evidenceIds: [],
    });
  }

  return {
    graphId,
    createdAt: new Date().toISOString(),
    sourceSnapshot: {
      kind: "project-map-relations",
      scanRunId,
      snapshotVersion: null,
    },
    nodes,
    edges,
    importOptions: {
      direction: importDirection,
      depth: maxDepth,
      centerNodeId: input.neighborhood.centerFileId,
      maxNodes: input.neighborhood.nodes.length > 0 ? input.neighborhood.nodes.length : 0,
      maxEdges: edges.length,
      omittedNodes: input.neighborhood.omittedNodeCount,
      omittedEdges: input.neighborhood.omittedEdgeCount,
    },
  };
}

export function projectRelationshipEdgeToCanvasSemanticGraph(input: {
  workspaceId: string;
  edgeContext: {
    scan: { scanRunId: string; generatedAt: string };
    relation: ProjectMapRelationshipEdgeSnapshot["relation"];
    sourceRole?: string;
    targetRole?: string;
    sourceNode?: { id: string; path: string; basename: string };
    targetNode?: { id: string; path: string; basename: string };
    evidenceIds: string[];
    evidenceSummary: string[];
  };
}): CanvasSemanticGraph {
  const scanRunId = input.edgeContext.scan.scanRunId;
  const sourceFileId = input.edgeContext.relation.sourceFileId;
  const targetFileId = input.edgeContext.relation.targetFileId;
  const sourceFileLabel = input.edgeContext.sourceNode?.basename ?? sourceFileId;
  const targetFileLabel = input.edgeContext.targetNode?.basename ?? targetFileId;
  const edgeSnapshot = createProjectMapRelationshipEdgeSnapshot(input.edgeContext.relation);

  const sourceAnchor = buildNodeAnchor({
    workspaceId: input.workspaceId,
    scanRunId,
    fileId: sourceFileId,
    filePath: input.edgeContext.sourceNode?.path ?? "",
    nodeKind: input.edgeContext.sourceRole ?? "unknown",
  });
  const targetAnchor = buildNodeAnchor({
    workspaceId: input.workspaceId,
    scanRunId,
    fileId: targetFileId,
    filePath: input.edgeContext.targetNode?.path ?? "",
    nodeKind: input.edgeContext.targetRole ?? "unknown",
  });

  return {
    graphId: createGraphId("project-map-relation"),
    createdAt: new Date().toISOString(),
    sourceSnapshot: {
      kind: "project-map-relations",
      scanRunId,
      snapshotVersion: null,
    },
    nodes: [
      {
        id: sourceFileId,
        label: sourceFileLabel,
        kind: "file",
        sourceAnchor,
        evidenceIds: [],
        summary: `role:${input.edgeContext.sourceRole ?? "unknown"}`,
      },
      {
        id: targetFileId,
        label: targetFileLabel,
        kind: "file",
        sourceAnchor: targetAnchor,
        evidenceIds: [],
        summary: `role:${input.edgeContext.targetRole ?? "unknown"}`,
      },
    ],
    edges: [
      {
        id: input.edgeContext.relation.id,
        sourceNodeId: sourceFileId,
        targetNodeId: targetFileId,
        relationKind: input.edgeContext.relation.type,
        direction: "out",
        sourceAnchor: buildEdgeAnchor({
          workspaceId: input.workspaceId,
          scanRunId,
          edge: edgeSnapshot,
        }),
        label: getProjectMapRelationshipEdgeDisplayLabel(edgeSnapshot),
        evidenceIds: edgeSnapshot.evidenceIds,
        evidenceRefs: edgeSnapshot.evidenceRefs,
        evidenceSummary: edgeSnapshot.evidenceSummary,
        stale: input.edgeContext.relation.stale ?? false,
      },
    ],
    importOptions: {
      direction: "neighborhood",
      depth: 1,
      centerNodeId: sourceFileId,
      maxNodes: 2,
      maxEdges: 1,
      omittedNodes: 0,
      omittedEdges: 0,
    },
  };
}
