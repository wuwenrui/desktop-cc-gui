import type {
  BranchInfo,
  GitBranchListDiagnostic,
  GitBranchListRepositoryState,
} from "../../../types";

export type NormalizedGitBranchList = {
  branches: BranchInfo[];
  repositoryState: GitBranchListRepositoryState;
  diagnostic: GitBranchListDiagnostic | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBranchInfo(value: unknown): BranchInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = String(value.name ?? "").trim();
  if (!name) {
    return null;
  }
  return {
    name,
    lastCommit: Number(value.lastCommit ?? value.last_commit ?? 0),
  };
}

function normalizeRepositoryState(value: unknown): GitBranchListRepositoryState {
  return value === "git_repository" ||
    value === "not_git_repository" ||
    value === "unknown"
    ? value
    : "git_repository";
}

function normalizeDiagnostic(value: unknown): GitBranchListDiagnostic | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = String(value.kind ?? "").trim();
  if (!kind) {
    return null;
  }
  return {
    kind,
    reason: typeof value.reason === "string" ? value.reason : null,
    message: typeof value.message === "string" ? value.message : null,
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : null,
    pathKind: typeof value.pathKind === "string" ? value.pathKind : null,
  };
}

export function normalizeGitBranchListResponse(response: unknown): NormalizedGitBranchList {
  const legacyResult =
    isRecord(response) && isRecord(response.result) ? response.result : undefined;
  const branchSource =
    isRecord(response) && Array.isArray(response.branches)
      ? response.branches
      : legacyResult && Array.isArray(legacyResult.branches)
        ? legacyResult.branches
        : Array.isArray(response)
          ? response
          : [];
  const repositoryState = isRecord(response)
    ? normalizeRepositoryState(response.repositoryState)
    : "git_repository";
  const diagnostic = isRecord(response)
    ? normalizeDiagnostic(response.diagnostic)
    : null;

  return {
    branches: branchSource.flatMap((item) => {
      const normalized = normalizeBranchInfo(item);
      return normalized ? [normalized] : [];
    }),
    repositoryState,
    diagnostic,
  };
}
