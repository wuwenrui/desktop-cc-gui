import type {
  ProjectMapDataset,
  ProjectMapGenerationScope,
  ProjectMapLens,
  ProjectMapLensStats,
  ProjectMapNode,
  ProjectMapProfile,
  ProjectMapRelatedArtifact,
  ProjectMapRunMetadata,
  ProjectMapSource,
} from "../types";

type MergeInput = {
  dataset: ProjectMapDataset;
  profile: ProjectMapProfile;
  lenses: ProjectMapLens[];
  nodes: ProjectMapNode[];
  scope: ProjectMapGenerationScope;
  run: ProjectMapRunMetadata;
};

type PruneInput = {
  dataset: ProjectMapDataset;
  nodeId: string;
  prunedAt: string;
};

const CONFIDENCE_RANK = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
} as const;

function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function safeKeyText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeOptionalLine(value: unknown): number | undefined {
  const line = typeof value === "number" ? value : Number(asTrimmedString(value));
  return Number.isFinite(line) && line > 0 ? Math.floor(line) : undefined;
}

function normalizeMergedArtifact(value: unknown): ProjectMapRelatedArtifact | null {
  const legacyLabel = asTrimmedString(value);
  if (legacyLabel) {
    return { type: "symbol", label: legacyLabel };
  }
  if (!isRecord(value)) {
    return null;
  }

  const label = asTrimmedString(value.label);
  const path = asTrimmedString(value.path);
  const ref = asTrimmedString(value.ref);
  const rawType = asTrimmedString(value.type);
  const type = ["file", "symbol", "spec", "commit", "test", "conversation"].includes(rawType)
    ? (rawType as ProjectMapRelatedArtifact["type"])
    : "file";
  const normalizedLabel = label || (path ? path.split(/[\\/]/).filter(Boolean).pop() ?? path : "") || ref || type;
  if (!normalizedLabel) {
    return null;
  }

  const line = normalizeOptionalLine(value.line);
  return {
    type,
    label: normalizedLabel,
    ...(path ? { path } : {}),
    ...(line ? { line } : {}),
    ...(ref ? { ref } : {}),
  };
}

function sourceKey(source: ProjectMapSource): string {
  return [
    safeKeyText(source.type),
    source.path ?? "",
    source.line ?? "",
    safeKeyText(source.label),
    source.hash ?? "",
  ].join(":");
}

function artifactKey(artifact: ProjectMapNode["detail"]["relatedArtifacts"][number]): string {
  return [
    safeKeyText(artifact.type),
    artifact.path ?? "",
    artifact.line ?? "",
    artifact.ref ?? "",
    safeKeyText(artifact.label),
  ].join(":");
}

function textKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeTextArray(existing: string[], generated: string[]): string[] {
  return dedupeBy(
    [...existing, ...generated].filter((item) => item.trim().length > 0),
    textKey,
  );
}

function mergeSources(existing: ProjectMapSource[], generated: ProjectMapSource[]): ProjectMapSource[] {
  return dedupeBy([...existing, ...generated], sourceKey);
}

function mergeArtifacts(
  existing: ProjectMapNode["detail"]["relatedArtifacts"],
  generated: ProjectMapNode["detail"]["relatedArtifacts"],
): ProjectMapNode["detail"]["relatedArtifacts"] {
  return dedupeBy(
    [...existing, ...generated]
      .map(normalizeMergedArtifact)
      .filter((artifact): artifact is ProjectMapRelatedArtifact => Boolean(artifact)),
    artifactKey,
  );
}

function mergeStringUnion<T extends string>(existing: T[], generated: T[], unknownValue?: T): T[] {
  const merged = dedupeBy(
    [...existing, ...generated].filter((item) => item.trim().length > 0),
    (item) => item.toLowerCase(),
  );
  if (unknownValue && merged.length > 1) {
    return merged.filter((item) => item !== unknownValue);
  }
  return merged;
}

function normalizeFrameworkConfidence(value: unknown): ProjectMapProfile["frameworks"][number]["confidence"] {
  return value === "high" || value === "medium" || value === "low" || value === "unknown"
    ? value
    : "unknown";
}

function isProjectMapSource(value: unknown): value is ProjectMapSource {
  return isRecord(value) && typeof value.type === "string" && typeof value.label === "string";
}

function normalizeFrameworks(value: unknown): ProjectMapProfile["frameworks"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const frameworks: ProjectMapProfile["frameworks"] = [];
  for (const rawFramework of value) {
    const legacyName = asTrimmedString(rawFramework);
    if (legacyName) {
      frameworks.push({ name: legacyName, confidence: "unknown", evidence: [] });
      continue;
    }
    if (!isRecord(rawFramework)) {
      continue;
    }

    const name = asTrimmedString(rawFramework.name);
    if (!name) {
      continue;
    }
    const evidence = Array.isArray(rawFramework.evidence)
      ? rawFramework.evidence.filter(isProjectMapSource)
      : [];
    frameworks.push({
      name,
      confidence: normalizeFrameworkConfidence(rawFramework.confidence),
      evidence,
    });
  }

  return frameworks;
}

function mergeFrameworks(
  existing: ProjectMapProfile["frameworks"],
  generated: ProjectMapProfile["frameworks"],
): ProjectMapProfile["frameworks"] {
  return dedupeBy(
    [...normalizeFrameworks(existing), ...normalizeFrameworks(generated)],
    (framework) => safeKeyText(framework.name),
  );
}

function mergeProfile(existing: ProjectMapProfile, generated: ProjectMapProfile): ProjectMapProfile {
  return {
    primaryLanguage:
      generated.primaryLanguage && generated.primaryLanguage !== "unknown"
        ? generated.primaryLanguage
        : existing.primaryLanguage,
    languages: mergeStringUnion(existing.languages, generated.languages, "unknown"),
    shapes: mergeStringUnion(existing.shapes, generated.shapes, "unknown"),
    frameworks: mergeFrameworks(existing.frameworks, generated.frameworks),
    interfaceKinds: mergeStringUnion(existing.interfaceKinds, generated.interfaceKinds, "unknown"),
    buildSystems: mergeStringUnion(existing.buildSystems, generated.buildSystems),
  };
}

function mergeConfidence(
  existing: ProjectMapNode["confidence"],
  generated: ProjectMapNode["confidence"],
  generatedHasSources: boolean,
): ProjectMapNode["confidence"] {
  if (CONFIDENCE_RANK[generated] <= CONFIDENCE_RANK[existing]) {
    return generated;
  }
  return generatedHasSources ? generated : existing;
}

function mergeLens(existing: ProjectMapLens, generated: ProjectMapLens): ProjectMapLens {
  const evidence = mergeSources(existing.evidence, generated.evidence);
  const generatedHasEvidence = generated.evidence.length > 0;
  const nextConfidence =
    CONFIDENCE_RANK[generated.confidence] > CONFIDENCE_RANK[existing.confidence] && !generatedHasEvidence
      ? existing.confidence
      : generated.confidence;
  return {
    ...existing,
    title: generated.title || existing.title,
    shortTitle: generated.shortTitle || existing.shortTitle,
    description: generated.description || existing.description,
    status: generated.status === "detected" ? "detected" : existing.status,
    confidence: nextConfidence,
    evidence,
  };
}

function mergeLenses(existing: ProjectMapLens[], generated: ProjectMapLens[]): ProjectMapLens[] {
  const generatedById = new Map(generated.map((lens) => [lens.id, lens]));
  const merged = existing.map((lens) => {
    const generatedLens = generatedById.get(lens.id);
    if (!generatedLens) {
      return lens;
    }
    generatedById.delete(lens.id);
    return mergeLens(lens, generatedLens);
  });
  return [...merged, ...generatedById.values()];
}

function collectScopedExistingIds(nodes: ProjectMapNode[], scope: ProjectMapGenerationScope): Set<string> {
  if (scope.kind !== "node") {
    return new Set(nodes.map((node) => node.id));
  }
  const allowed = new Set<string>([scope.nodeId]);
  if (!scope.includeDescendants) {
    return allowed;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && allowed.has(node.parentId) && !allowed.has(node.id)) {
        allowed.add(node.id);
        changed = true;
      }
    }
  }
  return allowed;
}

function canAppendGeneratedNode(input: {
  generatedNode: ProjectMapNode;
  currentIds: Set<string>;
  scope: ProjectMapGenerationScope;
  allowedExistingIds: Set<string>;
}): boolean {
  if (input.currentIds.has(input.generatedNode.id)) {
    return false;
  }
  if (input.scope.kind !== "node") {
    return true;
  }
  if (!input.scope.includeDescendants) {
    return false;
  }
  const parentId = input.generatedNode.parentId;
  return Boolean(parentId && (parentId === input.scope.nodeId || input.allowedExistingIds.has(parentId)));
}

function mergeNode(existing: ProjectMapNode, generated: ProjectMapNode): ProjectMapNode {
  const sources = mergeSources(existing.sources, generated.sources);
  const generatedHasSources = generated.sources.length > 0;
  const shouldTrustGeneratedText = generatedHasSources;

  return {
    ...existing,
    title: generated.title || existing.title,
    summary: shouldTrustGeneratedText && generated.summary ? generated.summary : existing.summary,
    detail: {
      coreDescription:
        shouldTrustGeneratedText && generated.detail.coreDescription
          ? generated.detail.coreDescription
          : existing.detail.coreDescription,
      keyFacts: mergeTextArray(existing.detail.keyFacts, generated.detail.keyFacts),
      keyLogic: mergeTextArray(existing.detail.keyLogic, generated.detail.keyLogic),
      riskSignals: mergeTextArray(existing.detail.riskSignals, generated.detail.riskSignals),
      relatedArtifacts: mergeArtifacts(
        existing.detail.relatedArtifacts,
        generated.detail.relatedArtifacts,
      ),
    },
    parentId: existing.parentId ?? generated.parentId,
    children: dedupeBy([...existing.children, ...generated.children], (childId) => childId),
    sources,
    confidence: mergeConfidence(existing.confidence, generated.confidence, generatedHasSources),
    stale: generatedHasSources ? generated.stale : existing.stale || generated.stale,
    candidate: generatedHasSources ? generated.candidate : existing.candidate || generated.candidate,
    lastGeneratedAt: generated.lastGeneratedAt,
    generatedBy: generated.generatedBy,
  };
}

function normalizeChildren(nodes: ProjectMapNode[]): ProjectMapNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childIdsByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId || !nodeIds.has(node.parentId)) {
      continue;
    }
    const children = childIdsByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childIdsByParent.set(node.parentId, children);
  }

  return nodes.map((node) => ({
    ...node,
    parentId: node.parentId && nodeIds.has(node.parentId) ? node.parentId : undefined,
    children: dedupeBy(
      [...node.children, ...(childIdsByParent.get(node.id) ?? [])].filter(
        (childId) => childId !== node.id && nodeIds.has(childId),
      ),
      (childId) => childId,
    ),
  }));
}

export function recalculateProjectMapLensStats(
  lenses: ProjectMapLens[],
  nodes: ProjectMapNode[],
): ProjectMapLensStats[] {
  return lenses.map((lens) => {
    const lensNodes = nodes.filter((node) => node.lensId === lens.id);
    return {
      lensId: lens.id,
      nodeCount: lensNodes.length,
      staleCount: lensNodes.filter((node) => node.stale).length,
      candidateCount: lensNodes.filter((node) => node.candidate).length,
    };
  });
}

export function mergeProjectMapGenerationResult(input: MergeInput): {
  profile: ProjectMapProfile;
  lenses: ProjectMapLens[];
  nodes: ProjectMapNode[];
  lensStats: ProjectMapLensStats[];
} {
  const lenses = mergeLenses(input.dataset.lenses, input.lenses);
  const currentIds = new Set(input.dataset.nodes.map((node) => node.id));
  const generatedById = new Map(input.nodes.map((node) => [node.id, node]));
  const allowedExistingIds = collectScopedExistingIds(input.dataset.nodes, input.scope);

  const mergedExisting = input.dataset.nodes.map((node) => {
    if (!allowedExistingIds.has(node.id)) {
      return node;
    }
    const generatedNode = generatedById.get(node.id);
    if (!generatedNode) {
      return node;
    }
    generatedById.delete(node.id);
    return mergeNode(node, generatedNode);
  });

  const appended = [...generatedById.values()].filter((generatedNode) =>
    canAppendGeneratedNode({
      generatedNode,
      currentIds,
      scope: input.scope,
      allowedExistingIds,
    }),
  );
  const nodes = normalizeChildren([...mergedExisting, ...appended]);

  return {
    profile: mergeProfile(input.dataset.profile, input.profile),
    lenses,
    nodes,
    lensStats: recalculateProjectMapLensStats(lenses, nodes),
  };
}

function collectDescendantIds(nodes: ProjectMapNode[], nodeId: string): Set<string> {
  const deletedIds = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && deletedIds.has(node.parentId) && !deletedIds.has(node.id)) {
        deletedIds.add(node.id);
        changed = true;
      }
    }
  }
  return deletedIds;
}

export function pruneProjectMapNode(input: PruneInput): { ok: true; dataset: ProjectMapDataset } | { ok: false; error: string } {
  const target = input.dataset.nodes.find((node) => node.id === input.nodeId);
  if (!target) {
    return { ok: false, error: `Unknown project-map node: ${input.nodeId}` };
  }

  const deletedIds = target.parentId
    ? collectDescendantIds(input.dataset.nodes, input.nodeId)
    : new Set(input.dataset.nodes.map((node) => node.id));
  const nodes = normalizeChildren(
    input.dataset.nodes
      .filter((node) => !deletedIds.has(node.id))
      .map((node) => ({
        ...node,
        children: node.children.filter((childId) => !deletedIds.has(childId)),
      })),
  );
  const candidates = (input.dataset.candidates ?? []).map((candidate) =>
    deletedIds.has(candidate.targetNodeId ?? candidate.patch.nodeId)
      ? {
          ...candidate,
          status: candidate.status === "pending" ? "rejected" as const : candidate.status,
          updatedAt: input.prunedAt,
        }
      : candidate,
  );
  const lensStats = recalculateProjectMapLensStats(input.dataset.lenses, nodes);

  return {
    ok: true,
    dataset: {
      ...input.dataset,
      nodes,
      candidates,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: input.prunedAt,
        lensStats,
      },
    },
  };
}
