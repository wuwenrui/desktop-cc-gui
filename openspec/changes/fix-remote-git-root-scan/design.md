## Context

当前 Git area 的 frontend 统一通过 `src/services/tauri.ts` 调用 Tauri commands。local backend mode 下，`src-tauri/src/git/commands*.rs` 直接读取 desktop `AppState` 和本地 repository path；remote daemon mode 下，已有 `remote_backend::call_remote` TCP JSON-RPC client，但 Git command 层没有系统性分流。

daemon 侧 `src-tauri/src/bin/cc_gui_daemon.rs` 已注册一组 Git / GitHub RPC，`src-tauri/src/bin/cc_gui_daemon/git.rs` 已提供对应实现。Issue #633 说明 desktop app 在 remote daemon mode 下仍执行本地 `list_git_roots`，从 Windows 本地 state 查 Linux workspace，触发 `workspace not found`。同类风险适用于整个 Git area。

## Goals / Non-Goals

**Goals:**

- Git area 在 remote daemon mode 下达到 backend-location parity：所有支持的 Git / GitHub command 都在 daemon 侧执行。
- 保持 React service API 稳定，frontend 不直接处理 daemon transport。
- 保持 local backend mode 的现有实现路径稳定。
- 建立 method matrix 和 regression guard，防止新增 Git command 忘记 remote wiring。

**Non-Goals:**

- 不重写 Git UI。
- 不重构 daemon Git algorithms。
- 不改变 workspace path model。
- 不引入新 dependency。
- 不一次性发明宏级 forwarding framework，除非实现时重复样板已经影响可读性。

## Decisions

### Decision 1: Tauri command 层负责 remote 分流

采用：每个 desktop Git Tauri command 入口先检查 `remote_backend::is_remote_mode(&*state).await`，remote 时调用 daemon RPC，local 时保留原实现。

备选：

- React 层直连 daemon：拒绝。会复制 auth、transport、错误处理，并破坏 Tauri service ownership。
- daemon-only service facade：长期可考虑，但本次范围过大。

理由：当前已有 engine commands 按这种模式接 remote；Git command 层补同样分流是最小且一致的修复。

### Decision 2: 先用显式 forwarding，允许小 helper，不做大框架

采用：优先在 command 函数中显式构造 `json!({ ... })` 并调用 typed remote helper。若多个函数重复同一 serde conversion，可抽取小型 helper，例如 `call_git_remote_value` / `call_git_remote_unit`。

备选：

- macro 生成所有 forwarding：拒绝作为首轮方案。Git commands 参数形状复杂，macro 会让错误信息和审阅成本变差。

理由：本变更是行为接线修复，清晰比抽象更重要。

### Decision 3: 方法矩阵作为实现和测试事实源

实现必须维护一份 Git remote wiring matrix，至少包含：

- method name
- desktop command location
- daemon RPC dispatch status
- remote forwarding status
- category: read / write / branch / history / worktree / GitHub
- representative test coverage

P0 methods:

- Read/diff: `get_git_status`, `list_git_roots`, `get_git_diffs`, `get_git_file_full_diff`, `get_git_remote`
- History/details: `get_git_log`, `get_git_commit_history`, `resolve_git_commit_ref`, `get_git_commit_details`, `get_git_commit_diff`, `get_git_push_preview`
- Write operations: `stage_git_file`, `stage_git_all`, `unstage_git_file`, `revert_git_file`, `revert_git_all`, `commit_git`, `push_git`, `pull_git`, `sync_git`, `git_pull`, `git_push`, `git_sync`, `git_fetch`, `update_git_branch`, `cherry_pick_commit`, `revert_commit`, `reset_git_commit`
- Branch/worktree: `list_git_branches`, `checkout_git_branch`, `create_git_branch`, `create_git_branch_from_branch`, `create_git_branch_from_commit`, `delete_git_branch`, `rename_git_branch`, `merge_git_branch`, `rebase_git_branch`, `get_git_branch_compare_commits`, `get_git_branch_diff_between_branches`, `get_git_branch_file_diff_between_branches`, `get_git_worktree_diff_against_branch`, `get_git_worktree_file_diff_against_branch`
- GitHub/PR: `get_github_issues`, `get_github_pull_requests`, `get_github_pull_request_diff`, `get_github_pull_request_comments`, `get_git_pr_workflow_defaults`, `create_git_pr_workflow`

### Decision 4: Error semantics stay transparent

Remote daemon errors propagate through existing command `Result<_, String>` boundaries. UI hooks already handle string errors for scan/loading/operation states; implementation should not translate daemon `workspace not found` into a desktop-local fallback.

备选：

- remote 失败后 fallback 到 local：拒绝。跨 OS path space 下 fallback 会复现根因，并可能误操作本地仓库。

### Decision 5: Tests use representative coverage plus matrix guard

Full integration testing every Git command would be expensive. Use:

- Unit tests for request-shape helpers if extracted.
- Representative Rust tests for read-only, write, branch, worktree, GitHub forwarding.
- Static/matrix test that asserts every daemon-supported Git method has a corresponding desktop remote forwarding entry.
- Existing focused frontend tests remain enough unless React request lifecycle changes.

## Risks / Trade-offs

- [Risk] Large number of command functions makes manual forwarding error-prone. → Mitigation: method matrix plus static guard.
- [Risk] Remote and local parameter names diverge silently. → Mitigation: build forwarding params from existing daemon dispatch names and add request-shape tests for complex methods.
- [Risk] Write operations accidentally fallback to local after remote error. → Mitigation: forbid local fallback in remote mode and cover representative write failure path.
- [Risk] Scope expansion touches high-risk Git UI flows. → Mitigation: keep frontend API unchanged and focus changes in backend command layer.

## Migration Plan

1. Add remote forwarding helpers or direct calls in Git command modules.
2. Wire P0 method matrix category by category.
3. Add tests/guard after first category so gaps are visible early.
4. Run focused Rust tests for Git command forwarding.
5. Run `npm run typecheck` if frontend/types are touched.
6. Run `openspec validate fix-remote-git-root-scan --strict --no-interactive`.

Rollback strategy: revert the Git command remote forwarding patch. Local mode behavior is preserved by construction; rollback risk is limited to remote mode returning to previous broken behavior.

## Implementation Notes

- The matrix is kept in Rust test-only code so it can act as a regression guard near the forwarding helpers.
- Forwarding remains explicit at command entry points. This keeps parameter mapping reviewable and avoids a macro layer over mixed read/write/GitHub return shapes.
- The daemon binary includes a desktop-remote-backend compatibility shim because shared modules now reference `remote_backend` symbols, while daemon mode itself must never recursively call a remote daemon.
- The frontend remains transport-agnostic; no React hook or service contract change is part of this fix.

## Open Questions

- Whether to store the method matrix as a Rust test fixture, markdown doc, or inline const table depends on the implementation shape.
- If a desktop command exists without daemon RPC after deeper inspection, implementation must either add daemon RPC or explicitly document why that command is local-only. Current initial scan suggests the Git area P0 methods are already present daemon-side.
