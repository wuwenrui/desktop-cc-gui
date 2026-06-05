import type { GitFileStatus } from "../../../types";
import type { ProjectMapImpactSourceMetadata } from "../types";
import { normalizeProjectMapContextPath } from "./ignorePolicy";

export type ProjectMapImpactInput = {
  filePaths: string[];
  source: ProjectMapImpactSourceMetadata;
};

function uniqueNormalizedPaths(paths: string[]): string[] {
  const seenPaths = new Set<string>();
  const uniquePaths: string[] = [];
  for (const path of paths) {
    const normalizedPath = normalizeProjectMapContextPath(path);
    if (!normalizedPath || seenPaths.has(normalizedPath)) {
      continue;
    }
    seenPaths.add(normalizedPath);
    uniquePaths.push(normalizedPath);
  }
  return uniquePaths;
}

export function buildExplicitProjectMapImpactInput(paths: string[]): ProjectMapImpactInput {
  const filePaths = uniqueNormalizedPaths(paths);
  return {
    filePaths,
    source: {
      kind: filePaths.length > 0 ? "explicit" : "none",
      label: filePaths.length > 0 ? "Explicit changed files" : "No impact source",
      fileCount: filePaths.length,
    },
  };
}

export function buildGitStatusProjectMapImpactInput(files: GitFileStatus[]): ProjectMapImpactInput {
  const filePaths = uniqueNormalizedPaths(files.map((file) => file.path));
  return {
    filePaths,
    source: {
      kind: filePaths.length > 0 ? "git-status" : "none",
      label: filePaths.length > 0 ? "Git status" : "No git changes",
      fileCount: filePaths.length,
    },
  };
}
