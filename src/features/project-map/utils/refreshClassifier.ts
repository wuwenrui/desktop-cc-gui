import type {
  ProjectMapChangedFileFingerprint,
  ProjectMapDataset,
  ProjectMapRefreshClassification,
  ProjectMapRefreshReasonKind,
  ProjectMapRefreshSummary,
  ProjectMapStaleReason,
} from "../types";
import {
  getProjectMapIgnoredPathReason,
  normalizeProjectMapContextPath,
} from "./ignorePolicy";

const FULL_REFRESH_CHANGE_THRESHOLD = 30;

function normalizeChangedFile(
  value: string | ProjectMapChangedFileFingerprint,
): ProjectMapChangedFileFingerprint | null {
  const rawPath = typeof value === "string" ? value : value.path;
  const path = normalizeProjectMapContextPath(rawPath);
  if (!path) {
    return null;
  }
  return {
    path,
    currentHash: typeof value === "string" ? undefined : value.currentHash ?? undefined,
  };
}

function uniqueChangedFiles(
  values: Array<string | ProjectMapChangedFileFingerprint>,
): ProjectMapChangedFileFingerprint[] {
  const seen = new Set<string>();
  const changedFiles: ProjectMapChangedFileFingerprint[] = [];
  for (const value of values) {
    const changedFile = normalizeChangedFile(value);
    if (!changedFile || seen.has(changedFile.path)) {
      continue;
    }
    seen.add(changedFile.path);
    changedFiles.push(changedFile);
  }
  return changedFiles;
}

function classifyPath(path: string): {
  kind: ProjectMapRefreshReasonKind;
  recommendation: ProjectMapRefreshClassification;
  label: string;
} {
  if (
    /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|cargo\.toml|go\.mod|pom\.xml)$/.test(path) ||
    /(^|\/)(vite|webpack|rollup|tsconfig|eslint|tailwind|tauri)\.[^/]+$/.test(path)
  ) {
    return {
      kind: "architecture-changed",
      recommendation: "architecture-refresh",
      label: "Architecture/build input changed",
    };
  }
  if (path.startsWith("openspec/")) {
    return {
      kind: "spec-changed",
      recommendation: "partial-refresh",
      label: "OpenSpec evidence changed",
    };
  }
  if (path.startsWith(".trellis/tasks/")) {
    return {
      kind: "task-changed",
      recommendation: "partial-refresh",
      label: "Trellis task evidence changed",
    };
  }
  if (/\.(css|scss|sass|png|jpg|jpeg|gif|webp|ico|svg)$/.test(path)) {
    return {
      kind: "cosmetic",
      recommendation: "skip",
      label: "Cosmetic asset/style change",
    };
  }
  if (/^(src|src-tauri|app|lib|packages)\//.test(path)) {
    return {
      kind: "source-changed",
      recommendation: "partial-refresh",
      label: "Source evidence changed",
    };
  }
  return {
    kind: "unknown",
    recommendation: "partial-refresh",
    label: "Project evidence changed",
  };
}

function getObservedHashes(dataset: ProjectMapDataset): Map<string, Set<string>> {
  const hashesByPath = new Map<string, Set<string>>();
  for (const node of dataset.nodes) {
    for (const source of node.sources) {
      const path = source.path ? normalizeProjectMapContextPath(source.path) : "";
      if (!path || !source.hash) {
        continue;
      }
      const hashes = hashesByPath.get(path) ?? new Set<string>();
      hashes.add(source.hash);
      hashesByPath.set(path, hashes);
    }
  }
  for (const record of dataset.evidenceRecords ?? []) {
    const path = record.source.path ? normalizeProjectMapContextPath(record.source.path) : "";
    if (!path || !record.observedHash) {
      continue;
    }
    const hashes = hashesByPath.get(path) ?? new Set<string>();
    hashes.add(record.observedHash);
    hashesByPath.set(path, hashes);
  }
  return hashesByPath;
}

function strongestClassification(
  classifications: ProjectMapRefreshClassification[],
): ProjectMapRefreshClassification {
  if (classifications.includes("full-refresh-suggested")) {
    return "full-refresh-suggested";
  }
  if (classifications.includes("architecture-refresh")) {
    return "architecture-refresh";
  }
  if (classifications.includes("partial-refresh")) {
    return "partial-refresh";
  }
  return "skip";
}

function labelForClassification(classification: ProjectMapRefreshClassification): string {
  if (classification === "full-refresh-suggested") {
    return "Full Project Map refresh suggested";
  }
  if (classification === "architecture-refresh") {
    return "Architecture refresh suggested";
  }
  if (classification === "partial-refresh") {
    return "Partial refresh suggested";
  }
  return "No refresh required";
}

export function classifyProjectMapRefresh(input: {
  dataset: ProjectMapDataset;
  changedFiles: Array<string | ProjectMapChangedFileFingerprint>;
  now?: string;
}): ProjectMapRefreshSummary {
  const changedFiles = uniqueChangedFiles(input.changedFiles);
  const observedHashes = getObservedHashes(input.dataset);
  const ignoredPaths = changedFiles.flatMap((changedFile) => {
    const reason = getProjectMapIgnoredPathReason(changedFile.path);
    return reason ? [{ path: changedFile.path, reason }] : [];
  });
  const ignoredPathSet = new Set(ignoredPaths.map((item) => item.path));
  const staleReasons: ProjectMapStaleReason[] = [];

  for (const changedFile of changedFiles) {
    if (ignoredPathSet.has(changedFile.path)) {
      staleReasons.push({
        id: `refresh:${changedFile.path}:ignored`,
        kind: "ignored",
        label: "Ignored by Project Map policy",
        path: changedFile.path,
        recommendation: "skip",
      });
      continue;
    }
    const observed = observedHashes.get(changedFile.path);
    if (changedFile.currentHash && observed?.has(changedFile.currentHash)) {
      staleReasons.push({
        id: `refresh:${changedFile.path}:fingerprint`,
        kind: "fingerprint-matched",
        label: "Fingerprint already matches observed Project Map evidence",
        path: changedFile.path,
        currentHash: changedFile.currentHash,
        recommendation: "skip",
      });
      continue;
    }
    const classification = classifyPath(changedFile.path);
    staleReasons.push({
      id: `refresh:${changedFile.path}:${classification.kind}`,
      kind: classification.kind,
      label: classification.label,
      path: changedFile.path,
      currentHash: changedFile.currentHash,
      recommendation: classification.recommendation,
    });
  }

  const actionableReasons = staleReasons.filter((reason) => reason.recommendation !== "skip");
  const classification =
    actionableReasons.length > FULL_REFRESH_CHANGE_THRESHOLD
      ? "full-refresh-suggested"
      : strongestClassification(staleReasons.map((reason) => reason.recommendation));

  return {
    classification,
    label: labelForClassification(classification),
    changedPaths: changedFiles.map((changedFile) => changedFile.path),
    ignoredPaths,
    staleReasons,
    evaluatedAt: input.now ?? new Date().toISOString(),
  };
}

export function getProjectMapNodeStaleReasons(input: {
  nodeId: string;
  dataset: ProjectMapDataset;
  refreshSummary: ProjectMapRefreshSummary;
}): ProjectMapStaleReason[] {
  const node = input.dataset.nodes.find((candidate) => candidate.id === input.nodeId);
  if (!node) {
    return [];
  }
  const sourcePaths = new Set(
    node.sources.flatMap((source) => {
      const path = source.path ? normalizeProjectMapContextPath(source.path) : "";
      return path ? [path] : [];
    }),
  );
  return [
    ...(node.staleReasons ?? []),
    ...input.refreshSummary.staleReasons.filter((reason) => reason.path && sourcePaths.has(reason.path)),
  ];
}

