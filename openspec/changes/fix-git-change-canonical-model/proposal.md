## Why

Git Diff panel 当前把 `git status` 文件列表与 `git diff` 预览结果作为两条独立事实链处理，UI 主要以 status 列表作为展示入口。这个模型会在 status 列表遗漏但 diff 结果存在时漏显新增文件，也会让删除文件只剩状态色而缺少 IDE 级删除语义。

本变更旨在为 Git panel 建立兼容现有行为的 canonical change model，使新增、删除、修改、binary/image、staged/unstaged 双态都通过统一语义层进入文件列表与 diff viewer，避免 issue #642 中“删除态不清晰、新增文件不显示”的问题。

## 目标与边界

- 建立 Git panel 专用 canonical change list，让 UI 消费统一后的 `path/status/stage/diff/stats/media` 语义，而不是分别依赖 status list 与 diff list。
- 保留现有 Git command、Tauri IPC、daemon forwarding 的外部行为，不要求本变更一次性重写 backend contract。
- 保留 flat/tree view、file focus、full-context diff、editable review entry、commit inclusion、stage/unstage/discard 的既有行为。
- 对删除文件提供更明确的 IDE 风格视觉表达，包括文件名划线、弱化与删除态色彩，但不改变可点击、可选择、可操作语义。
- 对 status list 漏掉但 diff list 可证明存在的文件做补漏展示，尤其覆盖 untracked/new file 与 deleted file 场景。
- 对 diff-only fallback entry 采用 preview-only 安全边界：除非 status evidence 明确确认 staged/unstaged section，否则不得暴露 stage、unstage、discard 等 mutation action。
- 保证 Windows、macOS、Linux 三端一致：路径规范化不得依赖平台分隔符，换行统计不得受 CRLF/LF 差异影响，测试与实现不得引入平台专属 shell 假设。
- 保证 Web 接口一致性：Web Service / remote daemon / local desktop 三种入口消费同一前端 canonical projection，不新增只在桌面端有效的并行展示语义。
- 遵守 `.github/workflows/large-file-governance.yml` 的 large-file governance 约束：新增逻辑应优先拆到小型 pure utility/test 文件，不继续膨胀既有大组件；实现后必须能通过 large-file parser tests、near-threshold watch 与 hard-debt gate。

## 非目标

- 不重写 Git backend 的完整 status/diff 计算管线。
- 不改变 `git status`、`get_git_diffs`、`get_git_file_full_diff` 的现有返回兼容性。
- 不改变 commit selection 的用户模型，不引入新的 partial staging 功能。
- 不改变历史 commit diff、PR diff、branch compare diff 的只读语义。
- 不处理 rename detection 的深度重构；rename 仅按现有 status/diff 证据保守展示。

## What Changes

- Add a frontend canonical Git change projection for the Git Diff panel.
- Merge `stagedFiles`, `unstagedFiles`, aggregate `files`, and diff preview entries into one stable change list before rendering.
- Preserve status-derived entries as the primary source of existing correct behavior.
- Use diff-derived entries as a compatibility fallback when a changed path is present in diff data but missing from status data.
- Infer fallback status from diff metadata/header when backend status is unavailable.
- Allow `GitFileDiff.status` as an optional forward-compatible field, while keeping fallback behavior for older local/daemon responses.
- Render deleted file rows with explicit deleted-state styling in both flat and tree list modes.
- Add regression coverage for added-file visibility, deleted-file visual semantics, staged/unstaged dual-state preservation, and binary/image diff compatibility.
- No **BREAKING** changes are intended.
- The implementation MUST remain compatible with the large-file governance CI matrix on `ubuntu-latest`, `macos-latest`, and `windows-latest`.

## 技术方案选项与取舍

### Option A: Frontend-only fallback merge

Only patch `useGitDiffs` to append diff entries missing from the status list.

- Pros: Smallest implementation surface and lowest immediate risk.
- Cons: Keeps duplicated Git change semantics scattered across hook/viewer/list components.
- Decision: Not enough for long-term correctness because the next Git panel feature can reintroduce fact-source drift.

### Option B: Backend-first `GitFileDiff.status`

Add status to Rust `GitFileDiff` and rely on backend status in the viewer.

- Pros: Cleaner data at the IPC boundary.
- Cons: Requires desktop command and daemon command parity, and still does not define how status entries and diff entries are reconciled in UI.
- Decision: Useful as a forward-compatible enhancement, but not sufficient by itself.

### Option C: Canonical frontend model with optional backend status

Introduce a frontend projection layer that canonicalizes status and diff facts, while accepting optional backend status when available.

- Pros: Fixes the root UI model, preserves existing command compatibility, and gives backend status a safe migration path.
- Cons: Larger frontend change and requires focused regression tests.
- Decision: Recommended. This balances a stronger architecture with compatibility preservation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `git-panel-diff-view`: Git Diff panel SHALL render changed files from a canonical status+diff projection so added/deleted files are not lost when one source omits a path, and deleted files SHALL expose explicit deleted-state visual semantics without breaking existing Git actions.

## Impact

- Frontend:
  - `src/features/git/hooks/useGitDiffs.ts`
  - `src/features/git/components/GitDiffPanelFileSections.tsx`
  - `src/features/git/components/GitDiffViewer.tsx`
  - new or existing `src/features/git/utils/*` projection helpers
  - `src/styles/diff.css`
  - relevant Vitest coverage under `src/features/git/**`
- Types:
  - `src/types.ts` may accept optional `GitFileDiff.status`.
- Backend compatibility:
  - Existing Rust commands may keep returning the current shape.
  - If Rust adds optional `status`, frontend MUST treat it as an optimization, not a required field.
  - Remote daemon mode MUST remain compatible with older daemon responses that omit `status`.
- User-visible behavior:
  - Added files present in diff evidence SHOULD appear in the Git panel instead of being silently dropped.
  - Deleted files SHOULD be visually recognizable as deleted while preserving selection, preview, stage/unstage, discard, and commit inclusion behavior.
  - Diff-only fallback entries MUST be visible for review but MUST NOT expose mutation actions until section state is confirmed by status evidence.
- CI / governance:
  - Implementation MUST keep changed files compatible with `.github/workflows/large-file-governance.yml`.
  - New projection code SHOULD live in focused utility modules with dedicated tests instead of increasing mega-component size.
  - Cross-platform behavior MUST be validated with path, line-ending, and status/diff merge fixtures that do not depend on OS-specific path separators.

## 验收标准

- When `stagedFiles` or `unstagedFiles` includes an added file, the Git panel continues to display it exactly as before.
- When a diff entry proves a new file exists but the status-derived list omits that path, the Git panel displays the file as added instead of dropping it.
- When a deleted file is displayed in flat or tree mode, the file row exposes deleted-state styling such as line-through or equivalent visual treatment.
- When the same path has staged and unstaged entries, both section-scoped states remain available and operations keep matching current flat/tree semantics.
- When image or binary diff entries are present, canonical projection does not drop their metadata or force them through text-diff parsing.
- Existing local backend behavior, remote daemon forwarding behavior, and error semantics remain backward compatible when `GitFileDiff.status` is absent.
- Web Service and remote daemon reads remain behaviorally consistent with local desktop reads: the same canonical projection rules apply after data is received.
- Canonical projection handles `src\\foo.ts`, `src/foo.ts`, CRLF diffs, LF diffs, and file paths containing spaces without changing file identity.
- Web-facing Git payloads with missing `path` are discarded with diagnostics; missing `status` is tolerated; missing `diff` cannot create a diff-only fallback entry.
- Large-file governance constraints are reflected in implementation tasks and validation gates so the change does not increase large-file debt.
- Focused tests cover canonical projection, added-file fallback visibility, deleted-file styling marker, and unchanged stage/unstage/discard action wiring.

## Implementation Closure Notes

- Canonical projection was implemented as a focused frontend utility instead of expanding existing Git panel components.
- Diff-only fallback rows are rendered as preview-only entries and are excluded from stage, unstage, discard, and commit-inclusion mutation controls.
- Deleted rows expose a stable deleted-state styling hook and render file names with line-through treatment.
- Local desktop, remote daemon, and Web Service compatibility is preserved by keeping `GitFileDiff.status` optional and applying the same frontend projection when payloads are received.
- Windows/macOS/Linux compatibility was reviewed through repository-relative path normalization, CRLF/LF diff handling, and workflow-equivalent validation commands.
- Large-file governance was respected by keeping the new model in small utility/test files and avoiding broader Git panel decomposition in this change.

## Validation Evidence

- `npm run typecheck`: pass.
- `npx vitest run src/features/git/utils/gitChangeModel.test.ts src/features/git/components/GitDiffPanel.test.tsx`: pass, 54 tests.
- `npx vitest run src/features/messages/components/Messages.runtime-reconnect.test.tsx src/features/messages/components/runtimeReconnect.test.ts`: pass, 28 tests.
- `npx vitest run src/features/client-documentation/components/ClientDocumentationWindow.test.tsx`: pass, 4 tests.
- `node --test scripts/check-large-files.test.mjs`: pass, 9 tests.
- `npm run check:large-files:near-threshold`: pass with existing watchlist warnings only.
- `npm run check:large-files:gate`: pass, found=0.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`: pass, 16 tests.
- `npm run check:heavy-test-noise`: pass, 563 Vitest files; act/stdout/stderr noise counts are 0.

## Manual Review Note

- Local desktop path: reviewed through Git panel wiring and focused component tests.
- Remote daemon path: reviewed for payload compatibility; no required backend field was introduced.
- Web Service path: reviewed as a projection contract; missing `status` remains tolerated and missing `diff` does not create fallback rows.
- Manual interactive UI smoke was not executed in this closure; the remaining check is visual confirmation of deleted row styling and preview-only fallback rows in a running app.
