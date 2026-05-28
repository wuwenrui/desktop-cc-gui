## 1. Baseline And Ownership Inventory

- [x] 1.1 [P0][depends:none][I: current `src/features/project-map/**`, Project Map services, and `src-tauri/src/project_map.rs`][O: affected ownership, scheduler, projection, and failure-path inventory][V: `rg -n "ProjectMap|project-map|auto ingestion|storageKey|candidate|nodeLayouts" src src-tauri`] Map current Project Map run lifecycle and write/read boundaries.
- [x] 1.2 [P0][depends:1.1][I: existing Project Map tests][O: focused regression test targets and missing fixtures list][V: list exact Vitest/Rust files to update or create] Identify the minimal test surface before implementation.

## 2. Immutable Run Ownership And Storage Guard

- [x] 2.1 [P0][depends:1.1][I: Project Map run creation inputs][O: immutable run ownership context captured at run creation][V: unit test asserts progress/completion/failure use captured workspace/storage key after active workspace changes] Capture workspace id/path, storage key, storage view, run id, and action kind for each Project Map run.
- [x] 2.2 [P0][depends:2.1][I: Project Map worker callbacks][O: progress/completion/failure routing through captured ownership context][V: focused test where workspace A run completes after switching to workspace B without mutating B] Route async updates without reading mutable active workspace state.
- [x] 2.3 [P0][depends:2.1][I: frontend persistence helpers and backend snapshot write command][O: read/write storage-key mismatch rejection][V: Rust and frontend service tests cover matching, mismatched, and malformed manifest cases] Enforce manifest storage-key ownership at persistence boundaries.
- [x] 2.4 [P1][depends:2.3][I: mismatched persisted snapshot fixture][O: quarantined or error/empty UI state without trusted rendering][V: Project Map panel test confirms mismatched snapshot is not rendered as valid graph data] Surface ownership mismatch without deleting local data.

## 3. Workspace-Level Auto Ingestion Scheduler

- [x] 3.1 [P0][depends:1.1][I: existing Auto Ingestion settings and queue code][O: extracted scheduler evaluation helper/service][V: unit tests cover enabled, disabled, interval, threshold, and duplicate-run guard] Separate Auto Ingestion evaluation from Project Map panel mount lifecycle.
- [x] 3.2 [P0][depends:3.1][I: app/workspace lifecycle mount point][O: workspace-level scheduler owner for active workspace][V: component/hook test queues `kind="auto"` while Project Map panel is not rendered] Mount scheduler from the workspace lifecycle.
- [x] 3.3 [P0][depends:3.2][I: Project Memory processed marker flow][O: success-only processed marker behavior preserved][V: test confirms failed/cancelled auto run leaves reserved memories retryable] Preserve retry semantics after auto-ingestion failure or cancellation.
- [x] 3.4 [P1][depends:3.2][I: existing task drawer projection][O: queued/running/completed auto run visible when panel opens later][V: Project Map panel test renders background-created auto run in task drawer] Keep panel as visibility/configuration owner.

## 4. Node Projection Normalization And Graph Interaction

- [x] 4.1 [P0][depends:1.1][I: persisted/generated Project Map dataset][O: pure stable-node-id dedupe projection helper][V: unit tests merge duplicate node evidence, relationships, candidate/stale/confidence metadata without duplicate entries] Normalize duplicate nodes before graph layout.
- [x] 4.2 [P0][depends:4.1][I: graph layout input path][O: layout consumes normalized node projection][V: Project Map graph test shows duplicate stable node id renders once] Wire normalization into graph projection without schema migration.
- [x] 4.3 [P0][depends:1.1][I: node pointer handlers and canvas handlers][O: node-body drag works for isolated and connected nodes][V: component test covers node-origin pointer move/up persistence and no-edge node drag] Stabilize node drag event routing.
- [x] 4.4 [P0][depends:4.3][I: node action buttons and selection handlers][O: drill/evidence/action clicks do not start drag; ordinary selection preserves viewport][V: component tests cover action click no drag and node select no auto-fit] Protect graph interaction boundaries.

## 5. Failure Visibility And Candidate Safety

- [x] 5.1 [P0][depends:1.1][I: model output parse/repair path][O: failed run classification for unrecoverable structured-output errors][V: worker/helper test asserts malformed output fails closed and does not write partial dataset] Fail closed on invalid Project Map payloads.
- [x] 5.2 [P0][depends:5.1][I: task drawer run projection][O: visible failure category and latest diagnostic message][V: Project Map task drawer test renders parse, ownership, evidence, and persistence failure categories] Expose concise diagnostics without blocking existing map review.
- [x] 5.3 [P0][depends:3.3,5.1][I: auto-ingestion and calibration output merge paths][O: mode-aware candidate safety preserved][V: tests assert `createCandidate` requires confirmation, `autoApplyEvidenceBacked` can apply evidence-backed updates, and weak/unsupported claims remain candidates] Preserve candidate safety without disabling advanced evidence-backed mode.
- [x] 5.4 [P1][depends:5.1][I: Project Map generation option loader and existing Codex model catalog][O: Codex model fallback reuses canonical model catalog when runtime catalogs are empty][V: hook test asserts Codex models remain available after runtime catalog failures] Preserve generation entry availability during model catalog outage.

## 6. Verification And Release Evidence

- [x] 6.1 [P0][depends:2,3,4,5][I: implemented frontend changes][O: focused Project Map Vitest evidence][V: exact `npx vitest run ...` commands pass for ownership, scheduler, dedupe, graph interaction, failure, and candidate cases] Run focused frontend regression.
- [x] 6.2 [P0][depends:2.3][I: backend persistence guard changes][O: focused Rust evidence][V: exact `cargo test --manifest-path src-tauri/Cargo.toml ...` command passes for Project Map ownership/storage tests] Run focused backend regression.
- [x] 6.3 [P0][depends:6.1,6.2][I: full TypeScript surface and OpenSpec artifacts][O: final local gate evidence][V: `npm run typecheck` and `openspec validate stabilize-project-map-for-v0-5-4 --strict --no-interactive` pass] Run required quality gates.
- [x] 6.4 [P1][depends:6.3][I: desktop manual smoke checklist][O: manual/platform qualifier note][V: verification records covered and missing macOS/Windows/Linux manual checks explicitly] Record manual QA qualifiers for release notes.
- [x] 6.5 [P1][depends:6.4][I: focused test outputs and manual/platform qualifier note][O: `verification.md` release evidence][V: verification file lists exact commands, pass/fail state, and uncovered platform/manual gaps without adding version-specific requirements to main specs] Write release evidence outside long-term capability specs.
