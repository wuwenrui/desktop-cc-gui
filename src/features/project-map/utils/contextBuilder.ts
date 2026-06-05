import type {
  ProjectMapAgentTaskContext,
  ProjectMapContextPack,
  ProjectMapContextRiskFlag,
  ProjectMapDataset,
  ProjectMapEvidenceRecord,
  ProjectMapExplainPack,
  ProjectMapNode,
  ProjectMapRelatedArtifact,
  ProjectMapRelation,
  ProjectMapSource,
} from "../types";
import {
  buildProjectMapAgentTaskContext,
  collectProjectMapGovernanceLinks,
} from "./governanceGraph";

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seenKeys = new Set<string>();
  const uniqueItems: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function buildNodeSearchHaystack(node: ProjectMapNode): string {
  return [
    node.id,
    node.title,
    node.summary,
    node.nodeKind,
    node.lensId,
    node.detail.coreDescription,
    ...node.detail.keyFacts,
    ...node.detail.keyLogic,
    ...node.detail.riskSignals,
    ...node.sources.map((source) => `${source.label} ${source.path ?? ""} ${source.excerpt ?? ""}`),
    ...node.detail.relatedArtifacts.map((artifact) => `${artifact.label} ${artifact.path ?? ""} ${artifact.ref ?? ""}`),
  ].join("\n").toLowerCase();
}

function buildNodeIndex(nodes: ProjectMapNode[]): Map<string, ProjectMapNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getRelationNeighborIds(relations: ProjectMapRelation[], nodeIds: Set<string>): Set<string> {
  const relatedIds = new Set<string>();
  for (const relation of relations) {
    const sourceMatched = nodeIds.has(relation.sourceNodeId);
    const targetMatched = nodeIds.has(relation.targetNodeId);
    if (sourceMatched) {
      relatedIds.add(relation.targetNodeId);
    }
    if (targetMatched) {
      relatedIds.add(relation.sourceNodeId);
    }
  }
  return relatedIds;
}

function getHierarchyNeighborIds(nodes: ProjectMapNode[], nodeIds: Set<string>): Set<string> {
  const relatedIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      if (node.parentId) {
        relatedIds.add(node.parentId);
      }
      for (const childId of node.children) {
        relatedIds.add(childId);
      }
      continue;
    }
    if (node.parentId && nodeIds.has(node.parentId)) {
      relatedIds.add(node.id);
    }
    if (node.children.some((childId) => nodeIds.has(childId))) {
      relatedIds.add(node.id);
    }
  }
  return relatedIds;
}

function collectRiskFlags(nodes: ProjectMapNode[], relations: ProjectMapRelation[]): ProjectMapContextRiskFlag[] {
  const nodeFlags = nodes.flatMap((node): ProjectMapContextRiskFlag[] => {
    const flags: ProjectMapContextRiskFlag[] = [];
    if (node.stale) {
      flags.push({
        id: `node:${node.id}:stale`,
        severity: "warning",
        label: `${node.title} is stale`,
        nodeId: node.id,
      });
    }
    if (node.confidence === "low" || node.confidence === "unknown") {
      flags.push({
        id: `node:${node.id}:confidence`,
        severity: node.confidence === "low" ? "warning" : "info",
        label: `${node.title} confidence is ${node.confidence}`,
        nodeId: node.id,
      });
    }
    return flags;
  });
  const relationFlags = relations
    .filter((relation) => relation.stale)
    .map((relation): ProjectMapContextRiskFlag => ({
      id: `relation:${relation.id}:stale`,
      severity: "warning",
      label: `${relation.type} relation is stale`,
    }));
  return [...nodeFlags, ...relationFlags];
}

function collectEvidenceRecords(
  dataset: ProjectMapDataset,
  nodes: ProjectMapNode[],
  relations: ProjectMapRelation[],
): ProjectMapEvidenceRecord[] {
  const relationEvidence = relations.flatMap((relation) => relation.evidence);
  const sourceKeys = new Set(
    nodes.flatMap((node) =>
      node.sources.map((source) => `${source.type}:${source.path ?? ""}:${source.hash ?? ""}:${source.label}`),
    ),
  );
  const datasetEvidence = (dataset.evidenceRecords ?? []).filter((record) =>
    sourceKeys.has(
      `${record.source.type}:${record.source.path ?? ""}:${record.source.hash ?? ""}:${record.source.label}`,
    ),
  );
  return uniqueBy([...relationEvidence, ...datasetEvidence], (record) => record.id);
}

function collectRelatedArtifacts(nodes: ProjectMapNode[]): ProjectMapRelatedArtifact[] {
  return uniqueBy(
    nodes.flatMap((node) => node.detail.relatedArtifacts),
    (artifact) => `${artifact.type}:${artifact.path ?? ""}:${artifact.ref ?? ""}:${artifact.label}`,
  );
}

function collectSources(nodes: ProjectMapNode[]): ProjectMapSource[] {
  return uniqueBy(
    nodes.flatMap((node) => node.sources),
    (source) => `${source.type}:${source.path ?? ""}:${source.hash ?? ""}:${source.label}`,
  );
}

export function buildProjectMapContextPack(input: {
  dataset: ProjectMapDataset;
  selectedNodeId?: string | null;
  query?: string | null;
  maxMatches?: number;
}): ProjectMapContextPack {
  const { dataset } = input;
  const nodeIndex = buildNodeIndex(dataset.nodes);
  const normalizedQuery = normalizeSearchText(input.query ?? "");
  const selectedNode = input.selectedNodeId ? nodeIndex.get(input.selectedNodeId) ?? null : null;
  const matchedByQuery = normalizedQuery
    ? dataset.nodes
        .filter((node) => buildNodeSearchHaystack(node).includes(normalizedQuery))
        .slice(0, input.maxMatches ?? 12)
    : [];
  const matchedNodes = uniqueBy(
    [...(selectedNode ? [selectedNode] : []), ...matchedByQuery],
    (node) => node.id,
  );
  const matchedNodeIds = new Set(matchedNodes.map((node) => node.id));
  const relationNeighborIds = getRelationNeighborIds(dataset.relations ?? [], matchedNodeIds);
  const hierarchyNeighborIds = getHierarchyNeighborIds(dataset.nodes, matchedNodeIds);
  const relatedNodes = uniqueBy(
    [...relationNeighborIds, ...hierarchyNeighborIds]
      .filter((nodeId) => !matchedNodeIds.has(nodeId))
      .flatMap((nodeId) => {
        const node = nodeIndex.get(nodeId);
        return node ? [node] : [];
      }),
    (node) => node.id,
  );
  const contextNodeIds = new Set([...matchedNodeIds, ...relatedNodes.map((node) => node.id)]);
  const relations = (dataset.relations ?? []).filter(
    (relation) =>
      contextNodeIds.has(relation.sourceNodeId) && contextNodeIds.has(relation.targetNodeId),
  );
  const contextNodes = [...matchedNodes, ...relatedNodes];

  return {
    id: `project-map-context:${selectedNode?.id ?? (normalizedQuery || "overview")}`,
    query: input.query?.trim() || undefined,
    selectedNode,
    matchedNodes,
    relatedNodes,
    relations,
    evidenceSources: collectSources(contextNodes),
    evidenceRecords: collectEvidenceRecords(dataset, contextNodes, relations),
    relatedArtifacts: collectRelatedArtifacts(contextNodes),
    governanceEvidence: collectProjectMapGovernanceLinks({
      nodes: contextNodes,
      relations,
    }),
    riskFlags: collectRiskFlags(contextNodes, relations),
  };
}

export function buildProjectMapAgentTaskContextPack(input: {
  dataset: ProjectMapDataset;
  selectedNodeId?: string | null;
  query?: string | null;
  maxMatches?: number;
}): ProjectMapAgentTaskContext {
  return buildProjectMapAgentTaskContext(buildProjectMapContextPack(input));
}

export function buildProjectMapExplainPack(input: {
  dataset: ProjectMapDataset;
  nodeId: string;
}): ProjectMapExplainPack | null {
  const nodeIndex = buildNodeIndex(input.dataset.nodes);
  const focusNode = nodeIndex.get(input.nodeId);
  if (!focusNode) {
    return null;
  }
  const context = buildProjectMapContextPack({
    dataset: input.dataset,
    selectedNodeId: input.nodeId,
  });
  return {
    ...context,
    focusNode,
    childNodes: focusNode.children.flatMap((childId) => {
      const child = nodeIndex.get(childId);
      return child ? [child] : [];
    }),
    parentNode: focusNode.parentId ? nodeIndex.get(focusNode.parentId) ?? null : null,
  };
}
