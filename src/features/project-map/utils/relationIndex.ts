import type {
  ProjectMapDataset,
  ProjectMapGraphIntegrityIssue,
  ProjectMapNode,
  ProjectMapRelation,
  ProjectMapRelationSourceKind,
  ProjectMapRelationType,
} from "../types";

export type ProjectMapRelationDirectionFilter = "all" | "incoming" | "outgoing";

export type ProjectMapRelationEndpoint = {
  nodeId: string;
  node: ProjectMapNode | null;
  missing: boolean;
};

export type ProjectMapIndexedRelation = {
  relation: ProjectMapRelation;
  source: ProjectMapRelationEndpoint;
  target: ProjectMapRelationEndpoint;
  degraded: boolean;
  duplicate: boolean;
};

export type ProjectMapNodeRelationBucket = {
  incoming: ProjectMapIndexedRelation[];
  outgoing: ProjectMapIndexedRelation[];
};

export type ProjectMapRelationCount = {
  key: string;
  count: number;
};

export type ProjectMapRelationIndex = {
  relations: ProjectMapIndexedRelation[];
  byNodeId: Map<string, ProjectMapNodeRelationBucket>;
  byType: Map<ProjectMapRelationType, ProjectMapIndexedRelation[]>;
  bySourceKind: Map<ProjectMapRelationSourceKind, ProjectMapIndexedRelation[]>;
  typeCounts: ProjectMapRelationCount[];
  sourceKindCounts: ProjectMapRelationCount[];
  degradedIssues: ProjectMapGraphIntegrityIssue[];
  duplicateRelationIds: string[];
};

function incrementRelationMap<K>(
  map: Map<K, ProjectMapIndexedRelation[]>,
  key: K,
  relation: ProjectMapIndexedRelation,
): void {
  const current = map.get(key) ?? [];
  current.push(relation);
  map.set(key, current);
}

function getOrCreateNodeBucket(
  map: Map<string, ProjectMapNodeRelationBucket>,
  nodeId: string,
): ProjectMapNodeRelationBucket {
  const current = map.get(nodeId);
  if (current) {
    return current;
  }
  const next = { incoming: [], outgoing: [] } satisfies ProjectMapNodeRelationBucket;
  map.set(nodeId, next);
  return next;
}

function addNodeRelationBuckets(
  byNodeId: Map<string, ProjectMapNodeRelationBucket>,
  indexedRelation: ProjectMapIndexedRelation,
): void {
  const relation = indexedRelation.relation;
  getOrCreateNodeBucket(byNodeId, relation.sourceNodeId).outgoing.push(indexedRelation);
  getOrCreateNodeBucket(byNodeId, relation.targetNodeId).incoming.push(indexedRelation);
  if (relation.direction === "bidirectional") {
    getOrCreateNodeBucket(byNodeId, relation.sourceNodeId).incoming.push(indexedRelation);
    getOrCreateNodeBucket(byNodeId, relation.targetNodeId).outgoing.push(indexedRelation);
  }
}

function toCounts(map: Map<string, ProjectMapIndexedRelation[]>): ProjectMapRelationCount[] {
  return [...map.entries()]
    .map(([key, relations]) => ({ key, count: relations.length }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function compareIndexedRelations(left: ProjectMapIndexedRelation, right: ProjectMapIndexedRelation): number {
  if (left.relation.type !== right.relation.type) {
    return String(left.relation.type).localeCompare(String(right.relation.type));
  }
  return left.relation.id.localeCompare(right.relation.id);
}

export function buildProjectMapRelationIndex(dataset: ProjectMapDataset): ProjectMapRelationIndex {
  const nodeIndex = new Map(dataset.nodes.map((node) => [node.id, node]));
  const seenRelationIds = new Set<string>();
  const duplicateRelationIds = new Set<string>();
  const byNodeId = new Map<string, ProjectMapNodeRelationBucket>();
  const byType = new Map<ProjectMapRelationType, ProjectMapIndexedRelation[]>();
  const bySourceKind = new Map<ProjectMapRelationSourceKind, ProjectMapIndexedRelation[]>();
  const degradedIssues: ProjectMapGraphIntegrityIssue[] = [];

  const relations = (dataset.relations ?? []).map((relation): ProjectMapIndexedRelation => {
    const duplicate = seenRelationIds.has(relation.id);
    if (duplicate) {
      duplicateRelationIds.add(relation.id);
      degradedIssues.push({
        id: `duplicate-relation:${relation.id}`,
        kind: "stale-relation",
        severity: "warning",
        label: `Duplicate relation id: ${relation.id}`,
        relationId: relation.id,
      });
    }
    seenRelationIds.add(relation.id);

    const sourceNode = nodeIndex.get(relation.sourceNodeId) ?? null;
    const targetNode = nodeIndex.get(relation.targetNodeId) ?? null;
    if (!sourceNode) {
      degradedIssues.push({
        id: `missing-relation-source:${relation.id}`,
        kind: "missing-relation-source",
        severity: "warning",
        label: `Missing relation source: ${relation.sourceNodeId}`,
        relationId: relation.id,
      });
    }
    if (!targetNode) {
      degradedIssues.push({
        id: `missing-relation-target:${relation.id}`,
        kind: "missing-relation-target",
        severity: "warning",
        label: `Missing relation target: ${relation.targetNodeId}`,
        relationId: relation.id,
      });
    }

    return {
      relation,
      source: { nodeId: relation.sourceNodeId, node: sourceNode, missing: !sourceNode },
      target: { nodeId: relation.targetNodeId, node: targetNode, missing: !targetNode },
      degraded: !sourceNode || !targetNode,
      duplicate,
    };
  });

  for (const indexedRelation of relations) {
    addNodeRelationBuckets(byNodeId, indexedRelation);
    incrementRelationMap(byType, indexedRelation.relation.type, indexedRelation);
    incrementRelationMap(bySourceKind, indexedRelation.relation.sourceKind, indexedRelation);
  }

  for (const bucket of byNodeId.values()) {
    bucket.incoming.sort(compareIndexedRelations);
    bucket.outgoing.sort(compareIndexedRelations);
  }

  return {
    relations: [...relations].sort(compareIndexedRelations),
    byNodeId,
    byType,
    bySourceKind,
    typeCounts: toCounts(byType as Map<string, ProjectMapIndexedRelation[]>),
    sourceKindCounts: toCounts(bySourceKind as Map<string, ProjectMapIndexedRelation[]>),
    degradedIssues,
    duplicateRelationIds: [...duplicateRelationIds].sort(),
  };
}

export function filterProjectMapRelations(input: {
  relationIndex: ProjectMapRelationIndex;
  selectedNodeId?: string | null;
  typeFilter?: string;
  sourceKindFilter?: string;
  directionFilter?: ProjectMapRelationDirectionFilter;
}): ProjectMapIndexedRelation[] {
  const typeFilter = input.typeFilter?.trim() ?? "all";
  const sourceKindFilter = input.sourceKindFilter?.trim() ?? "all";
  const directionFilter = input.directionFilter ?? "all";
  return input.relationIndex.relations.filter((indexedRelation) => {
    const relation = indexedRelation.relation;
    const matchesType = typeFilter === "all" || relation.type === typeFilter;
    const matchesSourceKind = sourceKindFilter === "all" || relation.sourceKind === sourceKindFilter;
    const matchesDirection = (() => {
      if (!input.selectedNodeId) {
        return true;
      }
      if (directionFilter === "all") {
        return relation.sourceNodeId === input.selectedNodeId || relation.targetNodeId === input.selectedNodeId;
      }
      if (directionFilter === "incoming") {
        return relation.targetNodeId === input.selectedNodeId || (relation.direction === "bidirectional" && relation.sourceNodeId === input.selectedNodeId);
      }
      return relation.sourceNodeId === input.selectedNodeId || (relation.direction === "bidirectional" && relation.targetNodeId === input.selectedNodeId);
    })();
    return matchesType && matchesSourceKind && matchesDirection;
  });
}
