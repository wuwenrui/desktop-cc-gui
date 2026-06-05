import type {
  ProjectMapAgentTaskContext,
  ProjectMapContextPack,
  ProjectMapGovernanceLink,
  ProjectMapNode,
  ProjectMapOpenSpecMetadata,
  ProjectMapRelatedArtifact,
  ProjectMapRelation,
  ProjectMapSource,
  ProjectMapTrellisTaskMetadata,
} from "../types";

type MarkdownHeading = {
  level: number;
  title: string;
  line: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugFromPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .at(-2) ?? path.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function changeIdFromPath(path: string): string | undefined {
  const normalizedPath = path.replace(/\\/g, "/");
  const match = normalizedPath.match(/openspec\/changes\/([^/]+)/);
  return match?.[1];
}

function readMarkdownHeadings(content: string): MarkdownHeading[] {
  return content
    .split(/\r?\n/)
    .flatMap((line, index): MarkdownHeading[] => {
      const match = line.match(/^(#{2,5})\s+(.+)$/);
      if (!match) {
        return [];
      }
      return [{ level: match[1]!.length, title: match[2]!.trim(), line: index + 1 }];
    });
}

function normalizeRequirementTitle(title: string): string | undefined {
  const match = title.match(/^Requirement:\s*(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function normalizeScenarioTitle(title: string): string | undefined {
  const match = title.match(/^Scenario:\s*(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function extractOpenSpecMetadata(input: {
  path: string;
  content: string;
  capabilityId?: string;
  changeId?: string;
}): ProjectMapOpenSpecMetadata[] {
  const capabilityId = input.capabilityId?.trim() || slugFromPath(input.path);
  const changeId = input.changeId?.trim() || changeIdFromPath(input.path);
  const headings = readMarkdownHeadings(input.content);
  const metadata: ProjectMapOpenSpecMetadata[] = [];
  let activeRequirement: { title: string; line: number } | null = null;

  for (const heading of headings) {
    const requirementTitle = normalizeRequirementTitle(heading.title);
    if (requirementTitle) {
      activeRequirement = { title: requirementTitle, line: heading.line };
      metadata.push({
        capabilityId,
        requirementTitle,
        changeId,
        path: input.path,
        line: heading.line,
        summary: requirementTitle,
      });
      continue;
    }
    const scenarioTitle = normalizeScenarioTitle(heading.title);
    if (scenarioTitle) {
      metadata.push({
        capabilityId,
        requirementTitle: activeRequirement?.title,
        scenarioTitle,
        changeId,
        path: input.path,
        line: heading.line,
        summary: scenarioTitle,
      });
    }
  }

  return metadata;
}

export function extractTrellisTaskMetadata(input: {
  path: string;
  content: string;
}): ProjectMapTrellisTaskMetadata | null {
  const pathParts = input.path.replace(/\\/g, "/").split("/").filter(Boolean);
  const taskId = pathParts.at(-2) ?? pathParts.at(-1) ?? "";
  if (!taskId) {
    return null;
  }

  if (input.path.endsWith(".json")) {
    try {
      const parsed = JSON.parse(input.content) as unknown;
      const record = asRecord(parsed);
      if (!record) {
        return null;
      }
      const title =
        asTrimmedString(record.title) ||
        asTrimmedString(record.name) ||
        asTrimmedString(record.slug) ||
        taskId;
      const openspecChangeId =
        asTrimmedString(record.openspecChangeId) ||
        asTrimmedString(record.openSpecChangeId) ||
        asTrimmedString(record.changeId) ||
        undefined;
      return {
        taskId,
        title,
        status: asTrimmedString(record.status) || undefined,
        path: input.path,
        openspecChangeId,
        summary: asTrimmedString(record.summary) || undefined,
      };
    } catch {
      return null;
    }
  }

  const firstHeading = readMarkdownHeadings(input.content)[0];
  return {
    taskId,
    title: firstHeading?.title ?? taskId,
    path: input.path,
    openspecChangeId: input.content.match(/openspec\/changes\/([^/\s]+)/)?.[1],
    summary: input.content.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim(),
  };
}

function isGovernanceSource(source: ProjectMapSource): boolean {
  return source.type === "spec" || source.type === "task" || source.type === "document";
}

function isGovernanceArtifact(artifact: ProjectMapRelatedArtifact): boolean {
  return artifact.type === "spec" || artifact.type === "task" || artifact.type === "document";
}

function linkFromSource(node: ProjectMapNode, source: ProjectMapSource): ProjectMapGovernanceLink {
  const kind = source.type === "spec" ? "spec" : source.type === "task" ? "task" : "document";
  return {
    id: `source:${node.id}:${source.type}:${source.path ?? source.label}`,
    kind,
    label: source.label,
    path: source.path,
    line: source.line,
    nodeId: node.id,
    sourceKind: kind === "spec" ? "spec-link" : kind === "task" ? "task-link" : "doc-link",
    confidence: node.confidence,
    deterministic: true,
  };
}

function linkFromArtifact(node: ProjectMapNode, artifact: ProjectMapRelatedArtifact): ProjectMapGovernanceLink {
  const kind = artifact.type === "spec" ? "spec" : artifact.type === "task" ? "task" : "document";
  return {
    id: `artifact:${node.id}:${artifact.type}:${artifact.path ?? artifact.ref ?? artifact.label}`,
    kind,
    label: artifact.label,
    path: artifact.path,
    line: artifact.line,
    ref: artifact.ref,
    nodeId: node.id,
    sourceKind: kind === "spec" ? "spec-link" : kind === "task" ? "task-link" : "doc-link",
    confidence: node.confidence,
    deterministic: true,
  };
}

function linkFromRelation(relation: ProjectMapRelation): ProjectMapGovernanceLink | null {
  const isGovernanceRelation =
    relation.sourceKind === "spec-link" ||
    relation.sourceKind === "task-link" ||
    relation.sourceKind === "doc-link" ||
    relation.type === "specified_by" ||
    relation.type === "validated_by" ||
    relation.type === "documents" ||
    relation.type === "task_candidate_for";
  if (!isGovernanceRelation) {
    return null;
  }
  const kind =
    relation.sourceKind === "task-link" || relation.type === "task_candidate_for"
      ? "task"
      : relation.sourceKind === "doc-link" || relation.type === "documents"
        ? "document"
        : "spec";
  return {
    id: `relation:${relation.id}`,
    kind,
    label: relation.label ?? relation.type,
    nodeId: relation.sourceNodeId,
    relationId: relation.id,
    relationType: relation.type,
    sourceKind: relation.sourceKind,
    confidence: relation.confidence,
    deterministic: relation.sourceKind !== "llm-inferred",
  };
}

export function collectProjectMapGovernanceLinks(input: {
  nodes: ProjectMapNode[];
  relations: ProjectMapRelation[];
}): ProjectMapGovernanceLink[] {
  const links = [
    ...input.nodes.flatMap((node) => [
      ...node.sources.filter(isGovernanceSource).map((source) => linkFromSource(node, source)),
      ...node.detail.relatedArtifacts.filter(isGovernanceArtifact).map((artifact) => linkFromArtifact(node, artifact)),
    ]),
    ...input.relations.flatMap((relation) => {
      const link = linkFromRelation(relation);
      return link ? [link] : [];
    }),
  ];
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.id)) {
      return false;
    }
    seen.add(link.id);
    return true;
  });
}

export function buildProjectMapAgentTaskContext(
  contextPack: ProjectMapContextPack,
): ProjectMapAgentTaskContext {
  const nodeIds = [
    ...contextPack.matchedNodes.map((node) => node.id),
    ...contextPack.relatedNodes.map((node) => node.id),
  ];
  const deterministicGovernanceEvidence = contextPack.governanceEvidence.filter(
    (link) => link.deterministic,
  );
  const inferredGovernanceEvidence = contextPack.governanceEvidence.filter(
    (link) => !link.deterministic,
  );
  return {
    contextPackId: contextPack.id,
    selectedNodeId: contextPack.selectedNode?.id ?? null,
    nodeIds,
    relationIds: contextPack.relations.map((relation) => relation.id),
    deterministicGovernanceEvidence,
    inferredGovernanceEvidence,
    evidenceSources: contextPack.evidenceSources,
    riskFlags: contextPack.riskFlags,
  };
}
