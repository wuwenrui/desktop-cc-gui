import type { ProjectMapCandidate, ProjectMapDataset, ProjectMapNode } from "../types";
import { validateProjectMapNodePatch } from "./evidenceGate";
import {
  PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
  deriveProjectMapNodeRole,
  normalizeProjectMapNodeTopology,
  recalculateProjectMapLensStats,
} from "./incrementalGeneration";

function applyPatchToNode(node: ProjectMapNode, candidate: ProjectMapCandidate): ProjectMapNode {
  const patch = candidate.patch;
  return {
    ...node,
    summary: patch.summary ?? node.summary,
    detail: patch.detail ? { ...node.detail, ...patch.detail } : node.detail,
    sources: patch.sources ?? node.sources,
    confidence: patch.confidence ?? node.confidence,
    stale: patch.stale ?? node.stale,
    candidate: patch.candidate ?? node.candidate,
  };
}

function candidateTargetsNode(candidate: ProjectMapCandidate, nodeId: string): boolean {
  return (candidate.targetNodeId ?? candidate.patch.nodeId) === nodeId;
}

function collectDescendantIds(nodes: ProjectMapNode[], nodeId: string): Set<string> {
  const descendantIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && (node.parentId === nodeId || descendantIds.has(node.parentId)) && !descendantIds.has(node.id)) {
        descendantIds.add(node.id);
        changed = true;
      }
    }
  }
  return descendantIds;
}

function getNodeDepth(nodes: ProjectMapNode[], nodeId: string): number {
  const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let depth = 0;
  let current = nodeIndex.get(nodeId);
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    current = nodeIndex.get(current.parentId);
    depth += 1;
  }
  return depth;
}

function isBroadParentMoveNode(node: ProjectMapNode): boolean {
  const role = deriveProjectMapNodeRole(node);
  return role === "root" || role === "structural" || role === "capability";
}

function getParentMoveHierarchyIssue(input: {
  dataset: ProjectMapDataset;
  movingNode: ProjectMapNode;
  targetParent: ProjectMapNode;
  rootNode: ProjectMapNode | null;
}): string | null {
  if (!input.rootNode) {
    return "Project Map root is missing.";
  }
  const movingIsBroad = isBroadParentMoveNode(input.movingNode);
  const targetIsRoot = input.targetParent.id === input.rootNode.id;
  if (targetIsRoot) {
    return movingIsBroad ? null : "Only broad overview nodes can be moved directly under the project root.";
  }
  if (movingIsBroad && input.targetParent.lensId !== input.movingNode.lensId) {
    return "Broad overview nodes cannot be moved under a narrower parent from another lens.";
  }
  if (movingIsBroad && getNodeDepth(input.dataset.nodes, input.targetParent.id) > 1) {
    return "Broad overview nodes must stay near the root or their own lens hub.";
  }
  return null;
}

function confirmParentMoveCandidate(input: {
  dataset: ProjectMapDataset;
  candidate: ProjectMapCandidate;
  confirmedAt: string;
}): { ok: true; dataset: ProjectMapDataset } | { ok: false; errors: string[] } {
  const move = input.candidate.move;
  if (!move) {
    return { ok: false, errors: ["Project-map parent move candidate is missing move metadata."] };
  }

  const movingNode = input.dataset.nodes.find((node) => node.id === move.nodeId);
  const sourceParent = input.dataset.nodes.find((node) => node.id === move.fromParentId);
  const targetParent = input.dataset.nodes.find((node) => node.id === move.suggestedParentId);
  const rootNode = input.dataset.nodes.find((node) => !node.parentId) ?? input.dataset.nodes[0] ?? null;
  const errors: string[] = [];

  if (!movingNode) {
    errors.push(`Move target node is missing: ${move.nodeId}`);
  }
  if (!sourceParent) {
    errors.push(`Move source parent is missing: ${move.fromParentId}`);
  }
  if (!targetParent) {
    errors.push(`Move suggested parent is missing: ${move.suggestedParentId}`);
  }
  if (movingNode && movingNode.parentId !== move.fromParentId) {
    errors.push("Move source parent is stale; refresh organizer suggestions before applying.");
  }
  if (move.fromParentId !== PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID) {
    errors.push("Only unassigned discovery moves can be confirmed by the organizer.");
  }
  if (movingNode && move.suggestedParentId === movingNode.parentId) {
    errors.push("Organizer move must choose a different parent.");
  }
  if (move.suggestedParentId === move.nodeId) {
    errors.push("Organizer moves cannot assign a node as its own parent.");
  }
  if (collectDescendantIds(input.dataset.nodes, move.nodeId).has(move.suggestedParentId)) {
    errors.push("Organizer move would create a Project Map cycle.");
  }
  if (collectDescendantIds(input.dataset.nodes, PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID).has(move.suggestedParentId)) {
    errors.push("Organizer move target parent is still under Unassigned Discoveries.");
  }
  if (movingNode && targetParent) {
    const hierarchyIssue = getParentMoveHierarchyIssue({
      dataset: input.dataset,
      movingNode,
      targetParent,
      rootNode,
    });
    if (hierarchyIssue) {
      errors.push(hierarchyIssue);
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nodes = normalizeProjectMapNodeTopology(
    input.dataset.nodes.map((node) => {
      if (node.id === move.nodeId) {
        return { ...node, parentId: move.suggestedParentId };
      }
      if (node.id === move.fromParentId) {
        return {
          ...node,
          children: node.children.filter((childId) => childId !== move.nodeId),
        };
      }
      if (node.id === move.suggestedParentId) {
        return {
          ...node,
          children: node.children.includes(move.nodeId)
            ? node.children
            : [...node.children, move.nodeId],
        };
      }
      return node;
    }),
    { attachOrphansToRoot: true },
  );

  return {
    ok: true,
    dataset: {
      ...input.dataset,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: input.confirmedAt,
        lensStats: recalculateProjectMapLensStats(input.dataset.lenses, nodes),
      },
      nodes,
      candidates: (input.dataset.candidates ?? []).map((item) =>
        item.id === input.candidate.id
          ? { ...item, status: "confirmed", updatedAt: input.confirmedAt }
          : item,
      ),
    },
  };
}

function withCandidateNodeUpdate(input: {
  dataset: ProjectMapDataset;
  nodeId: string;
  updatedAt: string;
  updateNode: (node: ProjectMapNode) => ProjectMapNode;
  updateCandidate?: (candidate: ProjectMapCandidate) => ProjectMapCandidate;
}): { ok: true; dataset: ProjectMapDataset } | { ok: false; errors: string[] } {
  const targetNode = input.dataset.nodes.find((node) => node.id === input.nodeId);
  if (!targetNode) {
    return { ok: false, errors: [`Project-map node is missing: ${input.nodeId}`] };
  }
  if (!targetNode.candidate) {
    return { ok: false, errors: [`Project-map node is not a candidate: ${input.nodeId}`] };
  }

  const nodes = input.dataset.nodes.map((node) =>
    node.id === input.nodeId ? input.updateNode(node) : node,
  );
  const updateCandidate = input.updateCandidate;
  const candidates = updateCandidate
    ? (input.dataset.candidates ?? []).map((candidate) =>
        candidateTargetsNode(candidate, input.nodeId)
          ? updateCandidate(candidate)
          : candidate,
      )
    : input.dataset.candidates;

  return {
    ok: true,
    dataset: {
      ...input.dataset,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: input.updatedAt,
        lensStats: recalculateProjectMapLensStats(input.dataset.lenses, nodes),
      },
      nodes,
      candidates,
    },
  };
}

export function confirmProjectMapCandidate(input: {
  dataset: ProjectMapDataset;
  candidateId: string;
  confirmedAt: string;
}):
  | { ok: true; dataset: ProjectMapDataset }
  | { ok: false; errors: string[] } {
  const candidate = (input.dataset.candidates ?? []).find(
    (item) => item.id === input.candidateId,
  );
  if (!candidate) {
    return { ok: false, errors: [`Unknown project-map candidate: ${input.candidateId}`] };
  }
  if (candidate.status !== "pending") {
    return { ok: false, errors: ["Only pending project-map candidates can be confirmed."] };
  }
  if (candidate.kind === "parentMove") {
    return confirmParentMoveCandidate({
      dataset: input.dataset,
      candidate,
      confirmedAt: input.confirmedAt,
    });
  }

  const targetNode = input.dataset.nodes.find((node) => node.id === candidate.patch.nodeId);
  if (!targetNode) {
    return { ok: false, errors: [`Candidate target node is missing: ${candidate.patch.nodeId}`] };
  }

  const gate = validateProjectMapNodePatch(targetNode, candidate.patch);
  if (!gate.ok) {
    return { ok: false, errors: gate.issues.map((issue) => issue.message) };
  }

  const nodes = input.dataset.nodes.map((node) =>
    node.id === targetNode.id ? applyPatchToNode(node, candidate) : node,
  );

  return {
    ok: true,
    dataset: {
      ...input.dataset,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: input.confirmedAt,
        lensStats: recalculateProjectMapLensStats(input.dataset.lenses, nodes),
      },
      nodes,
      candidates: (input.dataset.candidates ?? []).map((item) =>
        item.id === candidate.id
          ? { ...item, status: "confirmed", updatedAt: input.confirmedAt }
          : item,
      ),
      evidenceRecords: [
        ...(input.dataset.evidenceRecords ?? []),
        ...candidate.evidence,
      ],
    },
  };
}

export function rejectProjectMapCandidate(input: {
  dataset: ProjectMapDataset;
  candidateId: string;
  rejectedAt: string;
}): ProjectMapDataset {
  return {
    ...input.dataset,
    candidates: (input.dataset.candidates ?? []).map((candidate) =>
      candidate.id === input.candidateId
        ? { ...candidate, status: "rejected", updatedAt: input.rejectedAt }
        : candidate,
    ),
  };
}

export function confirmProjectMapNodeCandidate(input: {
  dataset: ProjectMapDataset;
  nodeId: string;
  confirmedAt: string;
}): { ok: true; dataset: ProjectMapDataset } | { ok: false; errors: string[] } {
  return withCandidateNodeUpdate({
    dataset: input.dataset,
    nodeId: input.nodeId,
    updatedAt: input.confirmedAt,
    updateNode: (node) => ({ ...node, candidate: false }),
  });
}

export function rejectProjectMapNodeCandidate(input: {
  dataset: ProjectMapDataset;
  nodeId: string;
  rejectedAt: string;
}): { ok: true; dataset: ProjectMapDataset } | { ok: false; errors: string[] } {
  return withCandidateNodeUpdate({
    dataset: input.dataset,
    nodeId: input.nodeId,
    updatedAt: input.rejectedAt,
    updateNode: (node) => ({ ...node, candidate: false, stale: true }),
  });
}
