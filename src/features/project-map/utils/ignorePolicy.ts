import type { ProjectMapIgnoreSummary } from "../types";

const DEFAULT_IGNORED_SEGMENTS = new Set([
  ".git",
  ".omx",
  "node_modules",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".cache",
  ".turbo",
  "target",
  "obj",
]);

const DEFAULT_IGNORED_SUFFIXES = [
  ".lock",
  ".log",
  ".map",
  ".min.js",
  ".min.css",
  ".generated.ts",
  ".generated.tsx",
  ".generated.js",
  ".generated.jsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
];

const DEFAULT_IGNORED_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "LICENSE",
  ".editorconfig",
  ".prettierrc",
]);

export function normalizeProjectMapContextPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+/g, "/");
}

export function getProjectMapIgnoredPathReason(path: string): string | null {
  const normalizedPath = normalizeProjectMapContextPath(path);
  if (!normalizedPath) {
    return "empty";
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? normalizedPath;
  const ignoredSegment = segments.find((segment) => DEFAULT_IGNORED_SEGMENTS.has(segment));
  if (ignoredSegment) {
    return `segment:${ignoredSegment}`;
  }
  if (DEFAULT_IGNORED_FILENAMES.has(filename)) {
    return `file:${filename}`;
  }
  const lowerPath = normalizedPath.toLowerCase();
  const ignoredSuffix = DEFAULT_IGNORED_SUFFIXES.find((suffix) => lowerPath.endsWith(suffix));
  if (ignoredSuffix) {
    return `suffix:${ignoredSuffix}`;
  }
  return null;
}

export function filterProjectMapContextPaths(paths: string[]): ProjectMapIgnoreSummary {
  const keptPaths: string[] = [];
  const ignoredPaths: ProjectMapIgnoreSummary["ignoredPaths"] = [];
  const seenKeptPaths = new Set<string>();

  for (const rawPath of paths) {
    const path = normalizeProjectMapContextPath(rawPath);
    const reason = getProjectMapIgnoredPathReason(path);
    if (reason) {
      ignoredPaths.push({ path: path || rawPath, reason });
      continue;
    }
    if (!seenKeptPaths.has(path)) {
      seenKeptPaths.add(path);
      keptPaths.push(path);
    }
  }

  return {
    inputCount: paths.length,
    keptPaths,
    ignoredPaths,
  };
}
