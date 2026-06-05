import type {
  ProjectMapFileRelation,
  ProjectMapRelationshipAgentReadPlan,
  ProjectMapRelationshipHotspot,
  ProjectMapRelationshipImpactSummary,
  ProjectMapRelationshipModuleSummary,
  ProjectMapRelationshipReadResponse,
  ProjectMapRelationshipRepairIssue,
  ProjectMapRelationshipScanResponse,
  ProjectMapRelationshipStaleReason,
  ProjectMapRelationshipStaleSummary,
  ProjectMapScannedFile,
} from "../types";

export type ProjectMapRelationshipDashboardData = {
  files: ProjectMapScannedFile[];
  relations: ProjectMapFileRelation[];
  modules: ProjectMapRelationshipModuleSummary[];
  hotspots: ProjectMapRelationshipHotspot[];
  impactSummary: ProjectMapRelationshipImpactSummary | null;
  contextPack: ProjectMapRelationshipAgentReadPlan | null;
  staleSummary: ProjectMapRelationshipStaleSummary | null;
  repairIssues: ProjectMapRelationshipRepairIssue[];
  readErrors: Array<{ path: string; message: string }>;
};

const PROJECT_MAP_RELATIONSHIP_ROLE_PRIORITY: Record<string, number> = {
  controller: 10,
  route: 15,
  service: 20,
  repository: 30,
  entity: 35,
  component: 40,
  hook: 45,
  command: 50,
  module: 55,
  type: 60,
  test: 70,
  manifest: 80,
  config: 90,
  document: 100,
  infra: 110,
  migration: 120,
  style: 130,
  unknown: 140,
};

const PROJECT_MAP_RELATIONSHIP_TYPE_PRIORITY: Record<string, number> = {
  imports: 10,
  calls: 15,
  bridges_to: 20,
  tested_by: 30,
  specified_by: 40,
  documents: 50,
  configures: 60,
  styled_by: 70,
  contains: 80,
  exports: 90,
  related: 100,
};

export function normalizeProjectMapRelationshipError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown relationship scan failure.";
}

function isProjectMapRelationshipRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProjectMapRelationshipString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : null;
}

function readProjectMapRelationshipNumber(
  value: Record<string, unknown>,
  key: string,
): number {
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field) ? field : 0;
}

export function normalizeProjectMapRelationshipReadSummary(
  response: ProjectMapRelationshipReadResponse,
): ProjectMapRelationshipScanResponse | null {
  const manifest = response.manifest;
  if (!response.exists || !isProjectMapRelationshipRecord(manifest)) {
    return null;
  }
  const scanRunId = readProjectMapRelationshipString(manifest, "scanRunId");
  const generatedAt = readProjectMapRelationshipString(manifest, "generatedAt");
  if (!scanRunId || !generatedAt) {
    return null;
  }

  return {
    storageKey:
      readProjectMapRelationshipString(manifest, "storageKey") ?? response.storageKey,
    storageDir: response.storageDir,
    scanRunId,
    generatedAt,
    scannedRoot: readProjectMapRelationshipString(manifest, "scannedRoot") ?? "",
    fileCount: readProjectMapRelationshipNumber(manifest, "fileCount"),
    relationCount: readProjectMapRelationshipNumber(manifest, "relationCount"),
    ignoredCount: readProjectMapRelationshipNumber(manifest, "ignoredCount"),
    repairIssueCount: readProjectMapRelationshipNumber(manifest, "repairIssueCount"),
  };
}

function readProjectMapRelationshipStringArray(
  value: Record<string, unknown>,
  key: string,
): string[] {
  const field = value[key];
  if (!Array.isArray(field)) {
    return [];
  }
  return field.filter((item): item is string => typeof item === "string");
}

function normalizeProjectMapRelationshipConfidence(
  value: unknown,
): ProjectMapFileRelation["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function normalizeProjectMapRelationshipType(value: unknown): ProjectMapFileRelation["type"] {
  const normalized = typeof value === "string" ? value : "related";
  switch (normalized) {
    case "imports":
    case "exports":
    case "calls":
    case "contains":
    case "tested_by":
    case "styled_by":
    case "specified_by":
    case "documents":
    case "configures":
    case "bridges_to":
    case "related":
      return normalized;
    default:
      return "related";
  }
}

function normalizeProjectMapScannedFiles(value: unknown): ProjectMapScannedFile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const id = readProjectMapRelationshipString(item, "id");
    const path = readProjectMapRelationshipString(item, "path");
    if (!id || !path) {
      return [];
    }
    return [{
      id,
      path,
      basename: readProjectMapRelationshipString(item, "basename") ?? path.split("/").pop() ?? path,
      extension: readProjectMapRelationshipString(item, "extension") ?? "",
      language: (readProjectMapRelationshipString(item, "language") ?? "unknown") as ProjectMapScannedFile["language"],
      layer: (readProjectMapRelationshipString(item, "layer") ?? "unknown") as ProjectMapScannedFile["layer"],
      role: (readProjectMapRelationshipString(item, "role") ?? "unknown") as ProjectMapScannedFile["role"],
      sizeBytes: readProjectMapRelationshipNumber(item, "sizeBytes"),
      lineCount: readProjectMapRelationshipNumber(item, "lineCount"),
      contentHash: readProjectMapRelationshipString(item, "contentHash") ?? "",
      parseStatus: (readProjectMapRelationshipString(item, "parseStatus") ?? "skipped") as ProjectMapScannedFile["parseStatus"],
    }];
  });
}

function normalizeProjectMapFileRelations(value: unknown): ProjectMapFileRelation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const id = readProjectMapRelationshipString(item, "id");
    const sourceFileId = readProjectMapRelationshipString(item, "sourceFileId");
    const targetFileId = readProjectMapRelationshipString(item, "targetFileId");
    if (!id || !sourceFileId || !targetFileId) {
      return [];
    }
    const relationType = item.type ?? item.relationType;
    const evidence = Array.isArray(item.evidence)
      ? item.evidence.flatMap((entry) => {
          if (!isProjectMapRelationshipRecord(entry)) {
            return [];
          }
          const path = readProjectMapRelationshipString(entry, "path");
          if (!path) {
            return [];
          }
          return [{
            path,
            line: readProjectMapRelationshipNumber(entry, "line") || undefined,
            excerpt: readProjectMapRelationshipString(entry, "excerpt") ?? undefined,
            extractorVersion:
              readProjectMapRelationshipString(entry, "extractorVersion") ?? undefined,
            observedAt: readProjectMapRelationshipString(entry, "observedAt") ?? undefined,
          }];
        })
      : [];

    return [{
      id,
      sourceFileId,
      targetFileId,
      type: normalizeProjectMapRelationshipType(relationType),
      direction: "forward",
      confidence: normalizeProjectMapRelationshipConfidence(item.confidence),
      sourceKind: "deterministic",
      evidence,
      fingerprint: readProjectMapRelationshipString(item, "fingerprint") ?? undefined,
    }];
  });
}

function normalizeProjectMapRelationshipModules(
  value: unknown,
): ProjectMapRelationshipModuleSummary[] {
  if (!isProjectMapRelationshipRecord(value) || !Array.isArray(value.modules)) {
    return [];
  }
  return value.modules.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const id = readProjectMapRelationshipString(item, "id");
    const label = readProjectMapRelationshipString(item, "label");
    if (!id || !label) {
      return [];
    }
    return [{
      id,
      label,
      fileIds: readProjectMapRelationshipStringArray(item, "fileIds"),
      fileCount: readProjectMapRelationshipNumber(item, "fileCount"),
      relationCount: readProjectMapRelationshipNumber(item, "relationCount"),
    }];
  });
}

function normalizeProjectMapRelationshipHotspotReason(
  value: string,
): ProjectMapRelationshipHotspot["reason"] {
  switch (value) {
    case "many-dependents":
    case "cross-layer-hub":
    case "missing-test":
    case "stale":
    case "large-file":
      return value;
    default:
      return "many-dependents";
  }
}

function normalizeProjectMapRelationshipHotspots(value: unknown): ProjectMapRelationshipHotspot[] {
  if (!isProjectMapRelationshipRecord(value) || !Array.isArray(value.hotspots)) {
    return [];
  }
  return value.hotspots.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const fileId = readProjectMapRelationshipString(item, "fileId");
    const reason = readProjectMapRelationshipString(item, "reason");
    if (!fileId || !reason) {
      return [];
    }
    return [{
      fileId,
      reason: normalizeProjectMapRelationshipHotspotReason(reason),
      score: readProjectMapRelationshipNumber(item, "score"),
      rationale: readProjectMapRelationshipString(item, "rationale") ?? undefined,
    }];
  });
}

function normalizeProjectMapRelationshipRiskFlags(
  value: unknown,
): ProjectMapRelationshipImpactSummary["riskFlags"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const id = readProjectMapRelationshipString(item, "id");
    const label = readProjectMapRelationshipString(item, "label");
    if (!id || !label) {
      return [];
    }
    const severity = readProjectMapRelationshipString(item, "severity");
    return [{
      id,
      label,
      severity: severity === "critical" || severity === "warning" ? severity : "info",
      nodeId: readProjectMapRelationshipString(item, "nodeId")
        ?? readProjectMapRelationshipString(item, "fileId")
        ?? undefined,
    }];
  });
}

function normalizeProjectMapRelationshipImpactSummary(
  value: unknown,
): ProjectMapRelationshipImpactSummary | null {
  if (!isProjectMapRelationshipRecord(value)) {
    return null;
  }
  const generatedAt = readProjectMapRelationshipString(value, "generatedAt");
  if (!generatedAt) {
    return null;
  }
  return {
    schemaVersion: 1,
    generatedAt,
    inputFiles: readProjectMapRelationshipStringArray(value, "inputFiles"),
    changedFiles: readProjectMapRelationshipStringArray(value, "changedFiles"),
    directlyAffectedFiles: readProjectMapRelationshipStringArray(value, "directlyAffectedFiles"),
    transitivelyAffectedFiles: readProjectMapRelationshipStringArray(value, "transitivelyAffectedFiles"),
    unmappedFiles: readProjectMapRelationshipStringArray(value, "unmappedFiles"),
    ignoredFiles: readProjectMapRelationshipStringArray(value, "ignoredFiles"),
    riskFlags: normalizeProjectMapRelationshipRiskFlags(value.riskFlags),
  };
}

function normalizeProjectMapRelationshipContextPack(
  value: unknown,
): ProjectMapRelationshipAgentReadPlan | null {
  if (!isProjectMapRelationshipRecord(value)) {
    return null;
  }
  const generatedAt = readProjectMapRelationshipString(value, "generatedAt");
  const provenance = isProjectMapRelationshipRecord(value.provenance) ? value.provenance : null;
  const scanRunId = provenance
    ? readProjectMapRelationshipString(provenance, "scanRunId")
    : null;
  if (!generatedAt || !scanRunId) {
    return null;
  }
  return {
    schemaVersion: 1,
    generatedAt,
    mustReadFiles: readProjectMapRelationshipStringArray(value, "mustReadFiles"),
    relatedFiles: readProjectMapRelationshipStringArray(value, "relatedFiles"),
    testTargets: readProjectMapRelationshipStringArray(value, "testTargets"),
    contracts: readProjectMapRelationshipStringArray(value, "contracts"),
    riskFlags: normalizeProjectMapRelationshipRiskFlags(value.riskFlags),
    staleReason: readProjectMapRelationshipString(value, "staleReason") ?? undefined,
    staleReasons: normalizeProjectMapRelationshipStaleReasons(value.staleReasons),
    provenance: {
      scanRunId,
      relationIds: provenance ? readProjectMapRelationshipStringArray(provenance, "relationIds") : [],
      fileIds: provenance ? readProjectMapRelationshipStringArray(provenance, "fileIds") : [],
    },
  };
}

function normalizeProjectMapRelationshipStaleReasons(value: unknown): ProjectMapRelationshipStaleReason[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const message = readProjectMapRelationshipString(item, "message");
    if (!message) {
      return [];
    }
    const kind = readProjectMapRelationshipString(item, "kind") ?? "fingerprint-changed";
    const normalizedKind: ProjectMapRelationshipStaleReason["kind"] =
      kind === "git-commit-changed" ||
      kind === "fingerprint-changed" ||
      kind === "unmapped-changed-file" ||
      kind === "file-read-failed" ||
      kind === "scan-scope-warning"
        ? kind
        : "fingerprint-changed";
    return [{
      kind: normalizedKind,
      message,
      path: readProjectMapRelationshipString(item, "path") ?? undefined,
      previous: readProjectMapRelationshipString(item, "previous") ?? undefined,
      current: readProjectMapRelationshipString(item, "current") ?? undefined,
    }];
  });
}

function normalizeProjectMapRelationshipStaleSummary(value: unknown): ProjectMapRelationshipStaleSummary | null {
  if (!isProjectMapRelationshipRecord(value)) {
    return null;
  }
  const generatedAt = readProjectMapRelationshipString(value, "generatedAt");
  if (!generatedAt || typeof value.isFresh !== "boolean") {
    return null;
  }
  const suggestedMode = isProjectMapRelationshipRecord(value.refreshSuggestion)
    ? readProjectMapRelationshipString(value.refreshSuggestion, "mode")
    : undefined;
  const refreshMode: NonNullable<ProjectMapRelationshipStaleSummary["refreshSuggestion"]>["mode"] =
    suggestedMode === "partial" || suggestedMode === "ignore-only" ? suggestedMode : "full";
  const refreshSuggestion = isProjectMapRelationshipRecord(value.refreshSuggestion)
    ? {
        mode: refreshMode,
        changedFiles: readProjectMapRelationshipStringArray(value.refreshSuggestion, "changedFiles"),
        reason: readProjectMapRelationshipString(value.refreshSuggestion, "reason") ?? "",
      }
    : null;
  return {
    schemaVersion: 1,
    generatedAt,
    isFresh: value.isFresh,
    reasons: normalizeProjectMapRelationshipStaleReasons(value.reasons),
    staleFileCount: readProjectMapRelationshipNumber(value, "staleFileCount"),
    changedFiles: readProjectMapRelationshipStringArray(value, "changedFiles"),
    refreshSuggestion,
  };
}

function normalizeProjectMapRelationshipRepairIssues(
  value: unknown,
): ProjectMapRelationshipRepairIssue[] {
  if (!isProjectMapRelationshipRecord(value) || !Array.isArray(value.issues)) {
    return [];
  }
  return value.issues.flatMap((item) => {
    if (!isProjectMapRelationshipRecord(item)) {
      return [];
    }
    const id = readProjectMapRelationshipString(item, "id");
    const message = readProjectMapRelationshipString(item, "message");
    if (!id || !message) {
      return [];
    }
    return [{
      id,
      kind: (readProjectMapRelationshipString(item, "kind") ?? "unresolved-target") as ProjectMapRelationshipRepairIssue["kind"],
      severity: (readProjectMapRelationshipString(item, "severity") ?? "warning") as ProjectMapRelationshipRepairIssue["severity"],
      message,
      fileId: readProjectMapRelationshipString(item, "fileId") ?? undefined,
      relationId: readProjectMapRelationshipString(item, "relationId") ?? undefined,
      path: readProjectMapRelationshipString(item, "path") ?? undefined,
      action: (readProjectMapRelationshipString(item, "action") ?? "ignored") as ProjectMapRelationshipRepairIssue["action"],
    }];
  });
}

export function normalizeProjectMapRelationshipDashboardData(
  response: ProjectMapRelationshipReadResponse,
): ProjectMapRelationshipDashboardData {
  return {
    files: normalizeProjectMapScannedFiles(response.files),
    relations: normalizeProjectMapFileRelations(response.relations),
    modules: normalizeProjectMapRelationshipModules(response.modules),
    hotspots: normalizeProjectMapRelationshipHotspots(response.modules),
    impactSummary: normalizeProjectMapRelationshipImpactSummary(response.impact),
    contextPack: normalizeProjectMapRelationshipContextPack(response.contextPack),
    staleSummary: normalizeProjectMapRelationshipStaleSummary(response.stale),
    repairIssues: normalizeProjectMapRelationshipRepairIssues(response.repair),
    readErrors: response.readErrors ?? [],
  };
}

export function getProjectMapRelationshipRoleRank(role: string): number {
  return PROJECT_MAP_RELATIONSHIP_ROLE_PRIORITY[role] ?? 150;
}

export function getProjectMapRelationshipTypeRank(type: string): number {
  return PROJECT_MAP_RELATIONSHIP_TYPE_PRIORITY[type] ?? 120;
}

export function getProjectMapRelationshipConfidenceRank(confidence: ProjectMapFileRelation["confidence"]): number {
  switch (confidence) {
    case "high":
      return 10;
    case "medium":
      return 20;
    default:
      return 30;
  }
}

export function isProjectMapRelationshipNoiseFile(file: ProjectMapScannedFile): boolean {
  const path = file.path.toLowerCase();
  if (
    path.startsWith(".agents/")
    || path.startsWith(".codex/")
    || path.startsWith(".claude/")
    || path.startsWith(".trellis/")
    || path.startsWith("openspec/")
    || path.startsWith("docs/")
  ) {
    return true;
  }
  return file.parseStatus === "skipped"
    || file.role === "document"
    || file.role === "infra"
    || file.role === "style"
    || file.role === "unknown";
}

export function buildProjectMapRelationshipSentence(input: {
  relation: ProjectMapFileRelation;
  sourceFile?: ProjectMapScannedFile;
  targetFile?: ProjectMapScannedFile;
}): string {
  const source = input.sourceFile?.basename ?? input.relation.sourceFileId;
  const target = input.targetFile?.basename ?? input.relation.targetFileId;
  switch (input.relation.type) {
    case "imports":
      return `${source} imports ${target}`;
    case "calls":
      return `${source} calls ${target}`;
    case "bridges_to":
      return `${source} calls command in ${target}`;
    case "tested_by":
      return `${source} is tested by ${target}`;
    case "documents":
      return `${source} documents ${target}`;
    case "configures":
      return `${source} configures ${target}`;
    case "styled_by":
      return `${source} is styled by ${target}`;
    case "specified_by":
      return `${source} is specified by ${target}`;
    case "contains":
      return `${source} contains ${target}`;
    case "exports":
      return `${source} exports symbols`;
    default:
      return `${source} relates to ${target}`;
  }
}

export function getProjectMapRelationshipCallCandidate(relation: ProjectMapFileRelation): string | null {
  if (relation.type !== "calls") {
    return null;
  }
  const excerpt = relation.evidence[0]?.excerpt?.trim();
  if (!excerpt) {
    return null;
  }
  const match = /^calls\s+(.+)$/i.exec(excerpt);
  return match?.[1]?.trim() || excerpt;
}

export function getProjectMapRelationshipRoleColor(role: string): string {
  switch (role) {
    case "controller":
    case "route":
      return "#62b4ff";
    case "service":
      return "#65d49f";
    case "repository":
    case "entity":
      return "#d4a574";
    case "component":
    case "hook":
      return "#78dce8";
    case "test":
      return "#c6e86d";
    case "manifest":
    case "config":
      return "#f2c66d";
    case "document":
      return "#b9a5ff";
    case "style":
      return "#e08bb0";
    case "infra":
    case "migration":
      return "#9aa6b8";
    default:
      return "#8ea0b8";
  }
}
