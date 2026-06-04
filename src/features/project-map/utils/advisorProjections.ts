import type {
  ProjectMapActivityProjection,
  ProjectMapAdvisorHint,
  ProjectMapDataset,
  ProjectMapGroupedQueryResults,
  ProjectMapImpactResult,
  ProjectMapNode,
  ProjectMapRelation,
} from "../types";
import { buildProjectMapContextPack, buildProjectMapExplainPack } from "./contextBuilder";
import { validateProjectMapGraphIntegrity } from "./graphIntegrity";
import { buildProjectMapImpactAnalysis } from "./impactAnalysis";
import {
  buildProjectMapBoundedPreview,
  capProjectMapProjectionItems,
  normalizeProjectMapProjectionPath,
  uniqueProjectMapStrings,
} from "./projectionGuards";

function advisorHint(input: ProjectMapAdvisorHint): ProjectMapAdvisorHint {
  return {
    ...input,
    nodeIds: uniqueProjectMapStrings(input.nodeIds),
    relationIds: uniqueProjectMapStrings(input.relationIds),
    filePaths: uniqueProjectMapStrings(input.filePaths),
  };
}

function severityFromCounts(input: {
  staleCount?: number;
  lowConfidenceCount?: number;
  unmappedCount?: number;
  affectedCount?: number;
}): ProjectMapAdvisorHint["severity"] {
  if ((input.unmappedCount ?? 0) > 0 || (input.staleCount ?? 0) > 0 || (input.lowConfidenceCount ?? 0) > 0) {
    return "warning";
  }
  if ((input.affectedCount ?? 0) > 5) {
    return "risk";
  }
  return "info";
}

export function buildProjectMapDiffImpactAdvisor(input: {
  dataset: ProjectMapDataset;
  changedFilePaths?: string[];
  impact?: ProjectMapImpactResult;
}): ProjectMapAdvisorHint[] {
  const impact = input.impact ?? buildProjectMapImpactAnalysis({
    dataset: input.dataset,
    changedFilePaths: input.changedFilePaths ?? [],
    source: input.changedFilePaths
      ? { kind: "explicit", label: "explicit changed-file input", fileCount: input.changedFilePaths.length }
      : undefined,
  });
  if (impact.inputFiles.length === 0) {
    return [
      advisorHint({
        id: "advisor:diff-impact:unavailable",
        kind: "diff-impact",
        title: "No changed-file input",
        summary: "Recent file changes are unavailable, so Project Map can only show map-derived activity.",
        nodeIds: [],
        relationIds: [],
        filePaths: [],
        severity: "info",
        deterministic: true,
        degraded: true,
      }),
    ];
  }
  return [
    advisorHint({
      id: "advisor:diff-impact:summary",
      kind: "diff-impact",
      title: `${impact.riskSummary.changedCount} changed node(s), ${impact.riskSummary.affectedCount} affected`,
      summary: [
        `${impact.inputFiles.length} changed file(s) were checked against Project Map.`,
        impact.unmappedFiles.length > 0 ? `${impact.unmappedFiles.length} changed file(s) are unmapped.` : "",
        impact.riskSummary.staleCount > 0 ? `${impact.riskSummary.staleCount} stale item(s) are in the blast radius.` : "",
      ].filter(Boolean).join(" "),
      nodeIds: [
        ...impact.changedNodes.map((item) => item.node.id),
        ...impact.affectedNodes.map((item) => item.node.id),
      ],
      relationIds: [
        ...impact.changedNodes.flatMap((item) => item.relationIds),
        ...impact.affectedNodes.flatMap((item) => item.relationIds),
      ],
      filePaths: impact.inputFiles,
      severity: severityFromCounts(impact.riskSummary),
      deterministic: true,
      degraded: impact.unmappedFiles.length > 0,
    }),
  ];
}

export function buildProjectMapQueryNeighborhoodAdvisor(input: {
  dataset: ProjectMapDataset;
  queryResults: ProjectMapGroupedQueryResults;
  limit?: number;
}): ProjectMapAdvisorHint[] {
  const nodeIds = new Set(input.queryResults.nodeIds);
  if (nodeIds.size === 0) {
    return input.queryResults.groups.length > 0
      ? [
          advisorHint({
            id: "advisor:query-neighborhood:degraded",
            kind: "query-neighborhood",
            title: "Query matched non-node context",
            summary: "The query matched files, relations, activity, or stale reasons that do not all map to graph nodes.",
            nodeIds: [],
            relationIds: [...input.queryResults.relationIds],
            filePaths: [...input.queryResults.filePaths],
            severity: "info",
            deterministic: true,
            degraded: true,
          }),
        ]
      : [];
  }

  const context = buildProjectMapContextPack({
    dataset: input.dataset,
    query: input.queryResults.query,
    maxMatches: input.limit ?? 8,
  });
  const relatedNodes = capProjectMapProjectionItems(context.relatedNodes, input.limit ?? 8);
  return [
    advisorHint({
      id: `advisor:query-neighborhood:${input.queryResults.query.trim() || "query"}`,
      kind: "query-neighborhood",
      title: `${context.matchedNodes.length} matched, ${relatedNodes.totalCount} nearby`,
      summary: buildProjectMapBoundedPreview(
        relatedNodes.items.length > 0
          ? `Nearby context: ${relatedNodes.items.map((node) => node.title).join(", ")}`
          : "No one-hop graph neighborhood found for the current query.",
      ),
      nodeIds: [...context.matchedNodes, ...relatedNodes.items].map((node) => node.id),
      relationIds: context.relations.map((relation) => relation.id),
      filePaths: context.evidenceSources.flatMap((source) => source.path ?? []),
      severity: context.riskFlags.some((flag) => flag.severity !== "info") ? "warning" : "info",
      deterministic: true,
      degraded: relatedNodes.capped,
    }),
  ];
}

export function buildProjectMapNodeExplainAdvisor(input: {
  dataset: ProjectMapDataset;
  nodeId: string | null | undefined;
}): ProjectMapAdvisorHint[] {
  const nodeId = input.nodeId?.trim() ?? "";
  if (!nodeId) {
    return [];
  }
  const explainPack = buildProjectMapExplainPack({ dataset: input.dataset, nodeId });
  if (!explainPack) {
    return [
      advisorHint({
        id: `advisor:node-explain:${nodeId}:missing`,
        kind: "node-explain",
        title: "Selected node is unavailable",
        summary: `Node ${nodeId} is not present in the current Project Map dataset.`,
        nodeIds: [],
        relationIds: [],
        filePaths: [],
        severity: "warning",
        deterministic: true,
        degraded: true,
      }),
    ];
  }
  const riskCount = explainPack.riskFlags.length;
  return [
    advisorHint({
      id: `advisor:node-explain:${nodeId}`,
      kind: "node-explain",
      title: explainPack.focusNode.title,
      summary: buildProjectMapBoundedPreview(
        [
          explainPack.focusNode.summary,
          `${explainPack.childNodes.length} child node(s), ${explainPack.relations.length} relation(s), ${explainPack.evidenceSources.length} evidence source(s).`,
          riskCount > 0 ? `${riskCount} risk flag(s) need review.` : "",
        ].filter(Boolean).join(" "),
      ),
      nodeIds: [
        explainPack.focusNode.id,
        ...explainPack.childNodes.map((node) => node.id),
        ...explainPack.relatedNodes.map((node) => node.id),
      ],
      relationIds: explainPack.relations.map((relation) => relation.id),
      filePaths: explainPack.evidenceSources.flatMap((source) => source.path ?? []),
      severity: riskCount > 0 ? "warning" : "info",
      deterministic: true,
      degraded: explainPack.focusNode.confidence === "unknown",
    }),
  ];
}

function nodeDegree(relations: ProjectMapRelation[], nodeId: string): { fanIn: number; fanOut: number } {
  let fanIn = 0;
  let fanOut = 0;
  for (const relation of relations) {
    if (relation.targetNodeId === nodeId) fanIn += 1;
    if (relation.sourceNodeId === nodeId) fanOut += 1;
    if (relation.direction === "bidirectional") {
      if (relation.sourceNodeId === nodeId) fanIn += 1;
      if (relation.targetNodeId === nodeId) fanOut += 1;
    }
  }
  return { fanIn, fanOut };
}

function guideScore(node: ProjectMapNode, relations: ProjectMapRelation[]): number {
  const degree = nodeDegree(relations, node.id);
  const entryBonus = /(^|[/_-])(readme|index|main|app|server|root|overview)([/_.-]|$)/i.test(
    `${node.title} ${node.sources.map((source) => source.path ?? source.label).join(" ")}`,
  ) ? 4 : 0;
  const rootBonus = node.parentId ? 0 : 3;
  const evidenceBonus = Math.min(node.sources.length, 3);
  return entryBonus + rootBonus + evidenceBonus + degree.fanIn + degree.fanOut;
}

export function buildProjectMapGuideTopologyAdvisor(input: {
  dataset: ProjectMapDataset;
  limit?: number;
}): ProjectMapAdvisorHint[] {
  const relations = input.dataset.relations ?? [];
  const rankedNodes = [...input.dataset.nodes]
    .sort((left, right) => guideScore(right, relations) - guideScore(left, relations) || left.title.localeCompare(right.title));
  const capped = capProjectMapProjectionItems(rankedNodes, input.limit ?? 5);
  if (capped.items.length === 0) {
    return [];
  }
  return [
    advisorHint({
      id: "advisor:guide-topology:next-nodes",
      kind: "guide-topology",
      title: "Suggested nodes to inspect",
      summary: buildProjectMapBoundedPreview(capped.items.map((node) => node.title).join(" -> ")),
      nodeIds: capped.items.map((node) => node.id),
      relationIds: relations
        .filter((relation) =>
          capped.items.some((node) => node.id === relation.sourceNodeId || node.id === relation.targetNodeId),
        )
        .map((relation) => relation.id),
      filePaths: capped.items.flatMap((node) => node.sources.flatMap((source) => source.path ?? [])),
      severity: "info",
      deterministic: true,
      degraded: capped.capped,
    }),
  ];
}

export function buildProjectMapGraphHealthAdvisor(input: {
  dataset: ProjectMapDataset;
}): ProjectMapAdvisorHint[] {
  const integrityIssues = validateProjectMapGraphIntegrity(input.dataset);
  const lowConfidenceRelations = (input.dataset.relations ?? []).filter(
    (relation) => relation.confidence === "low" || relation.confidence === "unknown" || relation.sourceKind === "llm-inferred",
  );
  const degradedPaths = [
    ...input.dataset.nodes.flatMap((node) => node.sources.flatMap((source) => {
      const normalized = normalizeProjectMapProjectionPath(source);
      return normalized.degraded ? [normalized.displayPath] : [];
    })),
  ];
  const warnings = [
    ...integrityIssues.filter((issue) => issue.severity !== "info"),
    ...lowConfidenceRelations.map((relation) => ({
      id: `relation:${relation.id}:confidence`,
      relationId: relation.id,
      nodeId: undefined,
      label: `${relation.type} relation needs confidence review`,
    })),
  ];
  if (warnings.length === 0 && degradedPaths.length === 0) {
    return [];
  }
  return [
    advisorHint({
      id: "advisor:graph-health:warnings",
      kind: "graph-health",
      title: `${warnings.length + degradedPaths.length} graph health warning(s)`,
      summary: buildProjectMapBoundedPreview(
        [
          ...warnings.map((warning) => warning.label),
          degradedPaths.length > 0 ? `${degradedPaths.length} degraded path reference(s)` : "",
        ].filter(Boolean).join(" "),
      ),
      nodeIds: warnings.flatMap((warning) => warning.nodeId ?? []),
      relationIds: warnings.flatMap((warning) => warning.relationId ?? []),
      filePaths: degradedPaths,
      severity: "warning",
      deterministic: true,
      degraded: degradedPaths.length > 0,
    }),
  ];
}

export function buildProjectMapAdvisorHints(input: {
  dataset: ProjectMapDataset;
  activityProjection?: ProjectMapActivityProjection;
  queryResults?: ProjectMapGroupedQueryResults;
  selectedNodeId?: string | null;
  changedFilePaths?: string[];
  limit?: number;
}): ProjectMapAdvisorHint[] {
  return [
    ...buildProjectMapDiffImpactAdvisor({
      dataset: input.dataset,
      changedFilePaths: input.changedFilePaths,
    }),
    ...(input.queryResults
      ? buildProjectMapQueryNeighborhoodAdvisor({
          dataset: input.dataset,
          queryResults: input.queryResults,
          limit: input.limit,
        })
      : []),
    ...buildProjectMapNodeExplainAdvisor({
      dataset: input.dataset,
      nodeId: input.selectedNodeId,
    }),
    ...buildProjectMapGuideTopologyAdvisor({
      dataset: input.dataset,
      limit: input.limit,
    }),
    ...buildProjectMapGraphHealthAdvisor({ dataset: input.dataset }),
    ...(input.activityProjection?.degraded
      ? [
          advisorHint({
            id: "advisor:activity:degraded",
            kind: "diff-impact",
            title: "Some activity is degraded",
            summary: "Recent activity contains unmapped or unavailable context.",
            nodeIds: [...input.activityProjection.changedNodeIds, ...input.activityProjection.affectedNodeIds],
            relationIds: [...input.activityProjection.relationIds],
            filePaths: [...input.activityProjection.filePaths],
            severity: "warning",
            deterministic: true,
            degraded: true,
          }),
        ]
      : []),
  ];
}
