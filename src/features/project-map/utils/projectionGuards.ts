import { normalizeProjectMapContextPath } from "./ignorePolicy";
import { inferProjectMapWorkspaceFilePath } from "./evidencePaths";

export const PROJECT_MAP_DEFAULT_GROUP_LIMIT = 8;
export const PROJECT_MAP_DEFAULT_PREVIEW_LIMIT = 180;

export type ProjectMapNormalizedPath = {
  rawPath: string;
  displayPath: string;
  comparisonKey: string;
  workspaceRelativePath: string | null;
  line: number | null;
  degraded: boolean;
  reason?: "empty" | "outside-workspace" | "unsupported";
};

function stripLineSuffix(value: string): { path: string; line: number | null } {
  const match = value.match(/^(.*?):(\d+)(?::\d+)?$/);
  if (!match?.[1] || !match[2]) {
    return { path: value, line: null };
  }
  const line = Number.parseInt(match[2], 10);
  return {
    path: match[1],
    line: sanitizeProjectMapLineNumber(line),
  };
}

function isAbsoluteOrUnsafePath(value: string): boolean {
  return (
    value.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    value.startsWith("../") ||
    value.includes("/../") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
  );
}

function sanitizeProjectMapLineNumber(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function sanitizeProjectionLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function normalizeProjectMapProjectionPath(input: {
  path?: string | null;
  label?: string | null;
  ref?: string | null;
  line?: number | null;
}): ProjectMapNormalizedPath {
  const rawCandidate = input.path ?? input.label ?? input.ref ?? "";
  const displayPath = String(rawCandidate).trim();
  const withLine = stripLineSuffix(displayPath);
  const explicitLine = sanitizeProjectMapLineNumber(input.line);
  const rawPath = withLine.path.trim();
  const inferredPath = inferProjectMapWorkspaceFilePath({
    path: rawPath,
    label: input.label,
    ref: input.ref,
  });
  const normalizedContextPath = normalizeProjectMapContextPath(inferredPath || rawPath);
  const comparisonKey = normalizedContextPath.toLowerCase();
  const unsafe = isAbsoluteOrUnsafePath(normalizedContextPath);
  const workspaceRelativePath = !unsafe && inferredPath ? normalizeProjectMapContextPath(inferredPath) : null;
  const degraded = !workspaceRelativePath;

  return {
    rawPath,
    displayPath: displayPath || rawPath,
    comparisonKey,
    workspaceRelativePath,
    line: explicitLine ?? withLine.line,
    degraded,
    reason: !rawPath ? "empty" : unsafe ? "outside-workspace" : degraded ? "unsupported" : undefined,
  };
}

export function projectMapPathMatches(left: string, right: string): boolean {
  const leftPath = normalizeProjectMapProjectionPath({ path: left });
  const rightPath = normalizeProjectMapProjectionPath({ path: right });
  const normalizedLeft = leftPath.workspaceRelativePath?.toLowerCase() ?? "";
  const normalizedRight = rightPath.workspaceRelativePath?.toLowerCase() ?? "";
  if (!normalizedLeft || !normalizedRight || leftPath.degraded || rightPath.degraded) {
    return false;
  }
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.endsWith(`/${normalizedRight}`) ||
    normalizedRight.endsWith(`/${normalizedLeft}`)
  );
}

export function capProjectMapProjectionItems<T>(items: T[], limit = PROJECT_MAP_DEFAULT_GROUP_LIMIT): {
  items: T[];
  capped: boolean;
  totalCount: number;
} {
  const safeLimit = sanitizeProjectionLimit(limit);
  return {
    items: items.slice(0, safeLimit),
    capped: items.length > safeLimit,
    totalCount: items.length,
  };
}

export function buildProjectMapBoundedPreview(
  value: string,
  limit = PROJECT_MAP_DEFAULT_PREVIEW_LIMIT,
): string {
  const safeLimit = sanitizeProjectionLimit(limit);
  if (safeLimit === 0) {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= safeLimit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, safeLimit - 1)).trimEnd()}…`;
}

export function uniqueProjectMapStrings(values: Iterable<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
  }
  return results;
}
