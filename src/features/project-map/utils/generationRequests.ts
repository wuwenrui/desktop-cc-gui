import type {
  ProjectMapDataset,
  ProjectMapGenerationIntent,
  ProjectMapGenerationRequest,
  ProjectMapGenerationScope,
  ProjectMapNode,
  ProjectMapNodePatch,
  ProjectMapRunMetadata,
  ProjectMapSource,
  ProjectMapStorageLocation,
} from "../types";
import { validateProjectMapNodePatch } from "./evidenceGate";

function nowIso(): string {
  return new Date().toISOString();
}

function requestId(prefix: ProjectMapRunMetadata["kind"]): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueSources(sources: ProjectMapSource[]): ProjectMapSource[] {
  const seen = new Set<string>();
  const result: ProjectMapSource[] = [];
  for (const source of sources) {
    const key = `${source.type}:${source.path ?? ""}:${source.line ?? ""}:${source.label}:${source.hash ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(source);
  }
  return result;
}

function inferGenerationIntent(input: {
  kind: ProjectMapRunMetadata["kind"];
  scope: ProjectMapGenerationScope;
  generationIntent?: ProjectMapGenerationIntent;
}): ProjectMapGenerationIntent {
  if (input.generationIntent) {
    return input.generationIntent;
  }
  if (input.kind === "global" || input.scope.kind === "global") {
    return "global";
  }
  return input.scope.kind === "node" ? "completeNode" : "global";
}

function sourceFromRelatedArtifact(
  artifact: ProjectMapNode["detail"]["relatedArtifacts"][number],
): ProjectMapSource {
  return {
    type: artifact.type,
    label: artifact.label,
    path: artifact.path,
    line: artifact.line,
  };
}

function collectNodeScopedSources(input: {
  dataset: ProjectMapDataset;
  node: ProjectMapNode;
  scope: ProjectMapGenerationScope;
}): ProjectMapSource[] {
  const scopedNodeIds = new Set<string>([input.node.id]);
  if (input.scope.kind === "node" && input.scope.includeDescendants) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of input.dataset.nodes) {
        if (candidate.parentId && scopedNodeIds.has(candidate.parentId) && !scopedNodeIds.has(candidate.id)) {
          scopedNodeIds.add(candidate.id);
          changed = true;
        }
      }
    }
  }

  const nodesByPriority = [
    input.node,
    ...input.dataset.nodes.filter((candidate) => candidate.id !== input.node.id && scopedNodeIds.has(candidate.id)),
  ];
  return uniqueSources(
    nodesByPriority.flatMap((candidate) => [
      ...candidate.sources,
      ...candidate.detail.relatedArtifacts.map(sourceFromRelatedArtifact),
    ]),
  ).slice(0, 16);
}

export function createProjectMapGenerationRequest(input: {
  dataset: ProjectMapDataset;
  kind: ProjectMapRunMetadata["kind"];
  engine: string;
  model: string;
  scope: ProjectMapGenerationScope;
  generationIntent?: ProjectMapGenerationIntent;
  storageLocation: ProjectMapStorageLocation;
  writePath: string;
  node?: ProjectMapNode | null;
}): ProjectMapGenerationRequest {
  const generationIntent = inferGenerationIntent(input);
  const readSources = input.node
    ? collectNodeScopedSources({
        dataset: input.dataset,
        node: input.node,
        scope: input.scope,
      })
    : uniqueSources([
      ...input.dataset.lenses.flatMap((lens) => lens.evidence),
      ...input.dataset.nodes.flatMap((node) => node.sources),
    ]).slice(0, 24);

  return {
    id: requestId(input.kind),
    kind: input.kind,
    engine: input.engine,
    model: input.model,
    scope: input.scope,
    generationIntent,
    readSources,
    storageLocation: input.storageLocation,
    writePath: input.writePath,
    createdAt: nowIso(),
  };
}

export function createRunMetadataFromRequest(
  request: ProjectMapGenerationRequest,
  status: ProjectMapRunMetadata["status"] = "pending",
): ProjectMapRunMetadata {
  return {
    id: request.id,
    kind: request.kind,
    status,
    engine: request.engine,
    model: request.model,
    startedAt: request.createdAt,
    completedAt: status === "pending" || status === "running" ? null : nowIso(),
    scope: request.scope.kind,
    requestScope: request.scope,
    generationIntent: request.generationIntent,
    readSources: request.readSources,
    storageLocation: request.storageLocation,
    writePath: request.writePath,
    phase: status === "pending" ? "queued" : undefined,
    progress: status === "pending" ? 5 : undefined,
    threadId: null,
    logs:
      status === "pending"
        ? [
            {
              at: request.createdAt,
              phase: "queued",
              message: "Generation request queued.",
            },
          ]
        : [],
    error: null,
  };
}

export function validateStructuredProjectMapPatch(input: {
  dataset: ProjectMapDataset;
  patch: ProjectMapNodePatch;
}): { ok: true; patch: ProjectMapNodePatch } | { ok: false; errors: string[] } {
  const node = input.dataset.nodes.find((candidate) => candidate.id === input.patch.nodeId);
  if (!node) {
    return { ok: false, errors: [`Unknown project-map node: ${input.patch.nodeId}`] };
  }

  const gate = validateProjectMapNodePatch(node, input.patch);
  if (!gate.ok) {
    return { ok: false, errors: gate.issues.map((issue) => issue.message) };
  }

  return { ok: true, patch: input.patch };
}
