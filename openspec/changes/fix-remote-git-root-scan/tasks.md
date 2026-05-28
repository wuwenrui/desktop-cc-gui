## 1. Command Matrix and Guard

- [x] 1.1 [P0] Create a Git remote wiring matrix covering every P0 method from `design.md`; input: desktop Git command list and daemon dispatch list; output: method/category/desktop/daemon/forwarding/test entry; verification: matrix includes read, write, branch, worktree, and GitHub categories.
- [x] 1.2 [P0] Add a regression guard that fails when a daemon-supported Git/GitHub method has no desktop remote forwarding entry; depends on 1.1; verification: focused Rust/static test fails before wiring gaps are closed and passes after.

## 2. Remote Forwarding Infrastructure

- [x] 2.1 [P0] Add or reuse a typed remote forwarding helper for Git commands; input: `remote_backend::call_remote` and existing serde return types; output: helper for value-returning and unit-returning methods; verification: helper unit tests cover success and remote error propagation.
- [x] 2.2 [P0] Ensure remote mode never falls back to local Git execution after daemon RPC failure; depends on 2.1; verification: representative failing remote call returns daemon error and does not touch local workspace state.

## 3. Read and History Wiring

- [x] 3.1 [P0] Wire remote forwarding for Git Diff read methods: `get_git_status`, `list_git_roots`, `get_git_diffs`, `get_git_file_full_diff`, `get_git_remote`; depends on 2.1; verification: focused tests assert method names and params, including Issue #633 `list_git_roots`.
- [x] 3.2 [P0] Wire remote forwarding for history/detail methods: `get_git_log`, `get_git_commit_history`, `resolve_git_commit_ref`, `get_git_commit_details`, `get_git_commit_diff`, `get_git_push_preview`; depends on 2.1; verification: representative request-shape tests cover optional filters and pagination.

## 4. Write Operation Wiring

- [x] 4.1 [P0] Wire remote forwarding for file/index operations: `stage_git_file`, `stage_git_all`, `unstage_git_file`, `revert_git_file`, `revert_git_all`; depends on 2.1; verification: representative write test proves daemon-side RPC is called and unit response settles.
- [x] 4.2 [P0] Wire remote forwarding for toolbar operations: `commit_git`, `push_git`, `pull_git`, `sync_git`, `git_pull`, `git_push`, `git_sync`, `git_fetch`; depends on 2.1; verification: request-shape tests cover push/pull optional parameters.
- [x] 4.3 [P0] Wire remote forwarding for commit mutation operations: `update_git_branch`, `cherry_pick_commit`, `revert_commit`, `reset_git_commit`; depends on 2.1; verification: tests cover return value for update branch and unit responses for mutations.

## 5. Branch, Worktree, and GitHub Wiring

- [x] 5.1 [P0] Wire remote forwarding for branch management: `list_git_branches`, `checkout_git_branch`, `create_git_branch`, `create_git_branch_from_branch`, `create_git_branch_from_commit`, `delete_git_branch`, `rename_git_branch`, `merge_git_branch`, `rebase_git_branch`; depends on 2.1; verification: tests cover list return and at least one mutation with params.
- [x] 5.2 [P0] Wire remote forwarding for compare/worktree methods: `get_git_branch_compare_commits`, `get_git_branch_diff_between_branches`, `get_git_branch_file_diff_between_branches`, `get_git_worktree_diff_against_branch`, `get_git_worktree_file_diff_against_branch`; depends on 2.1; verification: tests cover branch/path params without local path resolution.
- [x] 5.3 [P0] Wire remote forwarding for GitHub/PR methods: `get_github_issues`, `get_github_pull_requests`, `get_github_pull_request_diff`, `get_github_pull_request_comments`, `get_git_pr_workflow_defaults`, `create_git_pr_workflow`; depends on 2.1; verification: tests cover PR number and PR workflow params.

## 6. Validation

- [x] 6.1 [P0] Run focused Rust tests for Git remote forwarding matrix and representative commands; depends on 3.1 through 5.3; verification: selected `cargo test --manifest-path src-tauri/Cargo.toml ...` commands pass.
- [x] 6.2 [P1] Run focused frontend tests only if React service/hook code changes; depends on implementation scope; verification: affected Vitest suites pass or are explicitly not required because frontend API stayed unchanged.
- [x] 6.3 [P0] Run `npm run typecheck` if TypeScript files are touched; depends on implementation scope; verification: command passes or is documented as skipped when no TS files changed.
- [x] 6.4 [P0] Run `openspec validate fix-remote-git-root-scan --strict --no-interactive`; depends on specs/design/tasks; verification: validation passes.
