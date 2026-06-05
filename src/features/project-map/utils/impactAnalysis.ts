import type {
  ProjectMapDataset,
  ProjectMapImpactNode,
  ProjectMapImpactResult,
  ProjectMapImpactSourceMetadata,
  ProjectMapNode,
  ProjectMapRelation,
} from "../types";
import {
  filterProjectMapContextPaths,
  normalizeProjectMapContextPath,
} from "./ignorePolicy";

function pathMatches(left: string, right: string): boolean {
  const normalizedLeft = normalizeProjectMapContextPath(left).toLowerCase();
  const normalizedRight = normalizeProjectMapContextPath(right).toLowerCase();
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.endsWith(`/${normalizedRight}`) ||
    normalizedRight.endsWith(`/${normalizedLeft}`)
  );
}

function nodeReferencesPath(node: ProjectMapNode, path: string): boolean {
  return (
    node.sources.some((source) =>
      [source.path, source.label].some((value) => value && pathMatches(value, path)),
    ) ||
    node.detail.relatedArtifacts.some((artifact) =>
      [artifact.path, artifact.ref, artifact.label].some((value) => value && pathMatches(value, path)),
    ) ||
    (node.detail.diagramArtifacts ?? []).some((diagram) =>
      [diagram.path, ...diagram.sourceRefs ?? []].some((value) => pathMatches(value, path)),
    )
  );
}

function buildNodeIndex(nodes: ProjectMapNode[]): Map<string, ProjectMapNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function buildChangedNodes(dataset: ProjectMapDataset, paths: string[]): ProjectMapImpactNode[] {
  return dataset.nodes.flatMap((node) => {
    const matchedPath = paths.find((path) => nodeReferencesPath(node, path));
    return matchedPath
      ? [
          {
            node,
            reason: `matched:${matchedPath}`,
            relationIds: [],
          },
        ]
      : [];
  });
}

function getHierarchyAffectedNodes(
  dataset: ProjectMapDataset,
  changedNodeIds: Set<string>,
): ProjectMapImpactNode[] {
  return dataset.nodes.flatMap((node) => {
    if (changedNodeIds.has(node.id)) {
      return [];
    }
    const affectedByParent = node.parentId ? changedNodeIds.has(node.parentId) : false;
    const affectedByChild = node.children.some((childId) => changedNodeIds.has(childId));
    if (!affectedByParent && !affectedByChild) {
      return [];
    }
    return [
      {
        node,
        reason: affectedByParent ? "hierarchy-parent" : "hierarchy-child",
        relationIds: [],
      },
    ];
  });
}

function getRelationAffectedNodes(
  dataset: ProjectMapDataset,
  changedNodeIds: Set<string>,
): ProjectMapImpactNode[] {
  const nodeIndex = buildNodeIndex(dataset.nodes);
  const affectedByNodeId = new Map<string, ProjectMapImpactNode>();
  for (const relation of dataset.relations ?? []) {
    const sourceChanged = changedNodeIds.has(relation.sourceNodeId);
    const targetChanged = changedNodeIds.has(relation.targetNodeId);
    const affectedNodeId = sourceChanged
      ? relation.targetNodeId
      : targetChanged
        ? relation.sourceNodeId
        : null;
    if (!affectedNodeId || changedNodeIds.has(affectedNodeId)) {
      continue;
    }
    const node = nodeIndex.get(affectedNodeId);
    if (!node) {
      continue;
    }
    const existing = affectedByNodeId.get(node.id);
    affectedByNodeId.set(node.id, {
      node,
      reason: existing?.reason ?? `relation:${relation.type}`,
      relationIds: [...(existing?.relationIds ?? []), relation.id],
    });
  }
  return [...affectedByNodeId.values()];
}

function mergeImpactNodes(nodes: ProjectMapImpactNode[]): ProjectMapImpactNode[] {
  const byNodeId = new Map<string, ProjectMapImpactNode>();
  for (const item of nodes) {
    const existing = byNodeId.get(item.node.id);
    byNodeId.set(item.node.id, {
      node: item.node,
      reason: existing ? `${existing.reason},${item.reason}` : item.reason,
      relationIds: [...(existing?.relationIds ?? []), ...item.relationIds],
    });
  }
  return [...byNodeId.values()];
}

function getChangedRelations(dataset: ProjectMapDataset, changedNodeIds: Set<string>): ProjectMapRelation[] {
  return (dataset.relations ?? []).filter(
    (relation) =>
      changedNodeIds.has(relation.sourceNodeId) || changedNodeIds.has(relation.targetNodeId),
  );
}

export function buildProjectMapImpactAnalysis(input: {
  dataset: ProjectMapDataset;
  changedFilePaths: string[];
  source?: ProjectMapImpactSourceMetadata;
}): ProjectMapImpactResult {
  const ignored = filterProjectMapContextPaths(input.changedFilePaths);
  const changedNodes = buildChangedNodes(input.dataset, ignored.keptPaths);
  const changedNodeIds = new Set(changedNodes.map((item) => item.node.id));
  const affectedNodes = mergeImpactNodes([
    ...getRelationAffectedNodes(input.dataset, changedNodeIds),
    ...getHierarchyAffectedNodes(input.dataset, changedNodeIds),
  ]);
  const mappedPaths = new Set(
    changedNodes.flatMap((item) =>
      ignored.keptPaths.filter((path) => nodeReferencesPath(item.node, path)),
    ),
  );
  const unmappedFiles = ignored.keptPaths.filter((path) => !mappedPaths.has(path));
  const impactedNodes = [...changedNodes, ...affectedNodes].map((item) => item.node);
  const affectedLensIds = [...new Set(impactedNodes.map((node) => node.lensId))];
  const staleCount = impactedNodes.filter((node) => node.stale).length;
  const lowConfidenceCount = impactedNodes.filter(
    (node) => node.confidence === "low" || node.confidence === "unknown",
  ).length;
  const staleRelationCount = getChangedRelations(input.dataset, changedNodeIds).filter(
    (relation) => relation.stale,
  ).length;

  return {
    inputFiles: input.changedFilePaths,
    source: input.source,
    changedNodes,
    affectedNodes,
    affectedLensIds,
    unmappedFiles,
    ignored,
    riskSummary: {
      changedCount: changedNodes.length,
      affectedCount: affectedNodes.length,
      staleCount: staleCount + staleRelationCount,
      lowConfidenceCount,
      unmappedCount: unmappedFiles.length,
      ignoredCount: ignored.ignoredPaths.length,
    },
  };
}
