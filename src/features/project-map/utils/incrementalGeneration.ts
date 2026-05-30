import type {
  ProjectMapDataset,
  ProjectMapDiagramArtifact,
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
const PROJECT_CORE_NODE_ID = "project-core";
export const PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID = "unassigned-discoveries";

export type ProjectMapDerivedNodeRole =
  | "root"
  | "structural"
  | "capability"
  | "task"
  | "risk"
  | "artifact"
  | "evidence"
  | "workflow";

const STRUCTURAL_NODE_KINDS = new Set([
  "api",
  "application",
  "app",
  "backend",
  "build",
  "cross-cutting",
  "data",
  "dependency",
  "engine",
  "frontend",
  "governance",
  "interface",
  "layer",
  "module",
  "package",
  "platform",
  "project",
  "runtime",
  "subsystem",
  "system",
  "tech-stack",
  "workspace",
]);
const CAPABILITY_NODE_KINDS = new Set(["capability", "concept", "flow"]);
const NON_STRUCTURAL_NODE_KINDS = new Map<string, ProjectMapDerivedNodeRole>([
  ["artifact", "artifact"],
  ["boot strap", "workflow"],
  ["bootstrap", "workflow"],
  ["bug", "task"],
  ["bugfix", "task"],
  ["ci", "workflow"],
  ["config", "artifact"],
  ["configuration", "artifact"],
  ["controller", "artifact"],
  ["dto", "artifact"],
  ["decision", "evidence"],
  ["diagnostic", "evidence"],
  ["diagnostic subsystem", "evidence"],
  ["domain", "artifact"],
  ["entity", "artifact"],
  ["infra", "artifact"],
  ["infrastructure", "artifact"],
  ["repository", "artifact"],
  ["risk", "risk"],
  ["security", "artifact"],
  ["service", "artifact"],
  ["style", "artifact"],
  ["test", "task"],
  ["test module", "task"],
  ["util", "artifact"],
  ["utility", "artifact"],
  ["workflow", "workflow"],
  ["仓储", "artifact"],
  ["仓库", "artifact"],
  ["测试", "task"],
  ["单元测试", "task"],
  ["集成测试", "task"],
  ["服务", "artifact"],
  ["实体", "artifact"],
  ["控制器", "artifact"],
  ["配置", "artifact"],
]);
const ROLE_TEXT_PATTERNS: Array<{
  role: ProjectMapDerivedNodeRole;
  pattern: RegExp;
}> = [
  { role: "task", pattern: /\b(bugfix|fix|task|todo|parser test|test module|sentry|unit test|integration test|单元测试|集成测试)\b/i },
  { role: "risk", pattern: /\b(risk|stale|regression|failure|noise)\b/i },
  { role: "artifact", pattern: /\b(artifact|document|markdown|changelog|report|spec|controller|service|repository|entity|dto|config|configuration|util|utility)\b/i },
  { role: "workflow", pattern: /\b(workflow|pipeline|release|governance|ci|bootstrap)\b/i },
];
const MODULE_STRUCTURAL_PATTERNS = /\b(app|application|architecture|backend|bounded context|build|capability group|domain|engine|frontend|governance|layer|package|platform|project|runtime|security domain|subsystem|sub system|system|workspace|api surface|应用|后端|前端|子系统|分层|架构|模块域|能力域|治理|平台|项目|工作区)\b/i;

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

function normalizeRoleText(value: string): string {
  return value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
}

function splitRoleTokens(value: string): string[] {
  return normalizeRoleText(value).split(/\s+/).filter(Boolean);
}

function getNodeRoleSearchText(node: ProjectMapNode): string {
  return [
    node.nodeKind,
    node.title,
    node.summary,
    node.detail.coreDescription,
    ...node.detail.riskSignals,
  ].join(" ");
}

function getModuleStructureSearchText(node: ProjectMapNode): string {
  return [node.nodeKind, node.title, node.summary].join(" ");
}

function isConcreteModuleNode(node: ProjectMapNode): boolean {
  const text = getNodeRoleSearchText(node);
  return ROLE_TEXT_PATTERNS.some(({ role, pattern }) => role !== "workflow" && pattern.test(text));
}

export function deriveProjectMapNodeRole(node: ProjectMapNode): ProjectMapDerivedNodeRole {
  if (node.id === PROJECT_CORE_NODE_ID) {
    return "root";
  }
  if (node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID || node.id.startsWith("hub-")) {
    return "structural";
  }

  const normalizedKind = normalizeRoleText(node.nodeKind);
  const explicitRole = NON_STRUCTURAL_NODE_KINDS.get(normalizedKind);
  if (explicitRole) {
    return explicitRole;
  }
  const kindTokens = splitRoleTokens(node.nodeKind);
  const tokenRole = kindTokens
    .map((token) => NON_STRUCTURAL_NODE_KINDS.get(token))
    .find((role): role is ProjectMapDerivedNodeRole => Boolean(role));
  if (tokenRole) {
    return tokenRole;
  }
  if (normalizedKind === "project" || normalizedKind === "workspace") {
    return "root";
  }
  if (normalizedKind.includes("module")) {
    if (isConcreteModuleNode(node)) {
      return "artifact";
    }
    if (MODULE_STRUCTURAL_PATTERNS.test(getModuleStructureSearchText(node))) {
      return "structural";
    }
    return node.children.length > 0 ? "structural" : "artifact";
  }
  if (STRUCTURAL_NODE_KINDS.has(normalizedKind)) {
    return "structural";
  }
  if (CAPABILITY_NODE_KINDS.has(normalizedKind)) {
    return "capability";
  }

  const searchText = getNodeRoleSearchText(node);
  const matchedPattern = ROLE_TEXT_PATTERNS.find(({ pattern }) => pattern.test(searchText));
  return matchedPattern?.role ?? "capability";
}

export function canProjectMapNodeAttachToRoot(node: ProjectMapNode): boolean {
  const role = deriveProjectMapNodeRole(node);
  return role === "root" || role === "structural" || role === "capability";
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

function diagramArtifactKey(artifact: ProjectMapDiagramArtifact): string {
  return [
    safeKeyText(artifact.id),
    artifact.path ?? "",
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

function mergeDiagramArtifacts(
  existing: ProjectMapNode["detail"]["diagramArtifacts"] | undefined,
  generated: ProjectMapNode["detail"]["diagramArtifacts"] | undefined,
): ProjectMapDiagramArtifact[] {
  return dedupeBy(
    [...(existing ?? []), ...(generated ?? [])].filter(
      (artifact) => artifact.id.trim().length > 0 && artifact.label.trim().length > 0 && artifact.path.trim().length > 0,
    ),
    diagramArtifactKey,
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
      diagramArtifacts: mergeDiagramArtifacts(
        existing.detail.diagramArtifacts,
        generated.detail.diagramArtifacts,
      ),
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

function getProjectMapNodeTimestamp(node: ProjectMapNode): number {
  const timestamp = Date.parse(node.lastGeneratedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDuplicateNodePriority(node: ProjectMapNode): number {
  return (
    (node.id === PROJECT_CORE_NODE_ID ? 32 : 0) +
    (node.parentId ? 12 : 0) +
    Math.min(node.children.length, 8) * 2 +
    Math.min(node.sources.length, 6) +
    CONFIDENCE_RANK[node.confidence]
  );
}

function compareDuplicateNodePriority(left: ProjectMapNode, right: ProjectMapNode): number {
  return (
    getDuplicateNodePriority(right) - getDuplicateNodePriority(left) ||
    getProjectMapNodeTimestamp(right) - getProjectMapNodeTimestamp(left) ||
    left.lensId.localeCompare(right.lensId) ||
    left.title.localeCompare(right.title)
  );
}

function mergeDuplicateNode(canonical: ProjectMapNode, duplicate: ProjectMapNode): ProjectMapNode {
  const duplicateIsNewer = getProjectMapNodeTimestamp(duplicate) > getProjectMapNodeTimestamp(canonical);
  const duplicateHasSources = duplicate.sources.length > 0;
  return {
    ...canonical,
    detail: {
      coreDescription: canonical.detail.coreDescription || duplicate.detail.coreDescription,
      keyFacts: mergeTextArray(canonical.detail.keyFacts, duplicate.detail.keyFacts),
      keyLogic: mergeTextArray(canonical.detail.keyLogic, duplicate.detail.keyLogic),
      riskSignals: mergeTextArray(canonical.detail.riskSignals, duplicate.detail.riskSignals),
      diagramArtifacts: mergeDiagramArtifacts(
        canonical.detail.diagramArtifacts,
        duplicate.detail.diagramArtifacts,
      ),
      relatedArtifacts: mergeArtifacts(
        canonical.detail.relatedArtifacts,
        duplicate.detail.relatedArtifacts,
      ),
    },
    parentId: canonical.parentId ?? duplicate.parentId,
    children: dedupeBy([...canonical.children, ...duplicate.children], (childId) => childId),
    sources: mergeSources(canonical.sources, duplicate.sources),
    confidence: mergeConfidence(canonical.confidence, duplicate.confidence, duplicateHasSources),
    stale: canonical.stale || duplicate.stale,
    candidate: canonical.candidate || duplicate.candidate,
    lastGeneratedAt: duplicateIsNewer ? duplicate.lastGeneratedAt : canonical.lastGeneratedAt,
    generatedBy: duplicateIsNewer ? duplicate.generatedBy : canonical.generatedBy,
  };
}

function mergeDuplicateNodesById(nodes: ProjectMapNode[]): ProjectMapNode[] {
  const groupedNodes = new Map<string, ProjectMapNode[]>();
  const orderedIds: string[] = [];

  for (const node of nodes) {
    const group = groupedNodes.get(node.id);
    if (group) {
      group.push(node);
      continue;
    }
    groupedNodes.set(node.id, [node]);
    orderedIds.push(node.id);
  }

  return orderedIds.map((nodeId) => {
    const group = groupedNodes.get(nodeId) ?? [];
    const [canonicalNode, ...duplicateNodes] = [...group].sort(compareDuplicateNodePriority);
    if (!canonicalNode) {
      throw new Error(`Missing project-map node group for ${nodeId}`);
    }
    return duplicateNodes.reduce(mergeDuplicateNode, canonicalNode);
  });
}

function getProjectMapMergeRoot(nodes: ProjectMapNode[]): ProjectMapNode | null {
  return (
    nodes.find((node) => node.id === PROJECT_CORE_NODE_ID) ??
    nodes.find((node) => !node.parentId) ??
    nodes[0] ??
    null
  );
}

function createUnassignedDiscoveriesNode(input: {
  rootNodeId: string;
  now: string;
  generatedBy: ProjectMapNode["generatedBy"];
  lensId: ProjectMapNode["lensId"];
}): ProjectMapNode {
  return {
    id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    lensId: input.lensId,
    nodeKind: "cross-cutting",
    title: "待整理发现 Unassigned Discoveries",
    summary: "尚未可靠归属到具体模块或能力的 Project Map 发现项。",
    detail: {
      coreDescription: "用于临时承载缺少可靠父节点的任务、风险、产物、测试或 workflow 发现。",
      keyFacts: [],
      keyLogic: [],
      riskSignals: [],
      relatedArtifacts: [],
    },
    parentId: input.rootNodeId,
    children: [],
    sources: [],
    confidence: "unknown",
    stale: false,
    candidate: true,
    lastGeneratedAt: input.now,
    generatedBy: input.generatedBy,
  };
}

function ensureUnassignedDiscoveriesNode(input: {
  nodes: ProjectMapNode[];
  rootNode: ProjectMapNode;
  required: boolean;
}): ProjectMapNode[] {
  if (!input.required) {
    return input.nodes;
  }
  const existingNode = input.nodes.find((node) => node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID);
  if (existingNode) {
    return input.nodes.map((node) =>
      node.id === existingNode.id
        ? {
            ...node,
            parentId: input.rootNode.id,
          }
        : node,
    );
  }

  return [
    ...input.nodes,
    createUnassignedDiscoveriesNode({
      rootNodeId: input.rootNode.id,
      now: input.rootNode.lastGeneratedAt,
      generatedBy: input.rootNode.generatedBy,
      lensId: input.rootNode.lensId,
    }),
  ];
}

export function normalizeProjectMapNodeTopology(
  nodes: ProjectMapNode[],
  options: { attachOrphansToRoot?: boolean } = {},
): ProjectMapNode[] {
  const uniqueNodes = mergeDuplicateNodesById(nodes);
  const nodeIds = new Set(uniqueNodes.map((node) => node.id));
  const rootNode = getProjectMapMergeRoot(uniqueNodes);
  const rootNodeId = rootNode?.id ?? null;
  let needsUnassignedDiscoveries = false;
  const normalizedParents = uniqueNodes.map((node) => {
    let parentId =
      node.parentId && node.parentId !== node.id && nodeIds.has(node.parentId)
        ? node.parentId
        : undefined;

    if (rootNodeId && node.id !== rootNodeId) {
      const canAttachToRoot = canProjectMapNodeAttachToRoot(node);
      if (parentId === rootNodeId && !canAttachToRoot) {
        parentId = PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID;
        needsUnassignedDiscoveries = true;
      } else if (options.attachOrphansToRoot && !parentId) {
        parentId = canAttachToRoot ? rootNodeId : PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID;
        needsUnassignedDiscoveries = needsUnassignedDiscoveries || !canAttachToRoot;
      }
    }

    return {
      ...node,
      parentId,
    };
  });
  const parentsWithTriage = rootNode
    ? ensureUnassignedDiscoveriesNode({
        nodes: normalizedParents,
        rootNode,
        required: needsUnassignedDiscoveries,
      })
    : normalizedParents;
  const normalizedNodeIds = new Set(parentsWithTriage.map((node) => node.id));
  const childIdsByParent = new Map<string, string[]>();
  for (const node of parentsWithTriage) {
    if (!node.parentId) {
      continue;
    }
    const children = childIdsByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childIdsByParent.set(node.parentId, children);
  }
  const parentIdByNodeId = new Map(
    parentsWithTriage
      .filter((node) => node.parentId)
      .map((node) => [node.id, node.parentId as string]),
  );

  return parentsWithTriage.map((node) => ({
    ...node,
    children: dedupeBy(
      [
        ...node.children.filter((childId) => {
          const childParentId = parentIdByNodeId.get(childId);
          return !childParentId || childParentId === node.id;
        }),
        ...(childIdsByParent.get(node.id) ?? []),
      ].filter((childId) => childId !== node.id && normalizedNodeIds.has(childId)),
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
  const nodes = normalizeProjectMapNodeTopology([...mergedExisting, ...appended], {
    attachOrphansToRoot: input.scope.kind === "auto",
  });

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
  const nodes = normalizeProjectMapNodeTopology(
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
  const nodeLayouts = input.dataset.viewState
    ? Object.fromEntries(
        Object.entries(input.dataset.viewState.nodeLayouts).filter(
          ([nodeId]) => !deletedIds.has(nodeId),
        ),
      )
    : {};
  const lensStats = recalculateProjectMapLensStats(input.dataset.lenses, nodes);

  return {
    ok: true,
    dataset: {
      ...input.dataset,
      nodes,
      candidates,
      viewState: input.dataset.viewState
        ? {
            ...input.dataset.viewState,
            nodeLayouts,
            updatedAt: input.prunedAt,
          }
        : undefined,
      manifest: {
        ...input.dataset.manifest,
        updatedAt: input.prunedAt,
        lensStats,
      },
    },
  };
}
