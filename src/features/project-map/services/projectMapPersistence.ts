import { invoke } from "@tauri-apps/api/core";

import type {
  ProjectMapAutoIngestionSettings,
  ProjectMapCandidate,
  ProjectMapDataset,
  ProjectMapEvidenceRecord,
  ProjectMapLens,
  ProjectMapManifest,
  ProjectMapMemoryIngestionCursor,
  ProjectMapNode,
  ProjectMapProfile,
  ProjectMapRunMetadata,
  ProjectMapStorageLocation,
} from "../types";
import { deriveProjectMapStorageKey } from "../utils/storageKey";

export const PROJECT_MAP_SCHEMA_VERSION = 2;
const PROJECT_MAP_WRITE_TIMEOUT_MS = 20_000;
const MAX_SAFE_PATH_SEGMENT_LENGTH = 64;

export type ProjectMapReadResponse = {
  storageKey: string;
  storageDir: string;
  exists: boolean;
  manifest?: unknown;
  profile?: unknown;
  lenses?: unknown;
  lensNodes: Record<string, unknown>;
  settings?: unknown;
  cursor?: unknown;
  processed?: unknown;
  candidates: Record<string, unknown>;
  evidence: Record<string, unknown>;
  runs: Record<string, unknown>;
};

export type ProjectMapWriteFile = {
  relativePath: string;
  content: string;
};

export type ProjectMapWriteSnapshotInput = {
  workspaceId: string;
  files: ProjectMapWriteFile[];
  createBackup?: boolean;
  storageLocation?: ProjectMapStorageLocation;
};

export type ProjectMapStorageIdentity = {
  projectName: string;
  workspacePath: string;
  workspaceId?: string | null;
};

async function withProjectMapWriteTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(
        new Error(
          "Project map write did not finish within 20s. Please retry after checking workspace file permissions.",
        ),
      );
    }, PROJECT_MAP_WRITE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

const DEFAULT_AUTO_INGESTION_SETTINGS: ProjectMapAutoIngestionSettings = {
  enabled: false,
  engine: "codex",
  model: "default",
  newSessionThreshold: 5,
  checkIntervalMinutes: 30,
  applyMode: "createCandidate",
};

const DEFAULT_MEMORY_CURSOR: ProjectMapMemoryIngestionCursor = {
  lastCheckedAt: new Date(0).toISOString(),
  processedMessages: [],
  pendingMessages: [],
};

const WINDOWS_RESERVED_PATH_SEGMENTS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

function normalizePathSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, MAX_SAFE_PATH_SEGMENT_LENGTH)
    .replace(/[._-]+$/g, "");
  const candidate = normalized || fallback;
  return WINDOWS_RESERVED_PATH_SEGMENTS.has(candidate) ? `lens-${candidate}` : candidate;
}

function uniquePathSegment(value: string, used: Set<string>, fallback: string): string {
  const base = normalizePathSegment(value, fallback);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    const suffix = `-${index}`;
    candidate = `${base.slice(0, MAX_SAFE_PATH_SEGMENT_LENGTH - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

export function createEmptyProjectMapDataset(input: {
  identity: ProjectMapStorageIdentity;
  storageKey?: string;
  now?: string;
}): ProjectMapDataset {
  const now = input.now ?? new Date().toISOString();
  const storageKey = input.storageKey ?? deriveProjectMapStorageKey(input.identity);

  return {
    manifest: {
      schemaVersion: PROJECT_MAP_SCHEMA_VERSION,
      projectName: input.identity.projectName,
      workspacePath: input.identity.workspacePath,
      storageKey,
      createdAt: now,
      updatedAt: now,
      lastRunId: null,
      sourceRootHash: null,
      lensStats: [],
    },
    profile: {
      primaryLanguage: "unknown",
      languages: ["unknown"],
      shapes: ["unknown"],
      frameworks: [],
      interfaceKinds: ["unknown"],
      buildSystems: [],
    },
    lenses: [],
    nodes: [],
    runs: [],
    candidates: [],
    evidenceRecords: [],
    autoIngestionSettings: { ...DEFAULT_AUTO_INGESTION_SETTINGS },
    memoryCursor: {
      lastCheckedAt: DEFAULT_MEMORY_CURSOR.lastCheckedAt,
      processedMessages: [],
      pendingMessages: [],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function safeArray<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function isProjectMapLens(value: unknown): value is ProjectMapLens {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string";
}

function isProjectMapNode(value: unknown): value is ProjectMapNode {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.lensId === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.children)
  );
}

function isProjectMapRun(value: unknown): value is ProjectMapRunMetadata {
  return isRecord(value) && typeof value.id === "string" && typeof value.kind === "string";
}

function isProjectMapCandidate(value: unknown): value is ProjectMapCandidate {
  return isRecord(value) && typeof value.id === "string" && isRecord(value.patch);
}

function isProjectMapEvidenceRecord(value: unknown): value is ProjectMapEvidenceRecord {
  return isRecord(value) && typeof value.id === "string" && isRecord(value.source);
}

function sanitizeManifest(
  value: unknown,
  identity: ProjectMapStorageIdentity,
): ProjectMapManifest | null {
  if (!isRecord(value) || typeof value.schemaVersion !== "number") {
    return null;
  }
  if (value.schemaVersion > PROJECT_MAP_SCHEMA_VERSION) {
    return null;
  }

  return {
    schemaVersion: PROJECT_MAP_SCHEMA_VERSION,
    projectName: typeof value.projectName === "string" ? value.projectName : identity.projectName,
    workspacePath:
      typeof value.workspacePath === "string" ? value.workspacePath : identity.workspacePath,
    storageKey:
      typeof value.storageKey === "string"
        ? value.storageKey
        : deriveProjectMapStorageKey(identity),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    lastRunId: typeof value.lastRunId === "string" ? value.lastRunId : null,
    sourceRootHash: typeof value.sourceRootHash === "string" ? value.sourceRootHash : null,
    lensStats: Array.isArray(value.lensStats) ? (value.lensStats as ProjectMapManifest["lensStats"]) : [],
  };
}

function sanitizeProfile(value: unknown): ProjectMapProfile | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    primaryLanguage:
      typeof value.primaryLanguage === "string"
        ? (value.primaryLanguage as ProjectMapProfile["primaryLanguage"])
        : "unknown",
    languages: isStringArray(value.languages)
      ? (value.languages as ProjectMapProfile["languages"])
      : ["unknown"],
    shapes: isStringArray(value.shapes) ? (value.shapes as ProjectMapProfile["shapes"]) : ["unknown"],
    frameworks: Array.isArray(value.frameworks)
      ? (value.frameworks as ProjectMapProfile["frameworks"])
      : [],
    interfaceKinds: isStringArray(value.interfaceKinds)
      ? (value.interfaceKinds as ProjectMapProfile["interfaceKinds"])
      : ["unknown"],
    buildSystems: isStringArray(value.buildSystems) ? value.buildSystems : [],
  };
}

function sanitizeSettings(value: unknown): ProjectMapAutoIngestionSettings {
  if (!isRecord(value)) {
    return DEFAULT_AUTO_INGESTION_SETTINGS;
  }
  return {
    enabled: value.enabled === true,
    engine: typeof value.engine === "string" ? value.engine : DEFAULT_AUTO_INGESTION_SETTINGS.engine,
    model: typeof value.model === "string" ? value.model : DEFAULT_AUTO_INGESTION_SETTINGS.model,
    newSessionThreshold:
      typeof value.newSessionThreshold === "number"
        ? Math.max(1, Math.min(50, Math.floor(value.newSessionThreshold)))
        : DEFAULT_AUTO_INGESTION_SETTINGS.newSessionThreshold,
    checkIntervalMinutes:
      typeof value.checkIntervalMinutes === "number"
        ? Math.max(5, Math.min(1440, Math.floor(value.checkIntervalMinutes)))
        : DEFAULT_AUTO_INGESTION_SETTINGS.checkIntervalMinutes,
    applyMode:
      value.applyMode === "autoApplyEvidenceBacked" ? "autoApplyEvidenceBacked" : "createCandidate",
  };
}

function sanitizeCursor(value: unknown): ProjectMapMemoryIngestionCursor {
  if (!isRecord(value)) {
    return DEFAULT_MEMORY_CURSOR;
  }
  const processedMessages = safeArray(value.processedMessages, (item): item is ProjectMapMemoryIngestionCursor["processedMessages"][number] => {
    return isRecord(item) && typeof item.sessionId === "string" && typeof item.messageHash === "string";
  });
  const pendingMessages = safeArray(value.pendingMessages, (item): item is ProjectMapMemoryIngestionCursor["pendingMessages"][number] => {
    return isRecord(item) && typeof item.sessionId === "string" && typeof item.messageHash === "string";
  });
  return {
    lastCheckedAt:
      typeof value.lastCheckedAt === "string" ? value.lastCheckedAt : DEFAULT_MEMORY_CURSOR.lastCheckedAt,
    processedMessages,
    pendingMessages,
    lastRunId: typeof value.lastRunId === "string" ? value.lastRunId : undefined,
  };
}

export function buildDatasetFromProjectMapRead(
  response: ProjectMapReadResponse,
  identity: ProjectMapStorageIdentity,
): ProjectMapDataset | null {
  const manifest = sanitizeManifest(response.manifest, identity);
  const profile = sanitizeProfile(response.profile);
  const lenses = safeArray(
    isRecord(response.lenses) ? response.lenses.items : response.lenses,
    isProjectMapLens,
  );
  const nodes = Object.values(response.lensNodes).flatMap((value) =>
    safeArray(isRecord(value) ? value.items : value, isProjectMapNode),
  );

  if (!manifest || !profile) {
    return null;
  }

  return {
    manifest,
    profile,
    lenses,
    nodes,
    runs: Object.values(response.runs).flatMap((value) =>
      safeArray(isRecord(value) ? value.items : [value], isProjectMapRun),
    ),
    candidates: Object.values(response.candidates).flatMap((value) =>
      safeArray(isRecord(value) ? value.items : [value], isProjectMapCandidate),
    ),
    evidenceRecords: Object.values(response.evidence).flatMap((value) =>
      safeArray(isRecord(value) ? value.items : [value], isProjectMapEvidenceRecord),
    ),
    autoIngestionSettings: sanitizeSettings(response.settings),
    memoryCursor: sanitizeCursor(response.cursor),
  };
}

export function serializeProjectMapDataset(dataset: ProjectMapDataset): ProjectMapWriteFile[] {
  const lensIds = new Set(dataset.lenses.map((lens) => lens.id));
  const usedLensPathSegments = new Set<string>();
  const lensPathSegmentById = new Map(
    [...lensIds].map((lensId, index) => [
      lensId,
      uniquePathSegment(lensId, usedLensPathSegments, `lens-${index + 1}`),
    ]),
  );
  const files: ProjectMapWriteFile[] = [
    { relativePath: "manifest.json", content: JSON.stringify(dataset.manifest, null, 2) },
    { relativePath: "profile.json", content: JSON.stringify(dataset.profile, null, 2) },
    { relativePath: "lenses/manifest.json", content: JSON.stringify({ items: dataset.lenses }, null, 2) },
    { relativePath: "settings.json", content: JSON.stringify(dataset.autoIngestionSettings, null, 2) },
    { relativePath: "memory-ingestion/cursor.json", content: JSON.stringify(dataset.memoryCursor, null, 2) },
    {
      relativePath: "memory-ingestion/processed.json",
      content: JSON.stringify({ items: dataset.memoryCursor.processedMessages }, null, 2),
    },
    { relativePath: "runs/latest.json", content: JSON.stringify({ items: dataset.runs }, null, 2) },
    {
      relativePath: "candidates/latest.json",
      content: JSON.stringify({ items: dataset.candidates ?? [] }, null, 2),
    },
    {
      relativePath: "evidence/latest.json",
      content: JSON.stringify({ items: dataset.evidenceRecords ?? [] }, null, 2),
    },
  ];

  for (const lensId of lensIds) {
    const lensPathSegment = lensPathSegmentById.get(lensId) ?? "overview";
    files.push({
      relativePath: `lenses/${lensPathSegment}/nodes.json`,
      content: JSON.stringify(
        { items: dataset.nodes.filter((node) => node.lensId === lensId) },
        null,
        2,
      ),
    });
  }

  return files;
}

export async function readProjectMapDataset(input: {
  workspaceId: string;
  identity: ProjectMapStorageIdentity;
  storageMode?: ProjectMapStorageLocation;
}): Promise<{ dataset: ProjectMapDataset | null; response: ProjectMapReadResponse }> {
  const response = await invoke<ProjectMapReadResponse>("project_map_read", {
    workspaceId: input.workspaceId,
    storageMode: input.storageMode,
  });
  return {
    response,
    dataset: response.exists ? buildDatasetFromProjectMapRead(response, input.identity) : null,
  };
}

export async function writeProjectMapDataset(input: {
  workspaceId: string;
  dataset: ProjectMapDataset;
  createBackup?: boolean;
  storageLocation?: ProjectMapStorageLocation;
}): Promise<void> {
  await withProjectMapWriteTimeout(
    invoke("project_map_write_snapshot", {
      workspaceId: input.workspaceId,
      files: serializeProjectMapDataset(input.dataset),
      createBackup: input.createBackup ?? false,
      storageMode: input.storageLocation,
    }),
  );
}

export async function writeProjectMapFiles(input: ProjectMapWriteSnapshotInput): Promise<void> {
  await withProjectMapWriteTimeout(
    invoke("project_map_write_snapshot", {
      workspaceId: input.workspaceId,
      files: input.files,
      createBackup: input.createBackup ?? false,
      storageMode: input.storageLocation,
    }),
  );
}
