import type {
  ProjectMapConfidence,
  ProjectMapDataset,
  ProjectMapGovernanceLink,
  ProjectMapNode,
  ProjectMapRelatedArtifact,
  ProjectMapRelation,
  ProjectMapSource,
  ProjectMapSourceType,
} from "../types";
import { collectProjectMapGovernanceLinks } from "./governanceGraph";
import { inferProjectMapWorkspaceFilePath } from "./evidencePaths";

export type ProjectMapEvidenceFileLineRef = {
  line: number;
  label: string;
  nodeId?: string;
  relationId?: string;
  governanceLinkId?: string;
};

export type ProjectMapEvidenceFileNodeLink = {
  nodeId: string;
  title: string;
  nodeKind: string;
  confidence: ProjectMapConfidence;
  stale: boolean;
  evidenceCount: number;
  lineRefs: ProjectMapEvidenceFileLineRef[];
};

export type ProjectMapEvidenceFileRelationLink = {
  relationId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
  sourceKind: string;
  confidence: ProjectMapConfidence;
  stale: boolean;
  evidenceCount: number;
  lineRefs: ProjectMapEvidenceFileLineRef[];
};

export type ProjectMapEvidenceFileGovernanceLink = {
  id: string;
  kind: string;
  label: string;
  nodeId?: string;
  relationId?: string;
  confidence: ProjectMapConfidence;
  sourceKind: string;
  deterministic: boolean;
  line?: number;
};

export type ProjectMapNonFileEvidence = {
  id: string;
  label: string;
  type: string;
  reason: "missing-path" | "non-file-ref";
  nodeId?: string;
  relationId?: string;
  governanceLinkId?: string;
};

export type ProjectMapEvidenceFileEntry = {
  path: string;
  displayPath: string;
  sourceTypes: ProjectMapSourceType[];
  sourceKinds: string[];
  nodeLinks: ProjectMapEvidenceFileNodeLink[];
  relationLinks: ProjectMapEvidenceFileRelationLink[];
  governanceLinks: ProjectMapEvidenceFileGovernanceLink[];
  lineRefs: ProjectMapEvidenceFileLineRef[];
  evidenceCount: number;
  nodeCount: number;
  relationCount: number;
  staleCount: number;
  lowConfidenceCount: number;
  degradedCount: number;
};

export type ProjectMapEvidenceFileIndex = {
  files: ProjectMapEvidenceFileEntry[];
  nonFileEvidence: ProjectMapNonFileEvidence[];
  totalFileEvidenceCount: number;
  totalNonFileEvidenceCount: number;
};

type MutableEvidenceFileEntry = ProjectMapEvidenceFileEntry & {
  sourceTypeSet: Set<ProjectMapSourceType>;
  sourceKindSet: Set<string>;
  nodeLinkById: Map<string, ProjectMapEvidenceFileNodeLink>;
  relationLinkById: Map<string, ProjectMapEvidenceFileRelationLink>;
  governanceLinkById: Map<string, ProjectMapEvidenceFileGovernanceLink>;
  lineRefKeys: Set<string>;
};

type EvidencePathInput = {
  label?: string;
  path?: string;
  ref?: string;
};

function normalizeWorkspaceEvidencePath(input: EvidencePathInput): string | null {
  const inferredPath = inferProjectMapWorkspaceFilePath({
    label: input.label ?? "",
    path: input.path ?? "",
    ref: input.ref ?? "",
  });
  const normalizedPath = inferredPath.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  return normalizedPath || null;
}

function isLowConfidence(confidence: ProjectMapConfidence): boolean {
  return confidence === "low" || confidence === "unknown";
}

function createMutableEntry(path: string): MutableEvidenceFileEntry {
  return {
    path,
    displayPath: path,
    sourceTypes: [],
    sourceKinds: [],
    nodeLinks: [],
    relationLinks: [],
    governanceLinks: [],
    lineRefs: [],
    evidenceCount: 0,
    nodeCount: 0,
    relationCount: 0,
    staleCount: 0,
    lowConfidenceCount: 0,
    degradedCount: 0,
    sourceTypeSet: new Set<ProjectMapSourceType>(),
    sourceKindSet: new Set<string>(),
    nodeLinkById: new Map<string, ProjectMapEvidenceFileNodeLink>(),
    relationLinkById: new Map<string, ProjectMapEvidenceFileRelationLink>(),
    governanceLinkById: new Map<string, ProjectMapEvidenceFileGovernanceLink>(),
    lineRefKeys: new Set<string>(),
  };
}

function getOrCreateEntry(
  entriesByPath: Map<string, MutableEvidenceFileEntry>,
  path: string,
): MutableEvidenceFileEntry {
  const existingEntry = entriesByPath.get(path);
  if (existingEntry) {
    return existingEntry;
  }
  const entry = createMutableEntry(path);
  entriesByPath.set(path, entry);
  return entry;
}

function addLineRef(
  entry: MutableEvidenceFileEntry,
  lineRef: ProjectMapEvidenceFileLineRef | null,
): void {
  if (!lineRef || !Number.isFinite(lineRef.line) || lineRef.line <= 0) {
    return;
  }
  const normalizedLineRef = {
    ...lineRef,
    line: Math.floor(lineRef.line),
  };
  const key = [
    normalizedLineRef.line,
    normalizedLineRef.label,
    normalizedLineRef.nodeId ?? "",
    normalizedLineRef.relationId ?? "",
    normalizedLineRef.governanceLinkId ?? "",
  ].join(":");
  if (entry.lineRefKeys.has(key)) {
    return;
  }
  entry.lineRefKeys.add(key);
  entry.lineRefs.push(normalizedLineRef);
}

function addNodeEvidence(input: {
  entry: MutableEvidenceFileEntry;
  node: ProjectMapNode;
  sourceType: ProjectMapSourceType;
  sourceKind: string;
  lineRef: ProjectMapEvidenceFileLineRef | null;
}): void {
  const { entry, node } = input;
  entry.evidenceCount += 1;
  entry.sourceTypeSet.add(input.sourceType);
  entry.sourceKindSet.add(input.sourceKind);
  addLineRef(entry, input.lineRef);

  const nodeLink = entry.nodeLinkById.get(node.id) ?? {
    nodeId: node.id,
    title: node.title,
    nodeKind: node.nodeKind,
    confidence: node.confidence,
    stale: node.stale,
    evidenceCount: 0,
    lineRefs: [],
  };
  nodeLink.evidenceCount += 1;
  if (input.lineRef) {
    nodeLink.lineRefs = [...nodeLink.lineRefs, input.lineRef];
  }
  entry.nodeLinkById.set(node.id, nodeLink);
}

function addRelationEvidence(input: {
  entry: MutableEvidenceFileEntry;
  relation: ProjectMapRelation;
  sourceType: ProjectMapSourceType;
  lineRef: ProjectMapEvidenceFileLineRef | null;
}): void {
  const { entry, relation } = input;
  entry.evidenceCount += 1;
  entry.sourceTypeSet.add(input.sourceType);
  entry.sourceKindSet.add(relation.sourceKind);
  addLineRef(entry, input.lineRef);

  const relationLink = entry.relationLinkById.get(relation.id) ?? {
    relationId: relation.id,
    sourceNodeId: relation.sourceNodeId,
    targetNodeId: relation.targetNodeId,
    type: relation.type,
    sourceKind: relation.sourceKind,
    confidence: relation.confidence,
    stale: Boolean(relation.stale),
    evidenceCount: 0,
    lineRefs: [],
  };
  relationLink.evidenceCount += 1;
  if (input.lineRef) {
    relationLink.lineRefs = [...relationLink.lineRefs, input.lineRef];
  }
  entry.relationLinkById.set(relation.id, relationLink);
}

function addGovernanceEvidence(input: {
  entry: MutableEvidenceFileEntry;
  link: ProjectMapGovernanceLink;
}): void {
  const { entry, link } = input;
  entry.evidenceCount += 1;
  entry.sourceKindSet.add(link.sourceKind);
  entry.governanceLinkById.set(link.id, {
    id: link.id,
    kind: link.kind,
    label: link.label,
    nodeId: link.nodeId,
    relationId: link.relationId,
    confidence: link.confidence,
    sourceKind: link.sourceKind,
    deterministic: link.deterministic,
    line: link.line,
  });
  addLineRef(entry, link.line ? {
    line: link.line,
    label: link.label,
    nodeId: link.nodeId,
    relationId: link.relationId,
    governanceLinkId: link.id,
  } : null);
}

function addNonFileEvidence(
  nonFileEvidence: ProjectMapNonFileEvidence[],
  evidence: ProjectMapNonFileEvidence,
): void {
  if (nonFileEvidence.some((item) => item.id === evidence.id)) {
    return;
  }
  nonFileEvidence.push(evidence);
}

function sourceLineRef(
  source: Pick<ProjectMapSource, "line" | "label">,
  nodeId: string,
): ProjectMapEvidenceFileLineRef | null {
  return source.line ? { line: source.line, label: source.label, nodeId } : null;
}

function artifactLineRef(
  artifact: Pick<ProjectMapRelatedArtifact, "line" | "label">,
  nodeId: string,
): ProjectMapEvidenceFileLineRef | null {
  return artifact.line ? { line: artifact.line, label: artifact.label, nodeId } : null;
}

function relationLineRef(
  source: ProjectMapSource,
  relationId: string,
): ProjectMapEvidenceFileLineRef | null {
  return source.line ? { line: source.line, label: source.label, relationId } : null;
}

function finalizeEntry(entry: MutableEvidenceFileEntry): ProjectMapEvidenceFileEntry {
  const nodeLinks = [...entry.nodeLinkById.values()].sort((left, right) => {
    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }
    return left.title.localeCompare(right.title);
  });
  const relationLinks = [...entry.relationLinkById.values()].sort((left, right) => {
    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }
    return left.relationId.localeCompare(right.relationId);
  });
  const governanceLinks = [...entry.governanceLinkById.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
  const staleCount = nodeLinks.filter((link) => link.stale).length + relationLinks.filter((link) => link.stale).length;
  const lowConfidenceCount =
    nodeLinks.filter((link) => isLowConfidence(link.confidence)).length +
    relationLinks.filter((link) => isLowConfidence(link.confidence)).length +
    governanceLinks.filter((link) => isLowConfidence(link.confidence)).length;
  const degradedCount = relationLinks.filter((link) => !link.sourceNodeId || !link.targetNodeId).length;

  return {
    path: entry.path,
    displayPath: entry.displayPath,
    sourceTypes: [...entry.sourceTypeSet].sort(),
    sourceKinds: [...entry.sourceKindSet].sort(),
    nodeLinks,
    relationLinks,
    governanceLinks,
    lineRefs: entry.lineRefs.sort((left, right) => left.line - right.line),
    evidenceCount: entry.evidenceCount,
    nodeCount: nodeLinks.length,
    relationCount: relationLinks.length,
    staleCount,
    lowConfidenceCount,
    degradedCount,
  };
}

function sortEvidenceFileEntries(entries: ProjectMapEvidenceFileEntry[]): ProjectMapEvidenceFileEntry[] {
  return entries.sort((left, right) => {
    if (right.nodeCount !== left.nodeCount) {
      return right.nodeCount - left.nodeCount;
    }
    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }
    const rightRisk = right.staleCount + right.lowConfidenceCount + right.degradedCount;
    const leftRisk = left.staleCount + left.lowConfidenceCount + left.degradedCount;
    if (rightRisk !== leftRisk) {
      return rightRisk - leftRisk;
    }
    return left.path.localeCompare(right.path);
  });
}

export function buildProjectMapEvidenceFileIndex(input: {
  dataset: ProjectMapDataset;
  governanceLinks?: ProjectMapGovernanceLink[];
}): ProjectMapEvidenceFileIndex {
  const entriesByPath = new Map<string, MutableEvidenceFileEntry>();
  const nonFileEvidence: ProjectMapNonFileEvidence[] = [];

  for (const node of input.dataset.nodes) {
    for (const source of node.sources) {
      const path = normalizeWorkspaceEvidencePath(source);
      if (!path) {
        addNonFileEvidence(nonFileEvidence, {
          id: `node:${node.id}:source:${source.type}:${source.label}:${source.hash ?? source.line ?? ""}`,
          label: source.label,
          type: source.type,
          reason: source.hash ? "non-file-ref" : "missing-path",
          nodeId: node.id,
        });
        continue;
      }
      addNodeEvidence({
        entry: getOrCreateEntry(entriesByPath, path),
        node,
        sourceType: source.type,
        sourceKind: source.type,
        lineRef: sourceLineRef(source, node.id),
      });
    }

    for (const artifact of node.detail.relatedArtifacts) {
      const path = normalizeWorkspaceEvidencePath(artifact);
      if (!path) {
        addNonFileEvidence(nonFileEvidence, {
          id: `node:${node.id}:artifact:${artifact.type}:${artifact.label}:${artifact.ref ?? artifact.line ?? ""}`,
          label: artifact.label,
          type: artifact.type,
          reason: artifact.ref ? "non-file-ref" : "missing-path",
          nodeId: node.id,
        });
        continue;
      }
      addNodeEvidence({
        entry: getOrCreateEntry(entriesByPath, path),
        node,
        sourceType: artifact.type,
        sourceKind: artifact.type,
        lineRef: artifactLineRef(artifact, node.id),
      });
    }
  }

  for (const relation of input.dataset.relations ?? []) {
    for (const evidence of relation.evidence) {
      const source = evidence.source;
      const path = normalizeWorkspaceEvidencePath(source);
      if (!path) {
        addNonFileEvidence(nonFileEvidence, {
          id: `relation:${relation.id}:evidence:${evidence.id}:${source.label}:${source.hash ?? ""}`,
          label: source.label,
          type: source.type,
          reason: source.hash ? "non-file-ref" : "missing-path",
          relationId: relation.id,
        });
        continue;
      }
      addRelationEvidence({
        entry: getOrCreateEntry(entriesByPath, path),
        relation,
        sourceType: source.type,
        lineRef: relationLineRef(source, relation.id),
      });
    }
  }

  const governanceLinks = input.governanceLinks ?? collectProjectMapGovernanceLinks({
    nodes: input.dataset.nodes,
    relations: input.dataset.relations ?? [],
  });
  for (const link of governanceLinks) {
    const path = normalizeWorkspaceEvidencePath(link);
    if (!path) {
      addNonFileEvidence(nonFileEvidence, {
        id: `governance:${link.id}`,
        label: link.label,
        type: link.kind,
        reason: link.ref || link.relationId ? "non-file-ref" : "missing-path",
        nodeId: link.nodeId,
        relationId: link.relationId,
        governanceLinkId: link.id,
      });
      continue;
    }
    addGovernanceEvidence({
      entry: getOrCreateEntry(entriesByPath, path),
      link,
    });
  }

  const files = sortEvidenceFileEntries([...entriesByPath.values()].map(finalizeEntry));
  return {
    files,
    nonFileEvidence,
    totalFileEvidenceCount: files.reduce((total, entry) => total + entry.evidenceCount, 0),
    totalNonFileEvidenceCount: nonFileEvidence.length,
  };
}
