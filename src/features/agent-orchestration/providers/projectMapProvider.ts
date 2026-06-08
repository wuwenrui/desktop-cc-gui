import type {
  ProjectMapDataset,
  ProjectMapNode,
  ProjectMapRelatedArtifact,
  ProjectMapRelationshipAgentReadPlan,
  ProjectMapSource,
} from "../../project-map/types";
import type { OrchestrationRiskMarker, OrchestrationSourceRef, OrchestrationTask } from "../types";
import { createOrchestrationSourceRef } from "../utils/sourceRefs";
import { createOrchestrationTask } from "../utils/taskStore";

function sourceKindFromProjectMapSource(source: ProjectMapSource | ProjectMapRelatedArtifact): string {
  if (source.type === "spec" || source.type === "task" || source.type === "document") {
    return source.type;
  }
  if (source.type === "test" || source.type === "commit" || source.type === "conversation") {
    return source.type;
  }
  return "file";
}

function buildEvidenceRefs(input: {
  node: ProjectMapNode;
  workspacePath?: string | null;
}): OrchestrationSourceRef[] {
  const sourceRefs = input.node.sources.map((source, index) =>
    createOrchestrationSourceRef({
      providerId: "project-map",
      kind: sourceKindFromProjectMapSource(source),
      id: `project-map:${input.node.id}:source:${index}`,
      label: source.label,
      path: source.path,
      workspacePath: input.workspacePath,
      confidence: input.node.confidence,
      stale: input.node.stale,
      capabilities: ["open_source"],
      metadata: {
        nodeId: input.node.id,
        sourceType: source.type,
        line: source.line ?? null,
      },
    }),
  );
  const artifactRefs = input.node.detail.relatedArtifacts.map((artifact, index) =>
    createOrchestrationSourceRef({
      providerId: "project-map",
      kind: sourceKindFromProjectMapSource(artifact),
      id: `project-map:${input.node.id}:artifact:${index}`,
      label: artifact.label,
      path: artifact.path ?? artifact.ref,
      workspacePath: input.workspacePath,
      confidence: input.node.confidence,
      stale: input.node.stale,
      capabilities: ["open_source"],
      metadata: {
        nodeId: input.node.id,
        sourceType: artifact.type,
        line: artifact.line ?? null,
      },
    }),
  );
  const diagramRefs = (input.node.detail.diagramArtifacts ?? []).flatMap((diagram): OrchestrationSourceRef[] => [
    createOrchestrationSourceRef({
      providerId: "project-map",
      kind: "document",
      id: `project-map:${input.node.id}:diagram:${diagram.id}`,
      label: diagram.label,
      path: diagram.path,
      workspacePath: input.workspacePath,
      confidence: input.node.confidence,
      stale: input.node.stale,
      capabilities: ["open_source"],
      metadata: {
        nodeId: input.node.id,
        diagramKind: diagram.kind ?? null,
      },
    }),
    ...(diagram.sourceRefs ?? []).map((sourceRef, index) =>
      createOrchestrationSourceRef({
        providerId: "project-map",
        kind: "file",
        id: `project-map:${input.node.id}:diagram:${diagram.id}:source:${index}`,
        label: sourceRef,
        path: sourceRef,
        workspacePath: input.workspacePath,
        confidence: input.node.confidence,
        stale: input.node.stale,
        capabilities: ["open_source"],
        metadata: {
          nodeId: input.node.id,
          diagramId: diagram.id,
        },
      }),
    ),
  ]);
  const refsByKey = new Map<string, OrchestrationSourceRef>();
  for (const ref of [...sourceRefs, ...artifactRefs, ...diagramRefs]) {
    refsByKey.set(`${ref.kind}:${ref.path ?? ""}:${ref.label}`, ref);
  }
  return [...refsByKey.values()];
}

function buildRiskMarkers(node: ProjectMapNode, evidenceRefs: OrchestrationSourceRef[]): OrchestrationRiskMarker[] {
  const risks: OrchestrationRiskMarker[] = [];
  if (node.stale) {
    risks.push({ kind: "stale_source", label: "Project Map node is stale", sourceRefId: node.id });
  }
  if (node.candidate) {
    risks.push({ kind: "candidate_source", label: "Project Map node is a candidate", sourceRefId: node.id });
  }
  if (node.confidence === "low") {
    risks.push({ kind: "low_confidence", label: "Project Map node confidence is low", sourceRefId: node.id });
  }
  if (node.confidence === "unknown") {
    risks.push({ kind: "unknown_confidence", label: "Project Map node confidence is unknown", sourceRefId: node.id });
  }
  if (evidenceRefs.length === 0) {
    risks.push({ kind: "missing_evidence", label: "Project Map node has no evidence refs", sourceRefId: node.id });
  }
  return risks;
}

function buildRelationshipContextEvidenceRefs(input: {
  contextPack: ProjectMapRelationshipAgentReadPlan;
  workspacePath?: string | null;
}): OrchestrationSourceRef[] {
  const paths = [
    ...input.contextPack.mustReadFiles.map((path) => ({ path, kind: "file", label: "must-read" })),
    ...input.contextPack.relatedFiles.map((path) => ({ path, kind: "file", label: "related" })),
    ...input.contextPack.testTargets.map((path) => ({ path, kind: "test", label: "test" })),
    ...input.contextPack.contracts.map((path) => ({ path, kind: "document", label: "contract" })),
  ];
  const refsByPath = new Map<string, OrchestrationSourceRef>();
  for (const item of paths) {
    if (refsByPath.has(item.path)) {
      continue;
    }
    refsByPath.set(item.path, createOrchestrationSourceRef({
      providerId: "project-map",
      kind: item.kind,
      id: `project-map:relationship:${input.contextPack.provenance.scanRunId}:${refsByPath.size}`,
      label: `${item.label}: ${item.path}`,
      path: item.path,
      workspacePath: input.workspacePath,
      confidence: input.contextPack.staleReason ? "medium" : "high",
      stale: Boolean(input.contextPack.staleReason),
      capabilities: ["open_source"],
      metadata: {
        scanRunId: input.contextPack.provenance.scanRunId,
        source: "project-map-relations",
      },
    }));
  }
  return [...refsByPath.values()].slice(0, 48);
}

export function buildProjectMapRelationshipContextTaskDraft(input: {
  workspaceId: string;
  contextPack: ProjectMapRelationshipAgentReadPlan | null | undefined;
  workspacePath?: string | null;
  now?: string;
}): OrchestrationTask | null {
  const contextPack = input.contextPack;
  if (
    !contextPack ||
    (
      contextPack.mustReadFiles.length === 0 &&
      contextPack.relatedFiles.length === 0 &&
      contextPack.testTargets.length === 0 &&
      contextPack.contracts.length === 0
    )
  ) {
    return null;
  }
  const sourceRef = createOrchestrationSourceRef({
    providerId: "project-map",
    kind: "project_map_context_pack",
    id: `project-map-context-pack:${contextPack.provenance.scanRunId}`,
    label: "Project Map relationship context pack",
    workspacePath: input.workspacePath,
    confidence: contextPack.staleReason ? "medium" : "high",
    stale: Boolean(contextPack.staleReason),
    capabilities: ["open_source", "create_task"],
    metadata: {
      scanRunId: contextPack.provenance.scanRunId,
      relationCount: contextPack.provenance.relationIds.length,
      fileCount: contextPack.provenance.fileIds.length,
    },
  });
  const evidenceRefs = buildRelationshipContextEvidenceRefs({
    contextPack,
    workspacePath: input.workspacePath,
  });
  const riskMarkers: OrchestrationRiskMarker[] = [
    ...(contextPack.staleReason
      ? [{ kind: "stale_source" as const, label: contextPack.staleReason, sourceRefId: sourceRef.id }]
      : []),
    ...contextPack.riskFlags.slice(0, 8).map((flag) => ({
      kind: "relationship_context_risk" as const,
      label: flag.label,
      sourceRefId: sourceRef.id,
    })),
  ];
  return createOrchestrationTask({
    taskId: `project-map-relationship-context-${contextPack.provenance.scanRunId}`,
    workspaceId: input.workspaceId,
    title: "Review Project Map relationship context",
    status: riskMarkers.length ? "candidate" : "planned",
    sourceRefs: [sourceRef],
    evidenceRefs,
    riskMarkers,
    scopeSummary:
      `Use Project Map relationship context pack: ${contextPack.mustReadFiles.length} must-read, ` +
      `${contextPack.relatedFiles.length} related, ${contextPack.testTargets.length} tests, ` +
      `${contextPack.contracts.length} contracts.`,
    acceptanceSummary: "Agent work uses relationship context-pack before any broad resource scan.",
    promptSummary: [
      "Prefer project-map-relations/context-packs/latest.json.",
      "Read mustReadFiles first, then relatedFiles, then tests/contracts.",
      contextPack.staleReason ? `Stale warning: ${contextPack.staleReason}` : "Context pack is fresh.",
    ].join("\n"),
    threadStrategy: "new_thread",
    now: input.now,
  });
}

export function buildProjectMapOrchestrationTaskDraft(input: {
  workspaceId: string;
  dataset: ProjectMapDataset;
  nodeId: string;
  now?: string;
}): OrchestrationTask | null {
  const node = input.dataset.nodes.find((candidate) => candidate.id === input.nodeId);
  if (!node) {
    return null;
  }
  const sourceRef = createOrchestrationSourceRef({
    providerId: "project-map",
    kind: "project_map_node",
    id: node.id,
    label: node.title,
    workspacePath: input.dataset.manifest.workspacePath,
    confidence: node.confidence,
    stale: node.stale,
    capabilities: ["open_source", "create_task"],
    metadata: {
      lensId: node.lensId,
      nodeKind: node.nodeKind,
      candidate: node.candidate,
    },
  });
  const evidenceRefs = buildEvidenceRefs({
    node,
    workspacePath: input.dataset.manifest.workspacePath,
  });
  const riskMarkers = buildRiskMarkers(node, evidenceRefs);
  const requiresReview = riskMarkers.some((marker) =>
    marker.kind === "stale_source" ||
    marker.kind === "low_confidence" ||
    marker.kind === "unknown_confidence" ||
    marker.kind === "candidate_source",
  );
  return createOrchestrationTask({
    taskId: `project-map-${node.id}`,
    workspaceId: input.workspaceId,
    title: `Review ${node.title}`,
    status: requiresReview ? "candidate" : "planned",
    sourceRefs: [sourceRef],
    evidenceRefs,
    riskMarkers,
    scopeSummary: node.summary || node.detail.coreDescription || node.title,
    acceptanceSummary: "User review confirms the selected Project Map node scope is addressed.",
    threadStrategy: "new_thread",
    now: input.now,
  });
}

export function readProjectMapOrchestrationCandidates(input: {
  workspaceId: string;
  dataset: ProjectMapDataset | null | undefined;
  relationshipContextPack?: ProjectMapRelationshipAgentReadPlan | null;
  now?: string;
}): OrchestrationTask[] {
  const relationshipContextTask = buildProjectMapRelationshipContextTaskDraft({
    workspaceId: input.workspaceId,
    contextPack: input.relationshipContextPack,
    workspacePath: input.dataset?.manifest.workspacePath ?? null,
    now: input.now,
  });
  if (!input.dataset) {
    return relationshipContextTask ? [relationshipContextTask] : [];
  }
  const nodeTasks = input.dataset.nodes.flatMap((node) =>
    buildProjectMapOrchestrationTaskDraft({
      workspaceId: input.workspaceId,
      dataset: input.dataset!,
      nodeId: node.id,
      now: input.now,
    }) ?? [],
  );
  return relationshipContextTask ? [relationshipContextTask, ...nodeTasks] : nodeTasks;
}

export function resolveProjectMapOrchestrationSourceNode(input: {
  dataset: ProjectMapDataset;
  task: OrchestrationTask;
}): { status: "found"; node: ProjectMapNode } | { status: "missing"; nodeId: string | null } {
  const sourceRef = input.task.sourceRefs.find((ref) =>
    ref.providerId === "project-map" && ref.kind === "project_map_node",
  );
  const nodeId = sourceRef?.id ?? null;
  const node = nodeId ? input.dataset.nodes.find((candidate) => candidate.id === nodeId) : null;
  return node ? { status: "found", node } : { status: "missing", nodeId };
}
