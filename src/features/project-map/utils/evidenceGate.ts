import type {
  ProjectMapConfidence,
  ProjectMapEvidencePriority,
  ProjectMapNode,
  ProjectMapNodePatch,
  ProjectMapSource,
  ProjectMapSourceType,
} from "../types";

const SOURCE_PRIORITY: Record<ProjectMapSourceType, ProjectMapEvidencePriority> = {
  file: "code",
  symbol: "code",
  spec: "spec",
  task: "task",
  document: "document",
  test: "tests",
  commit: "commit",
  conversation: "memory",
};

const PRIORITY_SCORE: Record<ProjectMapEvidencePriority, number> = {
  code: 5,
  spec: 4,
  task: 4,
  document: 3,
  tests: 3,
  commit: 2,
  memory: 1,
};

export type ProjectMapEvidenceGateIssue = {
  code:
    | "missing_source"
    | "memory_only_high_confidence"
    | "unsupported_key_fact"
    | "unsupported_risk_signal"
    | "summary_too_long";
  message: string;
};

export type ProjectMapEvidenceGateResult = {
  ok: boolean;
  confidence: ProjectMapConfidence;
  issues: ProjectMapEvidenceGateIssue[];
};

function sourcePriority(source: ProjectMapSource): ProjectMapEvidencePriority {
  return SOURCE_PRIORITY[source.type];
}

function hasNonMemorySource(sources: ProjectMapSource[]): boolean {
  return sources.some((source) => sourcePriority(source) !== "memory");
}

function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function sourceMentionsClaim(source: ProjectMapSource, claim: string): boolean {
  const normalizedClaim = normalizeClaim(claim);
  if (!normalizedClaim) {
    return true;
  }
  const searchable = normalizeClaim(
    [source.label, source.path, source.excerpt].filter(Boolean).join(" "),
  );
  return searchable.includes(normalizedClaim.split(" ").slice(0, 4).join(" "));
}

function resolvePatchSources(node: ProjectMapNode, patch: ProjectMapNodePatch): ProjectMapSource[] {
  return patch.sources ?? node.sources;
}

export function sortSourcesByEvidencePriority(
  sources: ProjectMapSource[],
): ProjectMapSource[] {
  return [...sources].sort((left, right) => {
    const scoreDelta = PRIORITY_SCORE[sourcePriority(right)] - PRIORITY_SCORE[sourcePriority(left)];
    return scoreDelta || left.label.localeCompare(right.label);
  });
}

export function validateProjectMapNodePatch(
  node: ProjectMapNode,
  patch: ProjectMapNodePatch,
): ProjectMapEvidenceGateResult {
  const sources = resolvePatchSources(node, patch);
  const confidence = patch.confidence ?? node.confidence;
  const issues: ProjectMapEvidenceGateIssue[] = [];

  if (sources.length === 0 && confidence !== "unknown") {
    issues.push({
      code: "missing_source",
      message: "Confirmed project-map node claims require at least one source.",
    });
  }

  if (confidence === "high" && sources.length > 0 && !hasNonMemorySource(sources)) {
    issues.push({
      code: "memory_only_high_confidence",
      message: "Memory-only evidence cannot create high-confidence code-fact claims.",
    });
  }

  for (const fact of patch.detail?.keyFacts ?? []) {
    if (sources.length > 0 && !sources.some((source) => sourceMentionsClaim(source, fact))) {
      issues.push({
        code: "unsupported_key_fact",
        message: `Key fact is not traceable to a source: ${fact}`,
      });
    }
  }

  for (const riskSignal of patch.detail?.riskSignals ?? []) {
    if (sources.length > 0 && !sources.some((source) => sourceMentionsClaim(source, riskSignal))) {
      issues.push({
        code: "unsupported_risk_signal",
        message: `Risk signal is not traceable to a source: ${riskSignal}`,
      });
    }
  }

  if ((patch.summary ?? node.summary).length > 160) {
    issues.push({
      code: "summary_too_long",
      message: "Graph node summary must stay concise; extended detail belongs in inspector.",
    });
  }

  return {
    ok: issues.length === 0,
    confidence: issues.some((issue) => issue.code === "missing_source") ? "unknown" : confidence,
    issues,
  };
}

export function markStaleNodesBySourceHash(
  nodes: ProjectMapNode[],
  currentHashes: Map<string, string>,
): ProjectMapNode[] {
  return nodes.map((node) => {
    const stale = node.sources.some((source) => {
      if (!source.path || !source.hash) {
        return false;
      }
      const currentHash = currentHashes.get(source.path);
      return Boolean(currentHash && currentHash !== source.hash);
    });

    if (!stale) {
      return node;
    }

    return {
      ...node,
      stale: true,
      confidence: node.confidence === "high" ? "medium" : node.confidence,
    };
  });
}
