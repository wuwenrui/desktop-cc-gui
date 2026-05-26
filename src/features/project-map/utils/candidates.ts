import type { ProjectMapCandidate, ProjectMapDataset, ProjectMapNode } from "../types";
import { validateProjectMapNodePatch } from "./evidenceGate";

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

  const targetNode = input.dataset.nodes.find((node) => node.id === candidate.patch.nodeId);
  if (!targetNode) {
    return { ok: false, errors: [`Candidate target node is missing: ${candidate.patch.nodeId}`] };
  }

  const gate = validateProjectMapNodePatch(targetNode, candidate.patch);
  if (!gate.ok) {
    return { ok: false, errors: gate.issues.map((issue) => issue.message) };
  }

  return {
    ok: true,
    dataset: {
      ...input.dataset,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: input.confirmedAt,
      },
      nodes: input.dataset.nodes.map((node) =>
        node.id === targetNode.id ? applyPatchToNode(node, candidate) : node,
      ),
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
