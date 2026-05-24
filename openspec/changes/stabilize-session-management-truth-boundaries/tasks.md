## 1. Specification And Baseline

- [x] 1.1 [P1] Validate OpenSpec artifacts before implementation; input: proposal/design/spec deltas; output: strict validation log; verify with `openspec validate stabilize-session-management-truth-boundaries --strict --no-interactive`.
- [x] 1.2 [P1] Capture current code baseline for the seven defects; input: affected Rust/TS files listed in proposal; output: implementation notes with exact symbols and current behavior; verify with `rg`/focused file reads and no code changes.
- [x] 1.3 [P1] Create or activate the linked Trellis task for this OpenSpec change; input: change id; output: `.trellis/tasks/*` task referencing `stabilize-session-management-truth-boundaries`; verify with `python3 ./.trellis/scripts/get_context.py`.

## 2. Backend Source Status And Archived Evidence

- [x] 2.1 [P1] Fix source completeness generation so capped/bounded non-empty scans do not return authoritative `Complete`; input: `scanCapReached`, scan mode, row count; output: conservative `WorkspaceSessionCatalogSourceStatus`; verify with Rust unit covering bounded cap + non-empty rows.
- [x] 2.2 [P1] Add archived evidence status to catalog/sidebar-support response path or equivalent helper; input: archive metadata lookup result; output: bounded archive evidence with complete/degraded/uncertain status; verify with Rust unit for archive lookup failure.
- [x] 2.3 [P1] Prevent partial/degraded archived evidence from resurrecting archived continuity rows; input: previous complete archive evidence and current degraded lookup; output: archived row remains filtered or explicitly uncertain; verify with Vitest in thread-list sidebar hook.
- [x] 2.4 [P1] Add service mapping for new source/archive evidence fields; input: Tauri payload; output: strict TypeScript mapping with null-safe defaults; verify with `src/services/tauri.test.ts`.

## 3. Related Sessions Engine-Neutral Projection

- [x] 3.1 [P1] Replace Codex-only related session backend contract with engine-neutral related projection while preserving strict scope boundaries; input: existing Codex related helper and catalog entries; output: related entries for supported inferred engines; verify with Rust tests for Claude + Codex related entries.
- [x] 3.2 [P1] Remove frontend Codex-only related engine filter; input: `mode === "project" && source === "related"` query; output: supported non-Codex engine filters request/display related results; verify with Vitest for Claude related filter.
- [x] 3.3 [P1] Ensure related mutations route by real owner workspace and do not pollute strict membership; input: related entry mutation; output: owner-aware mutation result and unchanged strict list; verify with Rust or Vitest mutation regression.

## 4. Stable Catalog Pagination

- [x] 4.1 [P2] Introduce stable opaque cursor format using ordering anchor; input: sorted catalog entry fields; output: parse/build cursor helpers that accept legacy offset and emit stable cursor; verify with Rust unit for cursor round-trip.
- [x] 4.2 [P2] Update catalog page slicing to use anchor comparison instead of mutable offset skip; input: filtered sorted entries and cursor; output: next page without duplicate/skip after insertion; verify with Rust test simulating new entry before page two.
- [x] 4.3 [P2] Preserve filter context across cursor chain; input: engine/status/keyword/folder filters; output: cursor or request validation that prevents mismatched continuation; verify with Rust unit for mismatched filter behavior.

## 5. Frontend Last-Good And Page Cap Semantics

- [x] 5.1 [P2] Refactor last-good health from whole-list to engine/source snapshots; input: current `ThreadSummary[]` and source statuses; output: engine-specific healthy snapshots; verify with Vitest where Claude degraded does not block OpenCode/Codex snapshot.
- [x] 5.2 [P2] Make continuity seed prefer same-engine snapshot and still honor authoritative archived/hidden/deleted/out-of-scope removal; input: engine-specific snapshot + removal evidence; output: seeded rows only when retainable; verify with Vitest for removal override.
- [x] 5.3 [P2] Surface backend effective limit/cap/next cursor in Session Management; input: requested `999`, backend cap `200`, next cursor; output: visible partial/capped or load-more state; verify with Vitest for settings catalog hook/section.

## 6. Batch Mutation Partial Results

- [x] 6.1 [P2] Convert folder assignment owner-group failures into per-entry failure results when the request itself is valid; input: grouped owner mutation; output: mixed success/failure `WorkspaceSessionBatchMutationResponse`; verify with Rust unit for one owner success and one owner failure.
- [x] 6.2 [P2] Align archive/unarchive/delete batch mutation behavior with the same per-entry partial-result semantics where applicable; input: existing batch mutation result types; output: consistent success/failure entries; verify with focused Rust tests.
- [x] 6.3 [P2] Update frontend selection/notice behavior for mixed batch results; input: result list; output: success entries removed/updated, failures visible and selected; verify with Vitest for Session Management hook or section.

## 7. Validation And Closeout

- [x] 7.1 [P1] Run focused backend tests; input: updated session management Rust code; output: passing exact tests; verify with `cargo test --manifest-path src-tauri/Cargo.toml session_management`.
- [x] 7.2 [P1] Run focused frontend tests; input: updated thread/settings/service code; output: passing Vitest suites; verify with `npx vitest run src/features/threads/hooks src/features/settings/components/settings-view src/services/tauri.test.ts`.
- [x] 7.3 [P1] Run typecheck and OpenSpec validation; input: full changed tree; output: green gates; verify with `npm run typecheck`, `openspec validate stabilize-session-management-truth-boundaries --strict --no-interactive`, and `openspec validate --all --strict --no-interactive`.
- [x] 7.4 [P1] Update implementation evidence in this change before archive; input: test logs and behavior notes; output: tasks/proposal/design evidence refresh; verify with `git diff --check`.

## Evidence - 2026-05-23

- OpenSpec baseline: `openspec status --change stabilize-session-management-truth-boundaries`, `openspec validate stabilize-session-management-truth-boundaries --strict --no-interactive`, `openspec validate --all --strict --no-interactive`.
- Trellis task: `.trellis/tasks/05-23-stabilize-session-management-truth-boundaries/task.json`; verified with `python3 ./.trellis/scripts/get_context.py`.
- Backend: `cargo test --manifest-path src-tauri/Cargo.toml session_management` passed with 63 `session_management` tests in both lib and daemon targets.
- Frontend: `npx vitest run src/features/threads/hooks src/features/settings/components/settings-view src/services/tauri.test.ts` passed with 68 files / 930 tests.
- Typecheck: `npm run typecheck` passed.
- Stable cursor: Rust tests cover legacy offset compatibility, stable cursor round-trip, new-session insertion before page two, and filter-context mismatch restart.
- Sidebar continuity: Vitest covers healthy Codex snapshot persistence when Claude catalog evidence is degraded.
- Page cap: Settings hook/section Vitest covers `requestedLimit=999`, `effectiveLimit=200`, `limitCapped=true`, and visible cap notice.
- Batch mutation partial result: Rust test covers one owner workspace success and one owner failure for folder assignment; backend archive/unarchive/delete metadata write paths now convert owner-group failures into per-entry failures.
- Large-file governance: `node --test scripts/check-large-files.test.mjs`, `npm run check:large-files:near-threshold`, and `npm run check:large-files:gate` passed; hard gate found 0 blocking files after `session_management.rs` was split to 2950 lines and batch assignment moved to `session_management_batch_assign.rs`.
- Heavy-test-noise sentry: `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs` and `npm run check:heavy-test-noise` passed; full sentry covered 532 test files with 0 act/stdout/stderr payload violations.
- Runtime contracts: `npm run check:runtime-contracts` passed.
- Hygiene: `cargo fmt --manifest-path src-tauri/Cargo.toml` applied; `git diff --check` passed.
