import type {
  ProjectMapActivityGroup,
  ProjectMapActivityItem,
  ProjectMapActivityProjection,
  ProjectMapActivitySourceCategory,
  ProjectMapDataset,
  ProjectMapImpactResult,
  ProjectMapImpactSourceMetadata,
  ProjectMapNode,
  ProjectMapRunMetadata,
} from "../types";
import { buildProjectMapImpactAnalysis } from "./impactAnalysis";
import {
  capProjectMapProjectionItems,
  normalizeProjectMapProjectionPath,
  uniqueProjectMapStrings,
} from "./projectionGuards";

const ACTIVITY_GROUP_TITLES: Record<ProjectMapActivitySourceCategory, string> = {
  "changed-files": "Changed files",
  "map-runs": "Project Map runs",
  "stale-state": "Stale map state",
  "candidate-state": "Review candidates",
  "evidence-state": "Evidence state",
  degraded: "Unavailable activity",
};

function confidenceForNodes(nodes: ProjectMapNode[]): ProjectMapActivityItem["confidence"] {
  if (nodes.some((node) => node.confidence === "unknown")) return "unknown";
  if (nodes.some((node) => node.confidence === "low")) return "low";
  if (nodes.some((node) => node.confidence === "medium")) return "medium";
  return "high";
}

function latestRunTime(run: ProjectMapRunMetadata): string {
  return run.completedAt ?? run.startedAt;
}

function activityItem(input: ProjectMapActivityItem): ProjectMapActivityItem {
  return {
    ...input,
    nodeIds: uniqueProjectMapStrings(input.nodeIds),
    relationIds: uniqueProjectMapStrings(input.relationIds),
    filePaths: uniqueProjectMapStrings(input.filePaths),
    lensIds: uniqueProjectMapStrings(input.lensIds),
  };
}

function buildChangedFileActivity(input: {
  impact: ProjectMapImpactResult;
  now: string;
}): ProjectMapActivityItem[] {
  const { impact, now } = input;
  if (impact.inputFiles.length === 0) {
    return [
      activityItem({
        id: "activity:changed-files:unavailable",
        kind: "git-change",
        sourceCategory: "degraded",
        title: "No changed-file input",
        summary: "Project Map does not currently have changed-file input for this view.",
        occurredAt: now,
        nodeIds: [],
        relationIds: [],
        filePaths: [],
        lensIds: [],
        confidence: "unknown",
        sourceRefs: [],
        deterministic: true,
        degraded: true,
      }),
    ];
  }

  const changedNodes = impact.changedNodes.map((item) => item.node);
  const affectedNodes = impact.affectedNodes.map((item) => item.node);
  const impactedRelations = uniqueProjectMapStrings([
    ...impact.changedNodes.flatMap((item) => item.relationIds),
    ...impact.affectedNodes.flatMap((item) => item.relationIds),
  ]);
  return [
    activityItem({
      id: "activity:changed-files:impact",
      kind: "git-change",
      sourceCategory: "changed-files",
      title: `${impact.riskSummary.changedCount} changed, ${impact.riskSummary.affectedCount} affected`,
      summary: [
        `${impact.inputFiles.length} changed file(s) were projected onto Project Map.`,
        impact.unmappedFiles.length > 0 ? `${impact.unmappedFiles.length} file(s) are unmapped.` : "",
      ].filter(Boolean).join(" "),
      occurredAt: impact.source?.label ?? now,
      nodeIds: [...changedNodes, ...affectedNodes].map((node) => node.id),
      relationIds: impactedRelations,
      filePaths: [
        ...impact.inputFiles.map((path) => normalizeProjectMapProjectionPath({ path }).workspaceRelativePath ?? path),
      ],
      lensIds: impact.affectedLensIds,
      confidence: confidenceForNodes([...changedNodes, ...affectedNodes]),
      sourceRefs: [],
      deterministic: true,
      degraded: impact.unmappedFiles.length > 0,
    }),
  ];
}

function buildRunActivity(dataset: ProjectMapDataset, limit: number): ProjectMapActivityItem[] {
  return [...dataset.runs]
    .sort((left, right) => latestRunTime(right).localeCompare(latestRunTime(left)))
    .slice(0, limit)
    .map((run) =>
      activityItem({
        id: `activity:run:${run.id}`,
        kind: "project-map-run",
        sourceCategory: "map-runs",
        title: `${run.kind} ${run.status}`,
        summary: run.error ?? `${run.scope} run via ${run.engine}/${run.model}`,
        occurredAt: latestRunTime(run),
        nodeIds: run.requestScope?.kind === "node" ? [run.requestScope.nodeId] : [],
        relationIds: [],
        filePaths: (run.readSources ?? []).flatMap((source) => source.path ?? []),
        lensIds: run.requestScope?.kind === "global" ? run.requestScope.lensIds : [],
        confidence: run.status === "failed" ? "low" : "medium",
        sourceRefs: run.readSources ?? [],
        deterministic: true,
        degraded: run.status === "failed" || run.status === "cancelled",
      }),
    );
}

function buildStaleActivity(dataset: ProjectMapDataset, now: string): ProjectMapActivityItem[] {
  const staleNodes = dataset.nodes.filter((node) => node.stale || (node.staleReasons?.length ?? 0) > 0);
  if (staleNodes.length === 0) {
    return [];
  }
  return [
    activityItem({
      id: "activity:stale:nodes",
      kind: "stale",
      sourceCategory: "stale-state",
      title: `${staleNodes.length} stale node(s)`,
      summary: "These nodes have stale markers or refresh reasons and may need review.",
      occurredAt: dataset.refreshState?.evaluatedAt ?? dataset.manifest.updatedAt ?? now,
      nodeIds: staleNodes.map((node) => node.id),
      relationIds: uniqueProjectMapStrings(staleNodes.flatMap((node) => node.staleReasons?.flatMap((reason) => reason.relationId ?? []) ?? [])),
      filePaths: uniqueProjectMapStrings(staleNodes.flatMap((node) => node.staleReasons?.flatMap((reason) => reason.path ?? []) ?? [])),
      lensIds: staleNodes.map((node) => node.lensId),
      confidence: confidenceForNodes(staleNodes),
      sourceRefs: staleNodes.flatMap((node) => node.sources),
      deterministic: true,
      degraded: staleNodes.some((node) => node.confidence === "unknown"),
    }),
  ];
}

function buildCandidateActivity(dataset: ProjectMapDataset, now: string): ProjectMapActivityItem[] {
  const candidates = (dataset.candidates ?? []).filter((candidate) => candidate.status === "pending");
  if (candidates.length === 0) {
    return [];
  }
  return [
    activityItem({
      id: "activity:candidates:pending",
      kind: "candidate",
      sourceCategory: "candidate-state",
      title: `${candidates.length} pending candidate(s)`,
      summary: "Project Map has review candidates waiting for confirmation or rejection.",
      occurredAt: candidates.map((candidate) => candidate.updatedAt).sort().at(-1) ?? now,
      nodeIds: candidates.flatMap((candidate) => candidate.targetNodeId ?? candidate.move?.nodeId ?? []),
      relationIds: [],
      filePaths: candidates.flatMap((candidate) => candidate.evidence.flatMap((record) => record.source.path ?? [])),
      lensIds: candidates.map((candidate) => candidate.targetLensId),
      confidence: confidenceForNodes(
        candidates.flatMap((candidate) =>
          dataset.nodes.filter((node) => node.id === candidate.targetNodeId || node.id === candidate.move?.nodeId),
        ),
      ),
      sourceRefs: candidates.flatMap((candidate) => candidate.evidence.map((record) => record.source)),
      deterministic: true,
    }),
  ];
}

function buildEvidenceActivity(dataset: ProjectMapDataset, now: string): ProjectMapActivityItem[] {
  const evidenceRecords = dataset.evidenceRecords ?? [];
  if (evidenceRecords.length === 0) {
    return [];
  }
  return [
    activityItem({
      id: "activity:evidence:records",
      kind: "evidence",
      sourceCategory: "evidence-state",
      title: `${evidenceRecords.length} evidence record(s)`,
      summary: "Evidence records are available for reverse lookup and context explanation.",
      occurredAt: evidenceRecords.map((record) => record.observedAt).sort().at(-1) ?? now,
      nodeIds: [],
      relationIds: [],
      filePaths: evidenceRecords.flatMap((record) => record.source.path ?? []),
      lensIds: [],
      confidence: "medium",
      sourceRefs: evidenceRecords.map((record) => record.source),
      deterministic: true,
    }),
  ];
}

function groupActivityItems(items: ProjectMapActivityItem[], limit: number): ProjectMapActivityGroup[] {
  const byCategory = new Map<ProjectMapActivitySourceCategory, ProjectMapActivityItem[]>();
  for (const item of items) {
    const current = byCategory.get(item.sourceCategory) ?? [];
    current.push(item);
    byCategory.set(item.sourceCategory, current);
  }
  return [...byCategory.entries()].map(([category, categoryItems]) => {
    const capped = capProjectMapProjectionItems(
      [...categoryItems].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
      limit,
    );
    return {
      id: category,
      title: ACTIVITY_GROUP_TITLES[category],
      items: capped.items,
      degraded: capped.items.some((item) => item.degraded),
    };
  });
}

export function buildProjectMapActivityProjection(input: {
  dataset: ProjectMapDataset;
  changedFilePaths?: string[];
  source?: ProjectMapImpactSourceMetadata;
  now?: string;
  groupLimit?: number;
}): ProjectMapActivityProjection {
  const now = input.now ?? new Date().toISOString();
  const changedFilePaths = input.changedFilePaths ?? [];
  const impact = buildProjectMapImpactAnalysis({
    dataset: input.dataset,
    changedFilePaths,
    source: input.source,
  });
  const items = [
    ...buildChangedFileActivity({ impact, now }),
    ...buildRunActivity(input.dataset, input.groupLimit ?? 5),
    ...buildStaleActivity(input.dataset, now),
    ...buildCandidateActivity(input.dataset, now),
    ...buildEvidenceActivity(input.dataset, now),
  ];
  const changedNodeIds = new Set(impact.changedNodes.map((item) => item.node.id));
  const affectedNodeIds = new Set(impact.affectedNodes.map((item) => item.node.id));

  return {
    groups: groupActivityItems(items, input.groupLimit ?? 8),
    items,
    changedNodeIds,
    affectedNodeIds,
    relationIds: new Set(items.flatMap((item) => item.relationIds)),
    filePaths: new Set(items.flatMap((item) => item.filePaths)),
    degraded: items.some((item) => item.degraded),
  };
}
