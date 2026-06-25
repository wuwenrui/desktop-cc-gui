import { invoke } from "@tauri-apps/api/core";
import type {
  GitBranchCompareCommitSets,
  GitBranchListResponse,
  GitBranchUpdateResult,
  GitCommitDetails,
  GitCommitDiff,
  GitFileDiff,
  GitFileStatus,
  GitHistoryResponse,
  GitHubIssuesResponse,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
  GitHubPullRequestsResponse,
  GitLogResponse,
  GitPrWorkflowDefaults,
  GitPrWorkflowResult,
  GitPushPreviewResponse,
} from "../../types";
import { traceStartupCommand, type StartupWorkspaceScope } from "../../features/startup-orchestration/utils/startupTrace";

function workspaceScope(workspaceId: string): StartupWorkspaceScope {
  return { workspaceId };
}

function traceStartupInvoke<T>(
  commandLabel: string,
  scope: StartupWorkspaceScope,
  run: () => Promise<T>,
) {
  return traceStartupCommand(commandLabel, scope, run);
}

export async function getGitStatus(workspace_id: string): Promise<{
  isGitRepository?: boolean;
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
}> {
  return traceStartupInvoke("get_git_status", workspaceScope(workspace_id), () =>
    invoke("get_git_status", { workspaceId: workspace_id }),
  );
}

export async function listGitRoots(workspace_id: string, depth: number): Promise<string[]> {
  return invoke("list_git_roots", { workspaceId: workspace_id, depth });
}

export async function getGitDiffs(workspace_id: string): Promise<GitFileDiff[]> {
  return traceStartupInvoke("get_git_diffs", workspaceScope(workspace_id), () =>
    invoke("get_git_diffs", { workspaceId: workspace_id }),
  );
}

export async function getGitFileFullDiff(workspace_id: string, path: string): Promise<string> {
  return invoke("get_git_file_full_diff", { workspaceId: workspace_id, path });
}

export async function getGitLog(workspace_id: string, limit = 40): Promise<GitLogResponse> {
  return invoke("get_git_log", { workspaceId: workspace_id, limit });
}

export async function getGitCommitHistory(
  workspace_id: string,
  options?: {
    branch?: string | null;
    query?: string | null;
    author?: string | null;
    dateFrom?: number | null;
    dateTo?: number | null;
    snapshotId?: string | null;
    offset?: number;
    limit?: number;
  },
): Promise<GitHistoryResponse> {
  return invoke("get_git_commit_history", {
    workspaceId: workspace_id,
    branch: options?.branch ?? null,
    query: options?.query ?? null,
    author: options?.author ?? null,
    dateFrom: options?.dateFrom ?? null,
    dateTo: options?.dateTo ?? null,
    snapshotId: options?.snapshotId ?? null,
    offset: options?.offset ?? 0,
    limit: options?.limit ?? 100,
  });
}

export async function getGitPushPreview(
  workspace_id: string,
  options: {
    remote: string;
    branch: string;
    limit?: number;
  },
): Promise<GitPushPreviewResponse> {
  return invoke("get_git_push_preview", {
    workspaceId: workspace_id,
    remote: options.remote,
    branch: options.branch,
    limit: options.limit ?? 120,
  });
}

export type CreateGitPrWorkflowOptions = {
  upstreamRepo: string;
  baseBranch: string;
  headOwner: string;
  headBranch: string;
  title: string;
  body?: string | null;
  commentAfterCreate?: boolean;
  commentBody?: string | null;
};

export async function getGitPrWorkflowDefaults(workspaceId: string): Promise<GitPrWorkflowDefaults> {
  return invoke<GitPrWorkflowDefaults>("get_git_pr_workflow_defaults", {
    workspaceId,
  });
}

export async function createGitPrWorkflow(workspaceId: string, options: CreateGitPrWorkflowOptions): Promise<GitPrWorkflowResult> {
  return invoke<GitPrWorkflowResult>("create_git_pr_workflow", {
    workspaceId,
    upstreamRepo: options.upstreamRepo,
    baseBranch: options.baseBranch,
    headOwner: options.headOwner,
    headBranch: options.headBranch,
    title: options.title,
    body: options.body ?? null,
    commentAfterCreate: options.commentAfterCreate ?? null,
    commentBody: options.commentBody ?? null,
  });
}

export async function resolveGitCommitRef(workspace_id: string, target: string): Promise<string> {
  return invoke("resolve_git_commit_ref", {
    workspaceId: workspace_id,
    target,
  });
}

export async function getGitCommitDetails(workspace_id: string, commitHash: string, maxDiffLines = 10_000): Promise<GitCommitDetails> {
  return invoke("get_git_commit_details", {
    workspaceId: workspace_id,
    commitHash,
    maxDiffLines,
  });
}

export async function getGitCommitDiff(
  workspace_id: string,
  sha: string,
  options?: {
    path?: string | null;
    contextLines?: number;
  },
): Promise<GitCommitDiff[]> {
  return invoke("get_git_commit_diff", {
    workspaceId: workspace_id,
    sha,
    path: options?.path ?? null,
    contextLines: options?.contextLines ?? null,
  });
}

export async function getGitRemote(workspace_id: string): Promise<string | null> {
  return invoke("get_git_remote", { workspaceId: workspace_id });
}

export async function stageGitFile(workspaceId: string, path: string) {
  return invoke("stage_git_file", { workspaceId, path });
}

export async function stageGitAll(workspaceId: string): Promise<void> {
  return invoke("stage_git_all", { workspaceId });
}

export async function unstageGitFile(workspaceId: string, path: string) {
  return invoke("unstage_git_file", { workspaceId, path });
}

export async function revertGitFile(workspaceId: string, path: string) {
  return invoke("revert_git_file", { workspaceId, path });
}

export async function revertGitAll(workspaceId: string) {
  return invoke("revert_git_all", { workspaceId });
}

export async function commitGit(workspaceId: string, message: string): Promise<void> {
  return invoke("commit_git", { workspaceId, message });
}

export type GitPushOptions = {
  remote?: string | null;
  branch?: string | null;
  forceWithLease?: boolean;
  pushTags?: boolean;
  runHooks?: boolean;
  pushToGerrit?: boolean;
  topic?: string | null;
  reviewers?: string | null;
  cc?: string | null;
};

export type GitPullStrategyOption = "--rebase" | "--ff-only" | "--no-ff" | "--squash";

export type GitPullOptions = {
  remote?: string | null;
  branch?: string | null;
  strategy?: GitPullStrategyOption | null;
  noCommit?: boolean;
  noVerify?: boolean;
};

export async function pushGit(workspaceId: string, options?: GitPushOptions): Promise<void> {
  return invoke("push_git", {
    workspaceId,
    remote: options?.remote ?? null,
    branch: options?.branch ?? null,
    forceWithLease: options?.forceWithLease ?? null,
    pushTags: options?.pushTags ?? null,
    runHooks: options?.runHooks ?? null,
    pushToGerrit: options?.pushToGerrit ?? null,
    topic: options?.topic ?? null,
    reviewers: options?.reviewers ?? null,
    cc: options?.cc ?? null,
  });
}

export async function pullGit(workspaceId: string, options?: GitPullOptions): Promise<void> {
  return invoke("pull_git", {
    workspaceId,
    remote: options?.remote ?? null,
    branch: options?.branch ?? null,
    strategy: options?.strategy ?? null,
    noCommit: options?.noCommit ?? null,
    noVerify: options?.noVerify ?? null,
  });
}

export async function syncGit(workspaceId: string): Promise<void> {
  return invoke("sync_git", { workspaceId });
}

export async function fetchGit(workspaceId: string, remote?: string | null): Promise<void> {
  return invoke("git_fetch", { workspaceId, remote: remote ?? null });
}

export async function updateGitBranch(workspaceId: string, branchName: string): Promise<GitBranchUpdateResult> {
  return invoke<GitBranchUpdateResult>("update_git_branch", { workspaceId, branchName });
}

export async function cherryPickCommit(workspaceId: string, commitHash: string): Promise<void> {
  return invoke("cherry_pick_commit", { workspaceId, commitHash });
}

export async function revertCommit(workspaceId: string, commitHash: string): Promise<void> {
  return invoke("revert_commit", { workspaceId, commitHash });
}

export type GitResetMode = "soft" | "mixed" | "hard" | "keep";

export async function resetGitCommit(workspaceId: string, commitHash: string, mode: GitResetMode): Promise<void> {
  return invoke("reset_git_commit", { workspaceId, commitHash, mode });
}

export async function getGitHubIssues(workspace_id: string): Promise<GitHubIssuesResponse> {
  return invoke("get_github_issues", { workspaceId: workspace_id });
}

export async function getGitHubPullRequests(workspace_id: string): Promise<GitHubPullRequestsResponse> {
  return invoke("get_github_pull_requests", { workspaceId: workspace_id });
}

export async function getGitHubPullRequestDiff(workspace_id: string, prNumber: number): Promise<GitHubPullRequestDiff[]> {
  return invoke("get_github_pull_request_diff", {
    workspaceId: workspace_id,
    prNumber,
  });
}

export async function getGitHubPullRequestComments(workspace_id: string, prNumber: number): Promise<GitHubPullRequestComment[]> {
  return invoke("get_github_pull_request_comments", {
    workspaceId: workspace_id,
    prNumber,
  });
}

export async function listGitBranches(workspaceId: string): Promise<GitBranchListResponse> {
  return invoke<GitBranchListResponse>("list_git_branches", { workspaceId });
}

export async function checkoutGitBranch(workspaceId: string, name: string) {
  return invoke("checkout_git_branch", { workspaceId, name });
}

export async function createGitBranch(workspaceId: string, name: string) {
  return invoke("create_git_branch", { workspaceId, name });
}

export async function createGitBranchFromBranch(workspaceId: string, name: string, sourceBranch: string) {
  return invoke("create_git_branch_from_branch", {
    workspaceId,
    name,
    sourceBranch,
  });
}

export async function createGitBranchFromCommit(workspaceId: string, name: string, commitHash: string) {
  return invoke("create_git_branch_from_commit", {
    workspaceId,
    name,
    commitHash,
  });
}

export async function deleteGitBranch(
  workspaceId: string,
  name: string,
  options?: {
    force?: boolean;
    removeOccupiedWorktree?: boolean;
  },
) {
  return invoke("delete_git_branch", {
    workspaceId,
    name,
    force: options?.force ?? false,
    removeOccupiedWorktree: options?.removeOccupiedWorktree ?? false,
  });
}

export async function renameGitBranch(workspaceId: string, oldName: string, newName: string) {
  return invoke("rename_git_branch", { workspaceId, oldName, newName });
}

export async function mergeGitBranch(workspaceId: string, name: string) {
  return invoke("merge_git_branch", { workspaceId, name });
}

export async function rebaseGitBranch(workspaceId: string, ontoBranch: string) {
  return invoke("rebase_git_branch", { workspaceId, ontoBranch });
}

export async function getGitBranchCompareCommits(workspaceId: string, targetBranch: string, currentBranch: string, limit = 200): Promise<GitBranchCompareCommitSets> {
  return invoke<GitBranchCompareCommitSets>("get_git_branch_compare_commits", {
    workspaceId,
    targetBranch,
    currentBranch,
    limit,
  });
}

export async function getGitBranchDiffBetweenBranches(workspaceId: string, fromBranch: string, toBranch: string): Promise<GitCommitDiff[]> {
  return invoke<GitCommitDiff[]>("get_git_branch_diff_between_branches", {
    workspaceId,
    fromBranch,
    toBranch,
  });
}

export async function getGitBranchDiffFileBetweenBranches(workspaceId: string, fromBranch: string, toBranch: string, path: string): Promise<GitCommitDiff> {
  return invoke<GitCommitDiff>("get_git_branch_file_diff_between_branches", {
    workspaceId,
    fromBranch,
    toBranch,
    path,
  });
}

export async function getGitWorktreeDiffAgainstBranch(workspaceId: string, branch: string): Promise<GitCommitDiff[]> {
  return invoke<GitCommitDiff[]>("get_git_worktree_diff_against_branch", {
    workspaceId,
    branch,
  });
}

export async function getGitWorktreeDiffFileAgainstBranch(workspaceId: string, branch: string, path: string): Promise<GitCommitDiff> {
  return invoke<GitCommitDiff>("get_git_worktree_file_diff_against_branch", {
    workspaceId,
    branch,
    path,
  });
}
