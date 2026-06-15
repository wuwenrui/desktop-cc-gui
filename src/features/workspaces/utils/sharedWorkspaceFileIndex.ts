export type SharedWorkspaceFileIndexEntry = {
  path: string;
  pathTokens: string[];
  directoryTokens: string[];
};

export type SharedWorkspaceFileIndex = {
  workspaceId: string;
  sourceVersion: string;
  freshness: "fresh" | "partial" | "stale";
  files: SharedWorkspaceFileIndexEntry[];
  directories: SharedWorkspaceFileIndexEntry[];
  invalidatedPaths: string[];
  updatedAt: number;
};

type UpsertSharedWorkspaceFileIndexInput = {
  workspaceId: string;
  sourceVersion: string | null;
  files: string[];
  directories: string[];
  partial: boolean;
  invalidatedPaths?: string[];
};

const sharedWorkspaceFileIndexes = new Map<string, SharedWorkspaceFileIndex>();

function normalizeWorkspaceIndexPath(path: string): string {
  return path.trim().replace(/\\/g, "/");
}

export function tokenizeWorkspacePath(path: string): string[] {
  return path
    .split(/[\\/._\-\s]+/u)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function createSharedWorkspaceFileIndexEntry(
  path: string,
): SharedWorkspaceFileIndexEntry {
  const normalizedPath = normalizeWorkspaceIndexPath(path);
  const parts = normalizedPath.split("/").filter(Boolean);
  const directoryPath = parts.slice(0, -1).join("/");
  return {
    path: normalizedPath,
    pathTokens: tokenizeWorkspacePath(normalizedPath),
    directoryTokens: tokenizeWorkspacePath(directoryPath),
  };
}

export function upsertSharedWorkspaceFileIndex(
  input: UpsertSharedWorkspaceFileIndexInput,
): SharedWorkspaceFileIndex | null {
  const sourceVersion = input.sourceVersion?.trim();
  if (!sourceVersion) {
    return null;
  }
  const index: SharedWorkspaceFileIndex = {
    workspaceId: input.workspaceId,
    sourceVersion,
    freshness: input.partial ? "partial" : "fresh",
    files: input.files.map(createSharedWorkspaceFileIndexEntry),
    directories: input.directories.map(createSharedWorkspaceFileIndexEntry),
    invalidatedPaths: Array.from(
      new Set((input.invalidatedPaths ?? []).map(normalizeWorkspaceIndexPath).filter(Boolean)),
    ),
    updatedAt: Date.now(),
  };
  sharedWorkspaceFileIndexes.set(input.workspaceId, index);
  return index;
}

export function readSharedWorkspaceFileIndex(input: {
  workspaceId: string;
  sourceVersion?: string | null;
}): SharedWorkspaceFileIndex | null {
  const index = sharedWorkspaceFileIndexes.get(input.workspaceId);
  if (!index) {
    return null;
  }
  if (input.sourceVersion && index.sourceVersion !== input.sourceVersion) {
    return null;
  }
  return index;
}

export function invalidateSharedWorkspaceFileIndex(input: {
  workspaceId: string;
  changedPaths?: string[];
}) {
  const index = sharedWorkspaceFileIndexes.get(input.workspaceId);
  if (!index) {
    return;
  }
  const changedPaths = (input.changedPaths ?? [])
    .map(normalizeWorkspaceIndexPath)
    .filter(Boolean);
  if (changedPaths.length === 0) {
    sharedWorkspaceFileIndexes.delete(input.workspaceId);
    return;
  }
  sharedWorkspaceFileIndexes.set(input.workspaceId, {
    ...index,
    freshness: "stale",
    invalidatedPaths: Array.from(new Set([...index.invalidatedPaths, ...changedPaths])),
    updatedAt: Date.now(),
  });
}

export function clearSharedWorkspaceFileIndexes() {
  sharedWorkspaceFileIndexes.clear();
}
