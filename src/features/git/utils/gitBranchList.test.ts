import { describe, expect, it } from "vitest";

import { normalizeGitBranchListResponse } from "./gitBranchList";

describe("normalizeGitBranchListResponse", () => {
  it("returns neutral state for non-Git workspace branch responses", () => {
    const normalized = normalizeGitBranchListResponse({
      branches: [],
      localBranches: [],
      remoteBranches: [],
      currentBranch: null,
      repositoryState: "not_git_repository",
      diagnostic: {
        kind: "neutral_non_repository",
        reason: "missing_git_marker",
        workspaceId: "ws-1",
        pathKind: "workspace_path",
      },
    });

    expect(normalized).toEqual({
      branches: [],
      repositoryState: "not_git_repository",
      diagnostic: {
        kind: "neutral_non_repository",
        reason: "missing_git_marker",
        message: null,
        workspaceId: "ws-1",
        pathKind: "workspace_path",
      },
    });
  });

  it("preserves branch data for Git repository responses", () => {
    const normalized = normalizeGitBranchListResponse({
      repositoryState: "git_repository",
      branches: [{ name: "main", lastCommit: 42 }],
    });

    expect(normalized).toEqual({
      branches: [{ name: "main", lastCommit: 42 }],
      repositoryState: "git_repository",
      diagnostic: null,
    });
  });
});
