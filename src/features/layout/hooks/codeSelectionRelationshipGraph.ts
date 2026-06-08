import { readProjectMapRelationships } from "../../project-map/services/projectMapPersistence";
import {
  getProjectMapRelationshipCallCandidate,
  normalizeProjectMapRelationshipDashboardData,
  normalizeProjectMapRelationshipReadSummary,
} from "../../project-map/utils/relationshipDashboardModel";
import type {
  ProjectMapFileRelation,
  ProjectMapScannedFile,
  ProjectMapStorageLocation,
} from "../../project-map/types";
import {
  createProjectMapRelationshipEdgeSnapshot,
  getProjectMapRelationshipEdgeDisplayLabel,
} from "../../intent-canvas/services/relationshipImportQueries";
import type {
  CanvasEvidenceRef,
  CanvasSemanticEdge,
  CanvasSemanticGraph,
  CanvasSemanticNode,
  IntentCanvasCodeSelectionAnchor,
} from "../../intent-canvas/types";

function normalizeRelationshipPath(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\\/g, "/").replace(/^\/+/, "") : "";
}

function isSameRelationshipPath(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeRelationshipPath(left);
  const normalizedRight = normalizeRelationshipPath(right);
  return Boolean(normalizedLeft && normalizedRight) && normalizedLeft === normalizedRight;
}

function formatCodeAnchorLineLabel(anchor: IntentCanvasCodeSelectionAnchor): string {
  return anchor.startLine === anchor.endLine
    ? `L${anchor.startLine}`
    : `L${anchor.startLine}-L${anchor.endLine}`;
}

function mapCodeAnchorSymbolKind(anchor: IntentCanvasCodeSelectionAnchor): CanvasSemanticNode["sourceAnchor"] {
  return {
    kind: "code-symbol",
    workspaceId: "",
    filePath: anchor.filePath,
    symbolName: anchor.symbolName,
    symbolKind:
      anchor.symbolKind === "class" || anchor.symbolKind === "method" || anchor.symbolKind === "function"
        ? anchor.symbolKind
        : "unknown",
    resolvedBy: "editor-selection",
  };
}

function relationEvidenceTouchesCodeAnchor(
  relation: ProjectMapFileRelation,
  anchor: IntentCanvasCodeSelectionAnchor,
): boolean {
  return relation.evidence.some((entry) => {
    if (!isSameRelationshipPath(entry.path, anchor.filePath)) {
      return false;
    }
    const line = typeof entry.line === "number" && Number.isFinite(entry.line) ? entry.line : null;
    return line !== null && line >= anchor.startLine && line <= anchor.endLine;
  });
}

function relationTextTouchesCodeAnchor(
  relation: ProjectMapFileRelation,
  anchor: IntentCanvasCodeSelectionAnchor,
  filesById: ReadonlyMap<string, ProjectMapScannedFile>,
): boolean {
  const referenceTokens = new Set<string>();
  [anchor.symbolName, ...(anchor.referenceTokens ?? [])].forEach((token) => {
    const normalizedToken = token.trim().toLowerCase();
    if (!normalizedToken || normalizedToken.length < 2) {
      return;
    }
    referenceTokens.add(normalizedToken);
    normalizedToken
      .split(/\.|::/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1)
      .forEach((part) => referenceTokens.add(part));
  });
  if (!referenceTokens.size) {
    return false;
  }
  const sourceFile = filesById.get(relation.sourceFileId);
  const targetFile = filesById.get(relation.targetFileId);
  const text = [
    relation.id,
    relation.type,
    sourceFile?.path ?? "",
    sourceFile?.basename ?? "",
    targetFile?.path ?? "",
    targetFile?.basename ?? "",
    getProjectMapRelationshipCallCandidate(relation),
    ...relation.evidence.map((entry) => entry.path ?? ""),
    ...relation.evidence.map((entry) => entry.excerpt ?? ""),
  ].join("\n").toLowerCase();
  return Array.from(referenceTokens).some((token) => text.includes(token));
}

function relationMatchesCodeAnchor(input: {
  relation: ProjectMapFileRelation;
  centerFileId: string;
  anchor: IntentCanvasCodeSelectionAnchor;
  filesById: ReadonlyMap<string, ProjectMapScannedFile>;
}): boolean {
  const touchesCenterFile =
    input.relation.sourceFileId === input.centerFileId ||
    input.relation.targetFileId === input.centerFileId;
  if (!touchesCenterFile) {
    return false;
  }
  return relationEvidenceTouchesCodeAnchor(input.relation, input.anchor)
    || relationTextTouchesCodeAnchor(input.relation, input.anchor, input.filesById);
}

function createCodeSelectionRelationshipGraph(input: {
  workspaceId: string;
  scanRunId: string;
  generatedAt: string;
  anchor: IntentCanvasCodeSelectionAnchor;
  centerFile: ProjectMapScannedFile;
  filesById: ReadonlyMap<string, ProjectMapScannedFile>;
  relations: ProjectMapFileRelation[];
  symbolId?: string | null;
}): CanvasSemanticGraph {
  const lineSegment = formatCodeAnchorLineLabel(input.anchor);
  const graphId = `active-editor-selection:${input.centerFile.id}:${input.anchor.symbolName}:${lineSegment}:${Date.now()}`;
  const centerNodeId = `code-symbol:${input.centerFile.id}:${input.anchor.symbolName}:${input.anchor.declarationLine}`;
  const relatedNodesById = new Map<string, CanvasSemanticNode>();
  const addRelatedFileNode = (fileId: string) => {
    if (!fileId || fileId === input.centerFile.id || relatedNodesById.has(fileId)) {
      return;
    }
    const file = input.filesById.get(fileId);
    relatedNodesById.set(fileId, {
      id: fileId,
      label: file?.basename ?? fileId,
      kind: "file",
      sourceAnchor: {
        kind: "relationship-node",
        workspaceId: input.workspaceId,
        scanRunId: input.scanRunId,
        nodeId: fileId,
        nodeKind: file?.role ?? "unknown",
        filePath: file?.path ?? fileId,
      },
      evidenceIds: [],
      summary: `role:${file?.role ?? "unknown"}; path:${file?.path ?? fileId}`,
      stale: false,
      unresolved: !file,
    });
  };
  input.relations.forEach((relation) => {
    addRelatedFileNode(relation.sourceFileId);
    addRelatedFileNode(relation.targetFileId);
  });
  const centerSourceAnchor = mapCodeAnchorSymbolKind(input.anchor);
  if (centerSourceAnchor?.kind === "code-symbol") {
    centerSourceAnchor.workspaceId = input.workspaceId;
    centerSourceAnchor.scanRunId = input.scanRunId;
    centerSourceAnchor.symbolId =
      input.symbolId ?? `${input.centerFile.id}:${input.anchor.symbolName}:${input.anchor.declarationLine}`;
  }
  const centerNode: CanvasSemanticNode = {
    id: centerNodeId,
    label: input.anchor.symbolName,
    kind: "symbol",
    sourceAnchor: centerSourceAnchor,
    evidenceIds: [],
    summary: [
      `${input.anchor.symbolKind} · ${input.centerFile.basename}`,
      `${input.anchor.filePath}:${formatCodeAnchorLineLabel(input.anchor)}`,
      `${input.relations.length} fact-backed relation(s)`,
    ].join("\n"),
    stale: false,
    unresolved: false,
  };
  const edges: CanvasSemanticEdge[] = input.relations.map((relation) => {
    const snapshot = createProjectMapRelationshipEdgeSnapshot(relation);
    const isOutgoing = relation.sourceFileId === input.centerFile.id;
    const relatedFileId = isOutgoing ? relation.targetFileId : relation.sourceFileId;
    return {
      id: `${centerNodeId}:${relation.id}`,
      sourceNodeId: isOutgoing ? centerNodeId : relatedFileId,
      targetNodeId: isOutgoing ? relatedFileId : centerNodeId,
      relationKind: relation.type,
      direction: isOutgoing ? "out" : "in",
      sourceAnchor: {
        kind: "relationship-edge",
        workspaceId: input.workspaceId,
        scanRunId: input.scanRunId,
        edgeId: relation.id,
        relationKind: relation.type,
        sourceNodeId: relation.sourceFileId,
        targetNodeId: relation.targetFileId,
        evidenceIds: snapshot.evidenceIds,
      },
      label: getProjectMapRelationshipEdgeDisplayLabel(snapshot),
      evidenceIds: snapshot.evidenceIds,
      evidenceRefs: snapshot.evidenceRefs as CanvasEvidenceRef[],
      evidenceSummary: snapshot.evidenceSummary,
      stale: relation.stale ?? false,
      unresolved: !relatedNodesById.has(relatedFileId),
    };
  });
  return {
    graphId,
    createdAt: new Date().toISOString(),
    sourceSnapshot: {
      kind: "project-map-relations",
      scanRunId: input.scanRunId,
      snapshotVersion: null,
    },
    sourceSelection: input.anchor,
    nodes: [centerNode, ...Array.from(relatedNodesById.values())],
    edges,
    importOptions: {
      depth: 1,
      direction: "neighborhood",
      centerNodeId,
      maxNodes: relatedNodesById.size + 1,
      maxEdges: edges.length,
      omittedNodes: 0,
      omittedEdges: 0,
    },
  };
}

export async function loadCodeSelectionRelationshipGraph(input: {
  workspaceId: string;
  anchor: IntentCanvasCodeSelectionAnchor;
  storageLocation?: ProjectMapStorageLocation;
}): Promise<CanvasSemanticGraph> {
  const response = await readProjectMapRelationships({
    workspaceId: input.workspaceId,
    storageLocation: input.storageLocation,
  });
  const summary = normalizeProjectMapRelationshipReadSummary(response);
  if (!summary) {
    throw new Error("请先在 Project Map 扫描关系，再从方法声明关联 Canvas。");
  }
  const dashboardData = normalizeProjectMapRelationshipDashboardData(response);
  const centerFile = dashboardData.files.find((file) => isSameRelationshipPath(file.path, input.anchor.filePath));
  if (!centerFile) {
    throw new Error(`关系快照里找不到当前文件：${input.anchor.filePath}`);
  }
  const filesById = new Map(dashboardData.files.map((file) => [file.id, file]));
  const symbolMatch = dashboardData.symbols.find((symbol) => (
    symbol.fileId === centerFile.id &&
    symbol.name === input.anchor.symbolName &&
    symbol.line >= input.anchor.declarationLine - 2 &&
    symbol.line <= input.anchor.declarationLine + 2
  ));
  const relations = dashboardData.relations.filter((relation) => relationMatchesCodeAnchor({
    relation,
    centerFileId: centerFile.id,
    anchor: input.anchor,
    filesById,
  }));
  return createCodeSelectionRelationshipGraph({
    workspaceId: input.workspaceId,
    scanRunId: summary.scanRunId,
    generatedAt: summary.generatedAt,
    anchor: input.anchor,
    centerFile,
    filesById,
    relations,
    symbolId: symbolMatch?.id ?? null,
  });
}
