## 1. Specification And Evidence Calibration

- [x] 1.1 [P0][depends:none][input: `proposal.md`, `design.md`, delta specs][output: bilingual OpenSpec artifacts with no stale English-only closeout wording][validation: `openspec validate calibrate-performance-iteration-debt --strict --no-interactive`] Ensure proposal/design/specs remain 中英文结合 and strict-valid.
- [x] 1.2 [P0][depends:1.1][input: `frontend-prop-chain-stability-2026-06/tasks.md`, runtime evidence docs][output: closeout wording that does not simultaneously claim no visible jank and residual jank][validation: `rg -n "无可见卡顿|no visible jank|仍存在|residual jank" openspec/changes/frontend-prop-chain-stability-2026-06 openspec/docs`] Calibrate contradictory performance QA / archive-readiness language.
- [x] 1.3 [P1][depends:1.1][input: active performance change docs][output: explicit follow-up wording for large-file modularization debt and compatibility adapters][validation: focused `rg` confirms AppShell/useAppServerEvents/useLayoutNodes large-file debt is not described as fully split] Mark structural modularization debt as follow-up, not hidden completion.

## 2. Workspace Listing ScanCache Implementation

- [x] 2.1 [P0][depends:1.1][input: `src-tauri/src/backend_budget.rs`, `src-tauri/src/workspaces/files.rs`][output: cache key/signature helpers for initial and directory-child listing][validation: Rust unit tests compile] Define content-safe workspace listing cache keys and source signatures.
- [x] 2.2 [P0][depends:2.1][input: existing initial listing code][output: initial `list_workspace_files_inner` path reports `miss` / `hit` / `invalidated` when cache is safe][validation: Rust test covers miss then hit] Wire initial workspace listing to `ScanCache`.
- [x] 2.3 [P0][depends:2.1][input: existing directory-child listing code][output: directory-child listing reports cache state while preserving one-level bounded behavior][validation: Rust test covers path-scoped cache hit and partial metadata preservation] Wire directory-child listing to `ScanCache`.
- [x] 2.4 [P1][depends:2.2,2.3][input: response metadata][output: payload budget cacheState/sourceVersion semantics remain content-safe and backward-compatible][validation: existing workspace file listing tests plus new cache invalidation test] Add invalidation coverage for source signature changes.

## 3. Frontend Mapping Check

- [x] 3.1 [P1][depends:2.2,2.3][input: `src/services/tauri.ts`, `useWorkspaceFiles.ts`, `FileTreePanel.tsx`][output: no unnecessary DTO churn; mapping accepts cacheState values from backend][validation: focused frontend tests only if mapping changes] Confirm frontend metadata mapping already supports cache states or patch narrowly.

## 4. Validation And Closeout

- [x] 4.1 [P0][depends:2.4,3.1][input: Rust workspace listing tests][output: focused backend validation pass][validation: `cargo test --manifest-path src-tauri/Cargo.toml workspaces::files`] Run focused Rust tests.
- [x] 4.2 [P0][depends:1.2,2.4,3.1][input: OpenSpec artifacts][output: strict OpenSpec validation pass][validation: `openspec validate calibrate-performance-iteration-debt --strict --no-interactive`] Validate OpenSpec change.
- [x] 4.3 [P1][depends:4.1,4.2][input: touched frontend/backend files][output: type/lint confidence or documented skipped gate][validation: `npm run typecheck` and targeted tests when frontend mapping changes] Run final quality gates within touched scope.

## 5. Review Follow-up Repair / Review 后补修

- [x] 5.1 [P0][depends:2.2][input: `src-tauri/src/workspaces/files.rs`][output: initial listing cache hit validation no longer performs a recursive pre-walk][validation: nested-directory invalidation Rust test] Replace full-tree source signature with cached-response directory/gitignore metadata validation.
- [x] 5.2 [P0][depends:2.3][input: `src-tauri/src/bin/cc_gui_daemon/workspace_io.rs`][output: daemon workspace listing exposes `listingBudget`, `sourceVersion`, `payloadBudget.cacheState` and uses `ScanCache` for workspace listing][validation: daemon Rust tests cover miss/hit/invalidated] Close legacy daemon listing branch drift.
- [x] 5.3 [P1][depends:2.1][input: `src-tauri/src/backend_budget.rs`][output: `ScanCache` computes outside the cache mutex][validation: focused Rust tests compile/pass] Remove lock-in-heavy-IO risk for miss/invalidated entries.
- [x] 5.4 [P1][depends:1.1][input: workspace-filetree delta spec and design][output: no unsupported `disabled` enum claim; stale guard wording matches root request guard vs subtree `sourceVersion` guard][validation: strict OpenSpec validation] Calibrate spec wording to implemented DTO/frontend behavior.

## 6. Structural Debt Closure / 结构债闭环

- [x] 6.1 [P0][depends:5.2][input: desktop and daemon workspace listing implementations][output: `src-tauri/src/shared/workspace_listing.rs` owns file-tree DTOs, budget helpers, cache signatures, initial listing, and directory-child listing][validation: desktop and daemon focused Rust tests pass] Extract shared workspace listing core.
- [x] 6.2 [P0][depends:6.1][input: `src-tauri/src/workspaces/files.rs`, `src-tauri/src/bin/cc_gui_daemon/workspace_io.rs`][output: adapters delegate to shared listing core and no longer duplicate scanner/cache code][validation: `rg` confirms only shared core defines workspace listing scanner internals] Replace duplicated desktop/daemon branches with thin adapter exports.
- [x] 6.3 [P1][depends:6.2][input: external spec/absolute listing adapters][output: adapter-specific listing remains local but consumes shared DTO/budget helpers where response shape is shared][validation: existing external listing tests pass] Keep adapter-specific IO local without reintroducing shared DTO drift.
- [x] 6.4 [P0][depends:6.1,6.2,6.3][input: full change][output: verification pass][validation: `cargo test --manifest-path src-tauri/Cargo.toml workspaces::files`, `cargo test --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon workspace_io`, `npm run typecheck`, `openspec validate calibrate-performance-iteration-debt --strict --no-interactive`, `git diff --check`] Run final gates after extraction.
