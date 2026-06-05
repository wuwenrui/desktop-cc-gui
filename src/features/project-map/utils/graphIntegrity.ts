import type {
  ProjectMapDataset,
  ProjectMapGraphIntegrityIssue,
  ProjectMapGraphRepairAction,
  ProjectMapGraphRepairSummary,
  ProjectMapStaleReason,
} from "../types";

function issue(input: ProjectMapGraphIntegrityIssue): ProjectMapGraphIntegrityIssue {
  return input;
}

function action(input: ProjectMapGraphRepairAction): ProjectMapGraphRepairAction {
  return input;
}

function buildNodeIdSet(dataset: ProjectMapDataset): Set<string> {
  return new Set(dataset.nodes.map((node) => node.id));
}

export function validateProjectMapGraphIntegrity(
  dataset: ProjectMapDataset,
): ProjectMapGraphIntegrityIssue[] {
  const nodeIds = buildNodeIdSet(dataset);
  const seenNodeIds = new Set<string>();
  const seenRelationIds = new Set<string>();
  const issues: ProjectMapGraphIntegrityIssue[] = [];

  for (const node of dataset.nodes) {
    if (seenNodeIds.has(node.id)) {
      issues.push(issue({
        id: `node:${node.id}:duplicate`,
        kind: "duplicate-node-id",
        severity: "critical",
        label: `Duplicate Project Map node id: ${node.id}`,
        nodeId: node.id,
      }));
    }
    seenNodeIds.add(node.id);

    if (node.parentId && !nodeIds.has(node.parentId)) {
      issues.push(issue({
        id: `node:${node.id}:missing-parent:${node.parentId}`,
        kind: "missing-parent",
        severity: "warning",
        label: `${node.title} references missing parent ${node.parentId}`,
        nodeId: node.id,
      }));
    }

    for (const childId of node.children) {
      if (!nodeIds.has(childId)) {
        issues.push(issue({
          id: `node:${node.id}:missing-child:${childId}`,
          kind: "missing-child",
          severity: "warning",
          label: `${node.title} references missing child ${childId}`,
          nodeId: node.id,
        }));
      }
    }

    if (node.sources.length === 0) {
      issues.push(issue({
        id: `node:${node.id}:missing-evidence`,
        kind: "missing-node-evidence",
        severity: "info",
        label: `${node.title} has no evidence source`,
        nodeId: node.id,
      }));
    }
  }

  for (const relation of dataset.relations ?? []) {
    if (seenRelationIds.has(relation.id)) {
      issues.push(issue({
        id: `relation:${relation.id}:duplicate`,
        kind: "duplicate-relation-id",
        severity: "warning",
        label: `Duplicate Project Map relation id: ${relation.id}`,
        relationId: relation.id,
      }));
    }
    seenRelationIds.add(relation.id);

    if (!nodeIds.has(relation.sourceNodeId)) {
      issues.push(issue({
        id: `relation:${relation.id}:missing-source:${relation.sourceNodeId}`,
        kind: "missing-relation-source",
        severity: "critical",
        label: `${relation.type} relation references missing source ${relation.sourceNodeId}`,
        relationId: relation.id,
      }));
    }
    if (!nodeIds.has(relation.targetNodeId)) {
      issues.push(issue({
        id: `relation:${relation.id}:missing-target:${relation.targetNodeId}`,
        kind: "missing-relation-target",
        severity: "critical",
        label: `${relation.type} relation references missing target ${relation.targetNodeId}`,
        relationId: relation.id,
      }));
    }
    if (relation.stale) {
      issues.push(issue({
        id: `relation:${relation.id}:stale`,
        kind: "stale-relation",
        severity: "info",
        label: `${relation.type} relation is stale`,
        relationId: relation.id,
      }));
    }
  }

  return issues;
}

function buildEvidenceGapReason(nodeId: string): ProjectMapStaleReason {
  return {
    id: `graph-repair:${nodeId}:missing-evidence`,
    kind: "unknown",
    label: "Node was quarantined because it has no evidence source",
    nodeId,
    recommendation: "partial-refresh",
  };
}

export function repairProjectMapGraphIntegrity(input: {
  dataset: ProjectMapDataset;
  now?: string;
}): {
  dataset: ProjectMapDataset;
  summary: ProjectMapGraphRepairSummary;
} {
  const now = input.now ?? new Date().toISOString();
  const issues = validateProjectMapGraphIntegrity(input.dataset);
  const nodeIds = buildNodeIdSet(input.dataset);
  const invalidRelationIds = new Set(
    issues
      .filter((item) => item.kind === "missing-relation-source" || item.kind === "missing-relation-target")
      .flatMap((item) => (item.relationId ? [item.relationId] : [])),
  );
  const evidenceGapNodeIds = new Set(
    issues
      .filter((item) => item.kind === "missing-node-evidence")
      .flatMap((item) => (item.nodeId ? [item.nodeId] : [])),
  );
  const actions: ProjectMapGraphRepairAction[] = [
    ...[...invalidRelationIds].map((relationId) =>
      action({
        id: `repair:relation:${relationId}:remove`,
        kind: "remove-invalid-relation",
        label: `Removed invalid relation ${relationId}`,
        relationId,
      }),
    ),
  ];

  const nodes = input.dataset.nodes.map((node) => {
    const repairedChildren = node.children.filter((childId) => nodeIds.has(childId));
    const removedChildren = node.children.filter((childId) => !nodeIds.has(childId));
    for (const childId of removedChildren) {
      actions.push(action({
        id: `repair:node:${node.id}:child:${childId}:remove`,
        kind: "remove-missing-child-reference",
        label: `Removed missing child reference ${childId} from ${node.title}`,
        nodeId: node.id,
      }));
    }

    const parentId = node.parentId && nodeIds.has(node.parentId) ? node.parentId : undefined;
    if (node.parentId && !parentId) {
      actions.push(action({
        id: `repair:node:${node.id}:parent:clear`,
        kind: "clear-missing-parent",
        label: `Cleared missing parent ${node.parentId} from ${node.title}`,
        nodeId: node.id,
      }));
    }

    if (!evidenceGapNodeIds.has(node.id)) {
      return {
        ...node,
        parentId,
        children: repairedChildren,
      };
    }

    actions.push(action({
      id: `repair:node:${node.id}:evidence:quarantine`,
      kind: "quarantine-evidence-gap",
      label: `Marked ${node.title} as stale because evidence is missing`,
      nodeId: node.id,
    }));
    return {
      ...node,
      parentId,
      children: repairedChildren,
      stale: true,
      staleReasons: [
        ...(node.staleReasons ?? []),
        buildEvidenceGapReason(node.id),
      ],
    };
  });

  const summary: ProjectMapGraphRepairSummary = {
    issues,
    actions,
    repairedAt: now,
  };

  return {
    dataset: {
      ...input.dataset,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: now,
      },
      nodes,
      relations: (input.dataset.relations ?? []).filter((relation) => !invalidRelationIds.has(relation.id)),
      graphRepair: summary,
    },
    summary,
  };
}
