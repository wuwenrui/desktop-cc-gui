import { engineSendMessageSync } from "../../../services/tauri";
import type { EngineType } from "../../../types";
import type {
  ProjectMapCandidate,
  ProjectMapConfidence,
  ProjectMapDataset,
  ProjectMapNode,
  ProjectMapOrganizerRunItem,
  ProjectMapPreferredLanguage,
} from "../types";
import {
  PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
  deriveProjectMapNodeRole,
} from "../utils/incrementalGeneration";

type OrganizerMovePayload = {
  nodeId: string;
  suggestedParentId: string;
  confidence: ProjectMapConfidence;
  reason: string;
};

type OrganizerSkipPayload = {
  nodeId: string;
  reason: string;
};

type OrganizerPayload = {
  moves: OrganizerMovePayload[];
  skips: OrganizerSkipPayload[];
};

type OrganizerMoveSafetyContext = {
  movingNodeIdsWithAcceptedMoves?: Set<string>;
};

type OrganizerNodeSummary = {
  id: string;
  title: string;
  nodeKind: string;
  lensId: string;
  childCount: number;
  summary: string;
  sources: string[];
};

export type ProjectMapNodeOrganizerInput = {
  workspaceId: string;
  dataset: ProjectMapDataset;
  engine: EngineType | string;
  model: string;
  preferredLanguage?: ProjectMapPreferredLanguage;
};

export type ProjectMapNodeOrganizerResult = {
  candidates: ProjectMapCandidate[];
  unassignedCount: number;
  skippedCount: number;
  unsafeCount: number;
  skips: ProjectMapOrganizerRunItem[];
  unsafe: ProjectMapOrganizerRunItem[];
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeConfidence(value: unknown): ProjectMapConfidence {
  return value === "high" || value === "medium" || value === "low" || value === "unknown"
    ? value
    : "unknown";
}

function getSourcePaths(node: ProjectMapNode): string[] {
  return [
    ...node.sources.map((source) => source.path ?? source.label),
    ...node.detail.relatedArtifacts.map((artifact) => artifact.path ?? artifact.label),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function summarizeNode(node: ProjectMapNode): OrganizerNodeSummary {
  return {
    id: node.id,
    title: node.title,
    nodeKind: node.nodeKind,
    lensId: node.lensId,
    childCount: node.children.length,
    summary: node.summary,
    sources: getSourcePaths(node),
  };
}

function getUnassignedParent(dataset: ProjectMapDataset): ProjectMapNode | null {
  return dataset.nodes.find((node) => node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID) ?? null;
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

export function getProjectMapUnassignedDiscoveryChildren(dataset: ProjectMapDataset): ProjectMapNode[] {
  const unassignedParent = getUnassignedParent(dataset);
  if (!unassignedParent) {
    return [];
  }
  const nodeIndex = new Map(dataset.nodes.map((node) => [node.id, node]));
  const seenNodeIds = new Set<string>();
  const children: ProjectMapNode[] = [];
  for (const childId of unassignedParent.children) {
    const child = nodeIndex.get(childId);
    if (!child || child.id === unassignedParent.id || seenNodeIds.has(child.id)) {
      continue;
    }
    seenNodeIds.add(child.id);
    children.push(child);
  }
  for (const node of dataset.nodes) {
    if (
      node.parentId !== PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID ||
      node.id === unassignedParent.id ||
      seenNodeIds.has(node.id)
    ) {
      continue;
    }
    seenNodeIds.add(node.id);
    children.push(node);
  }
  return children;
}

function getOrganizerParentCandidates(dataset: ProjectMapDataset): ProjectMapNode[] {
  const rootNode = dataset.nodes.find((node) => !node.parentId) ?? dataset.nodes[0] ?? null;
  const unassignedChildren = getProjectMapUnassignedDiscoveryChildren(dataset);
  const stagedParentCandidateIds = new Set(
    unassignedChildren
      .filter(isBroadOrganizerNode)
      .map((node) => node.id),
  );
  const unassignedSubtreeIds = collectDescendantIds(dataset.nodes, PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID);
  return dataset.nodes
    .filter((node) => {
      return (
        Boolean(rootNode) &&
        node.id !== PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID &&
        (!unassignedSubtreeIds.has(node.id) || stagedParentCandidateIds.has(node.id))
      );
    })
    .slice(0, 120);
}

function getNodeDepth(dataset: ProjectMapDataset, nodeId: string): number {
  const nodeIndex = new Map(dataset.nodes.map((node) => [node.id, node]));
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

function isBroadOrganizerNode(node: ProjectMapNode): boolean {
  const role = deriveProjectMapNodeRole(node);
  return role === "root" || role === "structural" || role === "capability";
}

function getHierarchyFitIssue(input: {
  dataset: ProjectMapDataset;
  movingNode: ProjectMapNode;
  suggestedParent: ProjectMapNode;
  rootNode: ProjectMapNode | null;
}): string | null {
  if (!input.rootNode) {
    return "Project Map root is missing.";
  }
  const movingIsBroad = isBroadOrganizerNode(input.movingNode);
  const parentIsRoot = input.suggestedParent.id === input.rootNode.id;
  if (parentIsRoot) {
    return movingIsBroad ? null : "Only broad overview nodes can be organized directly under the project root.";
  }
  if (movingIsBroad && input.suggestedParent.lensId !== input.movingNode.lensId) {
    return "Broad overview nodes cannot be placed under a narrower parent from another lens.";
  }
  if (movingIsBroad && getNodeDepth(input.dataset, input.suggestedParent.id) > 1) {
    return "Broad overview nodes must stay near the root or their own lens hub.";
  }
  return null;
}

export function buildProjectMapNodeOrganizerPrompt(input: {
  dataset: ProjectMapDataset;
  preferredLanguage?: ProjectMapPreferredLanguage;
}): string {
  const unassignedChildren = getProjectMapUnassignedDiscoveryChildren(input.dataset);
  const parentCandidates = getOrganizerParentCandidates(input.dataset);
  const languageRule =
    input.preferredLanguage === "en"
      ? "Write reasons in English."
      : "理由用中文为主，保留 English technical terms。";

  return [
    "Task: Propose Project Map parent moves for unassigned discoveries.",
    "Return pure JSON only. No markdown fence. No explanation.",
    languageRule,
    "Rules:",
    "- Only propose moves for nodes listed in unassignedNodes.",
    "- suggestedParentId must be one of parentCandidates.",
    "- Never suggest unassigned-discoveries as parent.",
    "- Choose the parent at the correct abstraction level, not always the deepest node.",
    "- Broad overview/category nodes should stay under the project root or their own lens-level hub.",
    "- Specific detail/evidence nodes should use the most specific existing parent that can directly own them.",
    "- Do not edit node title, summary, sources, confidence, or detail.",
    "- Account for every unassigned node exactly once: either add it to moves or add it to skips.",
    "- Use skips when none of the parentCandidates is semantically safe for that node.",
    '- JSON shape: {"moves":[{"nodeId":"...","suggestedParentId":"...","confidence":"high|medium|low|unknown","reason":"..."}],"skips":[{"nodeId":"...","reason":"..."}]}',
    `Project: ${input.dataset.manifest.projectName}`,
    `unassignedNodes: ${JSON.stringify(unassignedChildren.map(summarizeNode))}`,
    `parentCandidates: ${JSON.stringify(parentCandidates.map(summarizeNode))}`,
  ].join("\n");
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

function parseOrganizerPayload(text: string): OrganizerPayload {
  const objectText = extractJsonObject(text);
  if (!objectText) {
    throw new Error("AI organizer output did not contain a JSON object.");
  }
  const parsed = JSON.parse(objectText) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.moves)) {
    throw new Error("AI organizer output did not contain a moves array.");
  }
  return {
    moves: parsed.moves
      .filter(isRecord)
      .map((move) => ({
        nodeId: asTrimmedString(move.nodeId),
        suggestedParentId: asTrimmedString(move.suggestedParentId),
        confidence: normalizeConfidence(move.confidence),
        reason: asTrimmedString(move.reason),
      }))
      .filter((move) => move.nodeId && move.suggestedParentId),
    skips: Array.isArray(parsed.skips)
      ? parsed.skips
          .filter(isRecord)
          .map((skip) => ({
            nodeId: asTrimmedString(skip.nodeId),
            reason: asTrimmedString(skip.reason),
          }))
          .filter((skip) => skip.nodeId)
      : [],
  };
}

function dedupeOrganizerMoves(moves: OrganizerMovePayload[]): OrganizerMovePayload[] {
  const seenNodeIds = new Set<string>();
  const dedupedMoves: OrganizerMovePayload[] = [];
  for (const move of moves) {
    if (seenNodeIds.has(move.nodeId)) {
      continue;
    }
    seenNodeIds.add(move.nodeId);
    dedupedMoves.push(move);
  }
  return dedupedMoves;
}

function dedupeOrganizerSkips(skips: OrganizerSkipPayload[]): OrganizerSkipPayload[] {
  const seenNodeIds = new Set<string>();
  const dedupedSkips: OrganizerSkipPayload[] = [];
  for (const skip of skips) {
    if (seenNodeIds.has(skip.nodeId)) {
      continue;
    }
    seenNodeIds.add(skip.nodeId);
    dedupedSkips.push(skip);
  }
  return dedupedSkips;
}

function getNodeTitle(dataset: ProjectMapDataset, nodeId: string): string {
  return dataset.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

function getConflictingOrganizerDecision(input: {
  dataset: ProjectMapDataset;
  move: OrganizerMovePayload;
}): ProjectMapOrganizerRunItem {
  return {
    nodeId: input.move.nodeId,
    title: getNodeTitle(input.dataset, input.move.nodeId),
    reason: "AI organizer returned both a move and a skip for this node.",
  };
}

function getOrganizerMoveSafetyIssue(input: {
  dataset: ProjectMapDataset;
  move: OrganizerMovePayload;
  context?: OrganizerMoveSafetyContext;
}): ProjectMapOrganizerRunItem | null {
  const movingNode = input.dataset.nodes.find((node) => node.id === input.move.nodeId);
  const suggestedParent = input.dataset.nodes.find((node) => node.id === input.move.suggestedParentId);
  const rootNode = input.dataset.nodes.find((node) => !node.parentId) ?? input.dataset.nodes[0] ?? null;

  if (!movingNode) {
    return {
      nodeId: input.move.nodeId,
      title: input.move.nodeId,
      reason: "Suggested move target node no longer exists.",
    };
  }
  if (!suggestedParent) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: `Suggested parent is missing: ${input.move.suggestedParentId}`,
    };
  }
  if (movingNode.parentId !== PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: "Target node is no longer under Unassigned Discoveries.",
    };
  }
  if (suggestedParent.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: "Suggested parent is the triage container itself.",
    };
  }
  if (suggestedParent.id === movingNode.id) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: "Suggested parent is the moving node itself.",
    };
  }
  if (movingNode.parentId === suggestedParent.id) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: "Suggested parent is already the current parent.",
    };
  }
  if (collectDescendantIds(input.dataset.nodes, movingNode.id).has(suggestedParent.id)) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: "Suggested parent is a descendant of the moving node.",
    };
  }
  if (collectDescendantIds(input.dataset.nodes, PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID).has(suggestedParent.id)) {
    if (
      isBroadOrganizerNode(suggestedParent) &&
      suggestedParent.parentId === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID &&
      input.context?.movingNodeIdsWithAcceptedMoves?.has(suggestedParent.id)
    ) {
      return null;
    }
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: "Suggested parent is still under Unassigned Discoveries.",
    };
  }
  const hierarchyFitIssue = getHierarchyFitIssue({
    dataset: input.dataset,
    movingNode,
    suggestedParent,
    rootNode,
  });
  if (hierarchyFitIssue) {
    return {
      nodeId: movingNode.id,
      title: movingNode.title,
      reason: hierarchyFitIssue,
    };
  }

  return null;
}

function createOrganizerCandidate(input: {
  dataset: ProjectMapDataset;
  move: OrganizerMovePayload;
  createdAt: string;
  context?: OrganizerMoveSafetyContext;
}): ProjectMapCandidate | null {
  if (getOrganizerMoveSafetyIssue({ dataset: input.dataset, move: input.move, context: input.context })) {
    return null;
  }
  const movingNode = input.dataset.nodes.find((node) => node.id === input.move.nodeId)!;
  const suggestedParent = input.dataset.nodes.find((node) => node.id === input.move.suggestedParentId)!;

  return {
    id: `organizer_${movingNode.id}_${suggestedParent.id}_${input.createdAt.replace(/[^0-9A-Za-z]/g, "")}`,
    status: "pending",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    source: "organizer",
    kind: "parentMove",
    targetLensId: movingNode.lensId,
    targetNodeId: movingNode.id,
    patch: { nodeId: movingNode.id },
    move: {
      nodeId: movingNode.id,
      fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      suggestedParentId: suggestedParent.id,
      confidence: input.move.confidence,
      reason: input.move.reason || `Suggested parent: ${suggestedParent.title}`,
    },
    evidence: [],
  };
}

export async function organizeProjectMapUnassignedDiscoveries(
  input: ProjectMapNodeOrganizerInput,
): Promise<ProjectMapNodeOrganizerResult> {
  const unassignedChildren = getProjectMapUnassignedDiscoveryChildren(input.dataset);
  if (unassignedChildren.length === 0) {
    throw new Error("No unassigned Project Map discoveries are available to organize.");
  }
  const prompt = buildProjectMapNodeOrganizerPrompt({
    dataset: input.dataset,
    preferredLanguage: input.preferredLanguage,
  });
  const response = await engineSendMessageSync(input.workspaceId, {
    text: prompt,
    engine: input.engine as EngineType,
    model: input.model,
    accessMode: "read-only",
    continueSession: false,
  });
  const payload = parseOrganizerPayload(response.text);
  const createdAt = new Date().toISOString();
  const dedupedMoves = dedupeOrganizerMoves(payload.moves);
  const dedupedSkips = dedupeOrganizerSkips(payload.skips);
  const skippedNodeIds = new Set(dedupedSkips.map((skip) => skip.nodeId));
  const conflictingMoves = dedupedMoves.filter((move) => skippedNodeIds.has(move.nodeId));
  const conflictNodeIds = new Set(conflictingMoves.map((move) => move.nodeId));
  const movableDecisions = dedupedMoves.filter((move) => !conflictNodeIds.has(move.nodeId));
  const explicitSkips = dedupedSkips.filter((skip) => !conflictNodeIds.has(skip.nodeId));
  const acceptedMoveNodeIds = new Set<string>();
  for (let index = 0; index < movableDecisions.length; index += 1) {
    const context = { movingNodeIdsWithAcceptedMoves: acceptedMoveNodeIds };
    const acceptedMoves = movableDecisions.filter((move) =>
      !getOrganizerMoveSafetyIssue({ dataset: input.dataset, move, context }),
    );
    const nextAcceptedMoveNodeIds = new Set(acceptedMoves.map((move) => move.nodeId));
    if (nextAcceptedMoveNodeIds.size === acceptedMoveNodeIds.size) {
      break;
    }
    acceptedMoveNodeIds.clear();
    for (const nodeId of nextAcceptedMoveNodeIds) {
      acceptedMoveNodeIds.add(nodeId);
    }
  }
  const safetyContext = { movingNodeIdsWithAcceptedMoves: acceptedMoveNodeIds };
  const candidates = movableDecisions
    .map((move) => createOrganizerCandidate({ dataset: input.dataset, move, createdAt, context: safetyContext }))
    .filter((candidate): candidate is ProjectMapCandidate => Boolean(candidate));
  const unsafe = [
    ...conflictingMoves.map((move) => getConflictingOrganizerDecision({ dataset: input.dataset, move })),
    ...movableDecisions
      .map((move) => getOrganizerMoveSafetyIssue({ dataset: input.dataset, move, context: safetyContext }))
      .filter((issue): issue is ProjectMapOrganizerRunItem => Boolean(issue)),
  ];
  const accountedNodeIds = new Set([
    ...dedupedMoves.map((move) => move.nodeId),
    ...explicitSkips.map((skip) => skip.nodeId),
  ]);
  const implicitSkips = unassignedChildren
    .filter((node) => !accountedNodeIds.has(node.id))
    .map((node) => ({
      nodeId: node.id,
      title: node.title,
      reason: "AI did not return a move or skip decision for this node.",
    }));
  const skips = [
    ...explicitSkips.map((skip) => ({
      nodeId: skip.nodeId,
      title: getNodeTitle(input.dataset, skip.nodeId),
      reason: skip.reason || "AI skipped this node because no safe existing parent was identified.",
    })),
    ...implicitSkips,
  ];

  return {
    candidates,
    unassignedCount: unassignedChildren.length,
    skippedCount: skips.length,
    unsafeCount: unsafe.length,
    skips,
    unsafe,
  };
}
