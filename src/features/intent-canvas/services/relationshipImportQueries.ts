import type {
  ProjectMapFileRelation,
  ProjectMapRelationshipReadResponse,
  ProjectMapScannedFile,
  ProjectMapStorageLocation,
} from "../../project-map/types";
import type { CanvasEvidenceRef } from "../types";
import { readProjectMapRelationships } from "../../project-map/services/projectMapPersistence";
import {
  getProjectMapRelationshipCallCandidate,
  normalizeProjectMapRelationshipDashboardData,
  normalizeProjectMapRelationshipReadSummary,
} from "../../project-map/utils/relationshipDashboardModel";

export type ProjectMapRelationshipImportDirection =
  | "callers"
  | "callees"
  | "both"
  | "neighborhood";

export type ProjectMapRelationshipSnapshotMetadata = {
  scanRunId: string;
  generatedAt: string;
};

export type ProjectMapRelationshipNodeSnapshot = {
  id: string;
  path: string;
  basename: string;
  depth: number;
  reachable: boolean;
  role?: ProjectMapScannedFile["role"];
  layer?: ProjectMapScannedFile["layer"];
  parseStatus?: ProjectMapScannedFile["parseStatus"];
};

export type ProjectMapRelationshipEdgeSnapshot = {
  relation: ProjectMapFileRelation;
  evidenceIds: string[];
  evidenceRefs: CanvasEvidenceRef[];
  evidenceSummary: string[];
};

export type ProjectMapRelationshipImportSourceState = {
  exists: boolean;
  scan: ProjectMapRelationshipSnapshotMetadata | null;
  fileNodeIds: Set<string>;
  relationEdgeIds: Set<string>;
};

export type ProjectMapRelationshipNeighborhood = {
  scan: ProjectMapRelationshipSnapshotMetadata;
  centerFileId: string;
  nodes: ProjectMapRelationshipNodeSnapshot[];
  edges: ProjectMapRelationshipEdgeSnapshot[];
  omittedNodeCount: number;
  omittedEdgeCount: number;
};

export type ProjectMapRelationshipEdgeContext = ProjectMapRelationshipEdgeSnapshot & {
  scan: ProjectMapRelationshipSnapshotMetadata;
  sourceNode?: ProjectMapScannedFile;
  targetNode?: ProjectMapScannedFile;
  contextPack: {
    sourceFileId: string;
    targetFileId: string;
    sourceRole?: ProjectMapScannedFile["role"];
    targetRole?: ProjectMapScannedFile["role"];
  };
};

function normalizePathValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\\/g, "/") : "";
}

function makeEvidenceId(input: { relationId: string; path: string; line?: number | null; index: number }): string {
  const normalizedPath = normalizePathValue(input.path);
  const line = input.line && input.line > 0 ? `:${input.line}` : "";
  return `${input.relationId}:evidence:${input.index}:${normalizedPath}${line}`;
}

function createEvidenceRef(input: {
  relationId: string;
  path: string;
  line?: number | null;
  excerpt?: string | null;
  index: number;
}): CanvasEvidenceRef {
  const normalizedPath = normalizePathValue(input.path);
  const safeLine = input.line && input.line > 0 ? input.line : null;
  return {
    id: makeEvidenceId({
      relationId: input.relationId,
      path: input.path,
      line: input.line,
      index: input.index,
    }),
    path: normalizedPath || null,
    line: safeLine,
    excerpt: input.excerpt ?? null,
    label: `${normalizedPath}${safeLine ? `:${safeLine}` : ""}`,
  };
}

function asNormalizedEvidenceSummary(relationId: string, entry: {
  path: string;
  line?: number | null;
  excerpt?: string;
}): string {
  const path = normalizePathValue(entry.path);
  const line = entry.line && entry.line > 0 ? `:${entry.line}` : "";
  return `${relationId}:${path}${line}${entry.excerpt ? ` ${entry.excerpt}` : ""}`;
}

async function loadProjectMapRelationshipData(input: {
  workspaceId: string;
  storageLocation?: ProjectMapStorageLocation;
}): Promise<ProjectMapRelationshipReadResponse> {
  return readProjectMapRelationships({
    workspaceId: input.workspaceId,
    storageLocation: input.storageLocation,
  });
}

function buildSnapshotMetadata(response: ProjectMapRelationshipReadResponse): ProjectMapRelationshipSnapshotMetadata {
  const summary = normalizeProjectMapRelationshipReadSummary(response);
  if (!summary) {
    throw new Error("Relationship scan metadata is unavailable.");
  }
  return {
    scanRunId: summary.scanRunId,
    generatedAt: summary.generatedAt,
  };
}

export function createProjectMapRelationshipEdgeSnapshot(relation: ProjectMapFileRelation): ProjectMapRelationshipEdgeSnapshot {
  const evidence = relation.evidence ?? [];
  const evidenceIds = evidence.map((entry, index) => makeEvidenceId({
    relationId: relation.id,
    path: entry.path,
    line: entry.line,
    index,
  }));
  const evidenceRefs = evidence.map((entry, index) => createEvidenceRef({
    relationId: relation.id,
    path: entry.path,
    line: entry.line,
    excerpt: entry.excerpt,
    index,
  }));
  const evidenceSummary = evidence.map((entry) =>
    asNormalizedEvidenceSummary(relation.id, {
      path: entry.path,
      line: entry.line,
      excerpt: entry.excerpt,
    }),
  );
  return { relation, evidenceIds, evidenceRefs, evidenceSummary };
}

export function getProjectMapRelationshipEdgeDisplayLabel(edge: ProjectMapRelationshipEdgeSnapshot): string {
  return getProjectMapRelationshipCallCandidate(edge.relation)
    ?? edge.evidenceSummary.find((summary) => summary.trim().length > 0)
    ?? edge.relation.type;
}

export function isProjectMapRelationshipScanFresh(input: {
  importedScanRunId: string;
  latestScanRunId?: string | null;
}): boolean {
  return Boolean(input.latestScanRunId) && input.importedScanRunId === input.latestScanRunId;
}

export async function loadProjectMapRelationshipSnapshot(input: {
  workspaceId: string;
  storageLocation?: ProjectMapStorageLocation;
}): Promise<ProjectMapRelationshipSnapshotMetadata> {
  const response = await loadProjectMapRelationshipData(input);
  return buildSnapshotMetadata(response);
}

export async function loadProjectMapRelationshipImportSourceState(input: {
  workspaceId: string;
  storageLocation?: ProjectMapStorageLocation;
}): Promise<ProjectMapRelationshipImportSourceState> {
  const response = await loadProjectMapRelationshipData(input);
  const summary = normalizeProjectMapRelationshipReadSummary(response);
  if (!summary) {
    return {
      exists: false,
      scan: null,
      fileNodeIds: new Set<string>(),
      relationEdgeIds: new Set<string>(),
    };
  }
  const dashboardData = normalizeProjectMapRelationshipDashboardData(response);
  return {
    exists: true,
    scan: {
      scanRunId: summary.scanRunId,
      generatedAt: summary.generatedAt,
    },
    fileNodeIds: new Set(dashboardData.files.map((file) => file.id)),
    relationEdgeIds: new Set(dashboardData.relations.map((relation) => relation.id)),
  };
}

export async function queryProjectMapRelationshipNeighborhood(input: {
  workspaceId: string;
  centerFileId: string;
  storageLocation?: ProjectMapStorageLocation;
  direction?: ProjectMapRelationshipImportDirection;
  depth?: number;
  maxNodes?: number;
  maxEdges?: number;
}): Promise<ProjectMapRelationshipNeighborhood> {
  const response = await loadProjectMapRelationshipData(input);
  const scan = buildSnapshotMetadata(response);
  const dashboardData = normalizeProjectMapRelationshipDashboardData(response);
  const relations = dashboardData.relations;
  const filesById = new Map(dashboardData.files.map((file) => [file.id, file]));
  const centerFile = filesById.get(input.centerFileId);
  if (!centerFile) {
    throw new Error(`Relationship center file not found: ${input.centerFileId}`);
  }

  const maxDepth = Math.max(1, Math.floor(input.depth ?? 1));
  const maxNodes = input.maxNodes === undefined ? Number.POSITIVE_INFINITY : Math.max(1, Math.floor(input.maxNodes));
  const maxEdges = input.maxEdges === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(input.maxEdges));

  const outgoingBySource = new Map<string, ProjectMapFileRelation[]>();
  const incomingByTarget = new Map<string, ProjectMapFileRelation[]>();
  for (const relation of relations) {
    if (!relation.sourceFileId || !relation.targetFileId) {
      continue;
    }
    if (!outgoingBySource.has(relation.sourceFileId)) {
      outgoingBySource.set(relation.sourceFileId, []);
    }
    if (!incomingByTarget.has(relation.targetFileId)) {
      incomingByTarget.set(relation.targetFileId, []);
    }
    outgoingBySource.get(relation.sourceFileId)?.push(relation);
    incomingByTarget.get(relation.targetFileId)?.push(relation);
  }

  const direction = input.direction ?? "neighborhood";
  const includeOutgoing =
    direction === "callees" || direction === "both" || direction === "neighborhood";
  const includeIncoming = direction === "callers" || direction === "both" || direction === "neighborhood";

  const seenNodes = new Map<string, number>([[input.centerFileId, 0]]);
  const selectedNodeIds = new Set<string>([input.centerFileId]);
  const selectedEdgeIds = new Set<string>();
  const omittedNodeIds = new Set<string>();
  let omittedEdgeCount = 0;
  const queue: Array<{ fileId: string; depth: number }> = [{ fileId: input.centerFileId, depth: 0 }];
  const selectRelation = (relation: ProjectMapFileRelation, nextFileId: string, nextDepth: number) => {
    if (selectedEdgeIds.has(relation.id)) {
      return;
    }
    if (selectedEdgeIds.size >= maxEdges) {
      omittedEdgeCount += 1;
      omittedNodeIds.add(nextFileId);
      return;
    }
    if (!selectedNodeIds.has(nextFileId) && selectedNodeIds.size >= maxNodes) {
      omittedEdgeCount += 1;
      omittedNodeIds.add(nextFileId);
      return;
    }
    selectedEdgeIds.add(relation.id);
    selectedNodeIds.add(nextFileId);
    const previousDepth = seenNodes.get(nextFileId);
    if (previousDepth === undefined || previousDepth > nextDepth) {
      seenNodes.set(nextFileId, nextDepth);
      queue.push({ fileId: nextFileId, depth: nextDepth });
    }
  };

  while (queue.length > 0 && selectedEdgeIds.size < maxEdges) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) {
      continue;
    }
    const nextDepth = current.depth + 1;
    if (includeOutgoing) {
      for (const relation of outgoingBySource.get(current.fileId) ?? []) {
        selectRelation(relation, relation.targetFileId, nextDepth);
      }
    }
    if (includeIncoming) {
      for (const relation of incomingByTarget.get(current.fileId) ?? []) {
        selectRelation(relation, relation.sourceFileId, nextDepth);
      }
    }
  }

  const nodes = Array.from(selectedNodeIds).flatMap((fileId) => {
    const file = filesById.get(fileId);
    if (!file) {
      return [];
    }
    return [{
      id: file.id,
      path: normalizePathValue(file.path),
      basename: file.basename,
      depth: seenNodes.get(file.id) ?? 0,
      reachable: true,
      role: file.role,
      layer: file.layer,
      parseStatus: file.parseStatus,
    }];
  });

  const edges = Array.from(selectedEdgeIds).flatMap((edgeId) => {
    const relation = relations.find((item) => item.id === edgeId);
    return relation ? [createProjectMapRelationshipEdgeSnapshot(relation)] : [];
  });

  return {
    scan,
    centerFileId: input.centerFileId,
    nodes,
    edges,
    omittedNodeCount: omittedNodeIds.size,
    omittedEdgeCount,
  };
}

export async function queryProjectMapRelationshipEdge(input: {
  workspaceId: string;
  edgeId: string;
  storageLocation?: ProjectMapStorageLocation;
}): Promise<ProjectMapRelationshipEdgeContext | null> {
  const response = await loadProjectMapRelationshipData(input);
  const scan = buildSnapshotMetadata(response);
  const dashboardData = normalizeProjectMapRelationshipDashboardData(response);
  const filesById = new Map(dashboardData.files.map((file) => [file.id, file]));
  const relation = dashboardData.relations.find((item) => item.id === input.edgeId) ?? null;
  if (!relation) {
    return null;
  }
  return {
    scan,
    ...createProjectMapRelationshipEdgeSnapshot(relation),
    sourceNode: filesById.get(relation.sourceFileId),
    targetNode: filesById.get(relation.targetFileId),
    contextPack: {
      sourceFileId: relation.sourceFileId,
      targetFileId: relation.targetFileId,
      sourceRole: filesById.get(relation.sourceFileId)?.role,
      targetRole: filesById.get(relation.targetFileId)?.role,
    },
  };
}
