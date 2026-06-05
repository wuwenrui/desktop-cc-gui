import type {
  ProjectMapActivityProjection,
  ProjectMapAdvisorHint,
  ProjectMapDataset,
  ProjectMapGroupedQueryResults,
  ProjectMapHighlightItemState,
  ProjectMapHighlightProjection,
  ProjectMapHighlightSource,
  ProjectMapQuickFilterId,
  ProjectMapRelation,
} from "../types";
import type { ProjectMapPathResult } from "./navigation";

const HIGHLIGHT_PRIORITY: Record<ProjectMapHighlightSource, number> = {
  selected: 70,
  path: 60,
  search: 50,
  "activity-changed": 45,
  "activity-affected": 40,
  advisor: 35,
  filter: 30,
  base: 10,
};

function stringSet(values: Iterable<string | null | undefined> = []): Set<string> {
  const result = new Set<string>();
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      result.add(normalized);
    }
  }
  return result;
}

function addAll(target: Set<string>, values: Iterable<string>): void {
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      target.add(normalized);
    }
  }
}

function relationsForNodes(relations: ProjectMapRelation[], nodeIds: Set<string>): string[] {
  if (nodeIds.size === 0) {
    return [];
  }
  return relations
    .filter((relation) => nodeIds.has(relation.sourceNodeId) || nodeIds.has(relation.targetNodeId))
    .map((relation) => relation.id);
}

function buildFilterSets(input: {
  dataset: ProjectMapDataset;
  activityProjection?: ProjectMapActivityProjection;
  quickFilters?: Iterable<ProjectMapQuickFilterId>;
}): { nodeIds: Set<string>; relationIds: Set<string> } {
  const activeFilters = new Set(input.quickFilters ?? []);
  const nodeIds = new Set<string>();
  const relationIds = new Set<string>();
  const relations = input.dataset.relations ?? [];

  if (activeFilters.has("changed") && input.activityProjection) {
    addAll(nodeIds, input.activityProjection.changedNodeIds);
  }
  if (activeFilters.has("affected") && input.activityProjection) {
    addAll(nodeIds, input.activityProjection.affectedNodeIds);
  }
  if (activeFilters.has("stale")) {
    addAll(nodeIds, input.dataset.nodes.filter((node) => node.stale || (node.staleReasons?.length ?? 0) > 0).map((node) => node.id));
    addAll(relationIds, relations.filter((relation) => relation.stale).map((relation) => relation.id));
  }
  if (activeFilters.has("candidate")) {
    addAll(nodeIds, input.dataset.nodes.filter((node) => node.candidate).map((node) => node.id));
    addAll(
      nodeIds,
      (input.dataset.candidates ?? [])
        .filter((candidate) => candidate.status === "pending")
        .flatMap((candidate) => [candidate.targetNodeId ?? "", candidate.move?.nodeId ?? ""]),
    );
  }
  if (activeFilters.has("low-confidence")) {
    addAll(nodeIds, input.dataset.nodes.filter((node) => node.confidence === "low" || node.confidence === "unknown").map((node) => node.id));
    addAll(relationIds, relations.filter((relation) => relation.confidence === "low" || relation.confidence === "unknown").map((relation) => relation.id));
  }
  if (activeFilters.has("inferred-relations")) {
    addAll(relationIds, relations.filter((relation) => relation.sourceKind === "llm-inferred").map((relation) => relation.id));
  }

  addAll(relationIds, relationsForNodes(relations, nodeIds));
  return { nodeIds, relationIds };
}

function buildStates(
  sourcesById: Map<string, Set<ProjectMapHighlightSource>>,
): Map<string, ProjectMapHighlightItemState> {
  const states = new Map<string, ProjectMapHighlightItemState>();
  for (const [id, sources] of sourcesById.entries()) {
    const orderedSources = [...sources].sort(
      (left, right) => HIGHLIGHT_PRIORITY[right] - HIGHLIGHT_PRIORITY[left] || left.localeCompare(right),
    );
    const primary = orderedSources[0] ?? "base";
    states.set(id, {
      id,
      primary,
      sources: orderedSources,
      priority: HIGHLIGHT_PRIORITY[primary],
    });
  }
  return states;
}

function addStateSource(
  target: Map<string, Set<ProjectMapHighlightSource>>,
  ids: Iterable<string>,
  source: ProjectMapHighlightSource,
): void {
  for (const id of ids) {
    const current = target.get(id) ?? new Set<ProjectMapHighlightSource>();
    current.add(source);
    target.set(id, current);
  }
}

export function getProjectMapHighlightPriority(source: ProjectMapHighlightSource): number {
  return HIGHLIGHT_PRIORITY[source];
}

export function buildProjectMapHighlightProjection(input: {
  dataset: ProjectMapDataset;
  selectedNodeId?: string | null;
  selectedRelationId?: string | null;
  pathResult?: ProjectMapPathResult;
  queryResults?: ProjectMapGroupedQueryResults;
  activityProjection?: ProjectMapActivityProjection;
  advisorHints?: ProjectMapAdvisorHint[];
  quickFilters?: Iterable<ProjectMapQuickFilterId>;
  baseNodeIds?: Iterable<string>;
  baseRelationIds?: Iterable<string>;
}): ProjectMapHighlightProjection {
  const selectedNodeIds = stringSet([input.selectedNodeId]);
  const selectedRelationIds = stringSet([input.selectedRelationId]);
  const pathNodeIds = stringSet(input.pathResult?.status === "found" ? input.pathResult.steps.map((step) => step.node.id) : []);
  const pathRelationIds = stringSet(
    input.pathResult?.status === "found"
      ? input.pathResult.steps.flatMap((step) => step.relation?.id ?? [])
      : [],
  );
  const searchNodeIds = stringSet(input.queryResults?.nodeIds ?? []);
  const activityChangedNodeIds = stringSet(input.activityProjection?.changedNodeIds ?? []);
  const activityAffectedNodeIds = stringSet(input.activityProjection?.affectedNodeIds ?? []);
  const advisorNodeIds = stringSet((input.advisorHints ?? []).flatMap((hint) => hint.nodeIds));
  const advisorRelationIds = stringSet((input.advisorHints ?? []).flatMap((hint) => hint.relationIds));
  const filterSets = buildFilterSets({
    dataset: input.dataset,
    activityProjection: input.activityProjection,
    quickFilters: input.quickFilters,
  });
  const baseNodeIds = stringSet(input.baseNodeIds ?? input.dataset.nodes.map((node) => node.id));
  const baseRelationIds = stringSet(input.baseRelationIds ?? (input.dataset.relations ?? []).map((relation) => relation.id));

  const nodeSourcesById = new Map<string, Set<ProjectMapHighlightSource>>();
  const relationSourcesById = new Map<string, Set<ProjectMapHighlightSource>>();

  addStateSource(nodeSourcesById, baseNodeIds, "base");
  addStateSource(relationSourcesById, baseRelationIds, "base");
  addStateSource(nodeSourcesById, filterSets.nodeIds, "filter");
  addStateSource(relationSourcesById, filterSets.relationIds, "filter");
  addStateSource(nodeSourcesById, advisorNodeIds, "advisor");
  addStateSource(relationSourcesById, advisorRelationIds, "advisor");
  addStateSource(nodeSourcesById, activityAffectedNodeIds, "activity-affected");
  addStateSource(nodeSourcesById, activityChangedNodeIds, "activity-changed");
  addStateSource(nodeSourcesById, searchNodeIds, "search");
  addStateSource(nodeSourcesById, pathNodeIds, "path");
  addStateSource(relationSourcesById, pathRelationIds, "path");
  addStateSource(nodeSourcesById, selectedNodeIds, "selected");
  addStateSource(relationSourcesById, selectedRelationIds, "selected");

  return {
    selectedNodeIds,
    selectedRelationIds,
    pathNodeIds,
    pathRelationIds,
    searchNodeIds,
    activityChangedNodeIds,
    activityAffectedNodeIds,
    advisorNodeIds,
    advisorRelationIds,
    filterNodeIds: filterSets.nodeIds,
    filterRelationIds: filterSets.relationIds,
    baseNodeIds,
    baseRelationIds,
    nodeStates: buildStates(nodeSourcesById),
    relationStates: buildStates(relationSourcesById),
  };
}
