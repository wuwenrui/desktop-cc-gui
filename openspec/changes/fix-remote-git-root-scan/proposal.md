## Why

Remote daemon mode 下，Git 区域存在系统性“半接线”风险：daemon 已注册大量 Git / GitHub RPC，但 desktop Tauri Git commands 仍可能直接访问本地 workspace state 和本地 filesystem。Issue #633 暴露的是「扫描工作区」按钮先断线；如果只修 `list_git_roots`，Git Diff、Git History、branch/worktree、write operations、GitHub Issues/PR 等入口仍可能在 Windows GUI + Linux daemon 组合下继续访问错误机器。

本变更把问题从单点 hotfix 升级为 Git area remote backend parity：所有 Git 区域功能在 remote daemon mode 下必须由 daemon 侧执行，desktop 只负责转发、反序列化和 UI 状态更新。

## 目标与边界

- 修复 Git Diff 面板「扫描工作区」在 remote daemon mode 下无法发现 Git repositories 的问题。
- 系统性梳理 Git 区域所有 Tauri commands 与 daemon RPC 的接线矩阵，覆盖：
  - Git status / diffs / full file diff / remote / root scan
  - Git log / commit history / commit details / commit diff / ref resolve
  - stage / unstage / revert / commit / pull / push / sync / fetch / reset / cherry-pick / revert commit
  - branch list / checkout / create / delete / rename / merge / rebase / update
  - branch compare / branch diff / worktree diff
  - GitHub Issues / Pull Requests / PR diffs / PR comments / PR workflow defaults / PR creation workflow
- 在 remote backend mode 下，desktop Git commands SHALL forward to daemon RPC when the corresponding daemon method exists.
- 保持 local backend mode 的现有行为、参数语义、返回结构和错误语义不变。
- 保持 frontend service API 形状稳定，React 层不直接感知 daemon transport。
- 对 daemon 已注册但 desktop 未转发的方法补齐接线；对 desktop 有但 daemon 缺失的方法必须在 design/tasks 中显式列出，并在实现中补 RPC 或标记为非 remote-supported。

## 非目标

- 不重写 Git 面板 UI、Git history UI 或 GitHub panel UI。
- 不新增前端直连 daemon JSON-RPC 的通道；frontend 继续通过 Tauri service API 调用。
- 不改变 workspace path 存储模型，也不做 Windows/Linux path 自动映射。
- 不修改 Git 扫描、diff、history、GitHub API 查询的业务算法，除非为保持 local/remote parity 必须提取共享参数映射。
- 不引入新依赖。
- 不把 remote daemon 做成跨机器 Git credential 管理器；凭据仍遵循 daemon 所在环境的既有 Git/GitHub 配置。

## What Changes

- Add a Git remote forwarding contract for desktop Tauri commands:
  - local backend mode: execute existing local implementation.
  - remote backend mode: forward to daemon RPC using the same method name and equivalent JSON params.
- Build and enforce a command coverage matrix across desktop Git commands and daemon Git RPC dispatch.
- Wire remote forwarding for all supported Git / GitHub methods, starting from the daemon methods already present in `cc_gui_daemon`.
- Preserve frontend API shape, including `src/services/tauri.ts` exported functions.
- Add focused Rust coverage for representative read-only, write, branch, worktree, and GitHub forwarding paths.
- Add regression coverage or static guard that fails when a Git Tauri command has a matching daemon RPC but lacks remote-mode forwarding.
- Record behavior deltas under existing Git capabilities instead of creating a parallel remote-only Git capability.

## Implementation Backfill

Current workspace code now reflects this proposal through:

- `src-tauri/src/git/mod.rs`: Git remote forwarding helper surface and test-only method matrix.
- `src-tauri/src/git/commands.rs`: remote-mode forwarding for Git diff, status, history, write operations, GitHub panel, and PR workflow commands.
- `src-tauri/src/git/commands_branch.rs`: remote-mode forwarding for branch, compare, and worktree commands while preserving local branch behavior.
- `src-tauri/src/bin/cc_gui_daemon.rs`: daemon build compatibility shim for desktop-only remote backend symbols used by shared session/Git modules.

No frontend service API change is required; React continues to call the existing Tauri command names.

## 技术方案选项

| 选项 | 方案 | 取舍 |
|---|---|---|
| A | 只修 `list_git_roots` | 最快止血，但会留下同类断线；Issue #633 的根因是 Git area remote parity 缺失，不是单按钮坏了；拒绝 |
| B | 在每个 Git Tauri command 内按 remote mode 分流到 daemon RPC | 改动直观、风险可控、最贴近现有代码；缺点是重复样板较多；本次采用 |
| C | 做统一 Git command forwarding macro/wrapper，一次性抽象全部转发 | 长期更优，但会同时改动大量函数签名与错误处理路径；容易把行为修复变成框架重构；本次不作为首选 |
| D | React 层检测 remote mode 后直接调用 daemon JSON-RPC | 破坏 Tauri service ownership，会复制 auth/transport/error handling；拒绝 |

本变更采用 B，并通过矩阵/测试控制重复样板的风险。若实现过程中发现重复达到不可维护，再在 design 中限定一个小型 helper，但不做大规模框架重构。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `git-panel-diff-view`: Git Diff panel read paths and workspace repository scan SHALL execute against the active backend location; in remote daemon mode, Git status/diff/root-scan related calls SHALL be delegated to daemon RPC instead of local desktop filesystem state.
- `git-commit-history`: Git history, commit details, commit diff, ref resolve, branch compare, and worktree diff calls SHALL use daemon-side repository state in remote backend mode.
- `git-operations`: Git write operations and toolbar/branch actions SHALL execute on daemon-side repository state in remote backend mode, preserving confirmation-first UI and operation locking semantics.
- `git-branch-management`: Branch list and branch mutation operations SHALL execute on daemon-side repository state in remote backend mode.
- `git-pr-submission-workflow`: GitHub Issues/PR/PR workflow calls SHALL execute through daemon-side Git/GitHub context in remote backend mode.

## Impact

- Backend:
  - `src-tauri/src/git/commands.rs`
  - `src-tauri/src/git/commands_branch.rs`
  - `src-tauri/src/git/commands_pr_workflow.rs` if parameter mapping needs shared extraction
  - `src-tauri/src/engine/remote_bridge.rs` or a small typed helper if needed
  - `src-tauri/src/bin/cc_gui_daemon.rs` dispatch matrix, only if missing daemon methods are found
  - focused Rust tests / static matrix tests
- Frontend:
  - `src/services/tauri.ts` remains API-compatible
  - Git Diff / Git History / GitHub panel hooks should require no transport-level behavior change
- Daemon:
  - Existing Git RPC implementations are reused where present
  - Missing RPCs, if any, are implemented only when required for parity
- Specs:
  - Delta specs for affected existing Git capabilities
- Dependencies:
  - No new dependency expected

## 验收标准

- A method matrix MUST list every desktop Git/GitHub Tauri command, its daemon RPC status, and whether remote forwarding is implemented.
- In remote backend mode, Git area commands with daemon RPC support MUST call daemon RPC instead of local desktop workspace/filesystem state.
- In local backend mode, all affected commands MUST preserve existing local behavior and return shapes.
- Git Diff panel「扫描工作区」MUST populate repository candidates returned by the remote daemon when GUI and daemon run on different OS path spaces.
- Git status/diff/history/branch/worktree/GitHub panels MUST read daemon-side repository state in remote backend mode.
- Git write operations from toolbar and branch/context actions MUST execute on daemon-side repository state in remote backend mode and continue using existing confirmation/progress/error UI.
- Remote RPC errors, including daemon-side `workspace not found`, MUST surface through existing UI error states without leaving loading/operation state stuck.
- Focused Rust tests for representative read-only, write, branch, worktree, GitHub, local fallback, and matrix coverage MUST pass.
- Focused frontend tests for request lifecycle MUST continue to pass if touched.
- `openspec validate fix-remote-git-root-scan --strict --no-interactive` MUST pass.
