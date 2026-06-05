## 1. Model And Store Foundation

- [x] 1.1 [P0][depends:none][I: proposal/design provider-based OrchestrationTask model][O: TypeScript domain types for OrchestrationTask, provider source refs, status, review state, and dispatch draft][V: focused type-level/unit tests compile] Define orchestration domain model without hard-coding OpenSpec or Trellis source kinds.
- [x] 1.2 [P0][depends:1.1][I: existing client storage pattern][O: workspace-scoped local-first orchestration task store][V: store tests cover create/update/list/archive and reload restore across two workspaces] Implement persistence for orchestration tasks without writing Project Map, provider artifacts, TaskRun, or session artifacts.
- [x] 1.3 [P0][depends:1.2][I: malformed local task records][O: safe normalization and degraded record handling][V: tests cover missing fields, unknown status, invalid provider refs] Add reader normalization so corrupt local records do not crash the center.
- [x] 1.4 [P0][depends:1.1][I: current TaskRun Kanban-only definition ref][O: backward-compatible TaskRun source extension for orchestration launches][V: tests cover legacy Kanban runs and new orchestration-linked runs] Extend TaskRun linkage without pretending non-Kanban tasks are Kanban tasks.
- [x] 1.5 [P1][depends:1.2][I: workspace identity/path conventions][O: normalized workspace-relative source ref helpers][V: tests cover macOS/Windows-style path samples without hard-coded separators] Keep source refs portable across platforms.

## 2. Core Source Providers

- [x] 2.1 [P0][depends:1.1][I: manual task form input][O: manual provider draft creation][V: tests cover no-evidence manual draft and required scope/acceptance fields] Support plain workspaces with no spec/workflow provider.
- [x] 2.2 [P0][depends:1.1][I: Project Map persisted dataset/node/evidence][O: project-map provider candidate reader][V: tests cover node id, label, evidence refs, confidence, stale marker] Read Project Map nodes as orchestration candidate inputs without modifying map data.
- [x] 2.3 [P0][depends:1.4][I: existing TaskRun store/projection][O: TaskRun provider/link reader][V: tests cover active, failed, completed, missing linked session cases] Surface existing runs as linkable orchestration context.
- [x] 2.4 [P0][depends:2.1,2.2,2.3][I: mixed core source failures][O: aggregate provider result with per-provider degraded markers][V: tests prove one failed provider does not hide healthy core providers] Implement core provider aggregation.

## 3. Optional Provider Ingestion

- [x] 3.1 [P1][depends:1.1][I: SpecHub provider snapshot][O: provider-neutral spec candidate reader][V: tests cover OpenSpec, spec-kit, unknown/degraded provider states] Read spec work through SpecHub abstraction instead of OpenSpec-specific parsing.
- [x] 3.2 [P2][depends:1.1][I: `.trellis/tasks/**/task.json` and `prd.md` when present][O: optional Trellis workflow provider][V: tests cover absent Trellis, linked metadata, missing PRD, malformed JSON] Read Trellis tasks without making Trellis required.
- [x] 3.3 [P2][depends:1.1][I: package scripts, CI workflows, agent-rule files][O: optional repository-signal provider][V: tests cover absent files and detected signals as advisory only] Expose repository workflow signals without treating them as core task sources.

## 4. Project Map Create-Task Bridge

- [x] 4.1 [P0][depends:1.2,2.2][I: selected Project Map node][O: create-task action that opens task draft][V: component/hook tests cover selected node draft creation] Add create-task entrypoint from Project Map node actions.
- [x] 4.2 [P0][depends:4.1][I: node evidence/confidence/stale metadata][O: draft with provider sourceRefs, evidenceRefs, risk markers, scope summary seed][V: tests cover no-evidence, low-confidence, stale-node cases] Carry evidence and risk markers into the draft.
- [x] 4.3 [P0][depends:4.2][I: created draft][O: persisted candidate/planned orchestration task][V: store + UI tests verify no TaskRun is created] Ensure Project Map create-task never auto-starts execution.
- [x] 4.4 [P1][depends:4.3][I: task source ref][O: navigate from task detail back to Project Map node][V: tests cover existing node focus and missing node fallback] Add back-navigation to source node.

## 5. Orchestration Center UI

- [x] 5.1 [P0][depends:1.2,2.4][I: aggregated candidates and persisted tasks][O: Orchestration Center route/surface entry][V: render test covers plain workspace empty state, loading, degraded, populated states] Add standalone surface without replacing existing Task Center.
- [x] 5.2 [P0][depends:5.1][I: task/candidate list][O: queue with provider/status/engine/workspace/risk filters][V: component tests cover filter combinations without state mutation] Implement queue and filters.
- [x] 5.3 [P0][depends:5.1][I: selected task][O: detail panel with scope, acceptance, provider sources, evidence, linked runs, linked sessions, activity][V: component tests cover degraded refs and empty refs] Implement task detail view.
- [x] 5.4 [P0][depends:5.3][I: supported source/run/session refs][O: bounded provider-aware action rail][V: tests cover open source, open conversation, disabled unsupported routes] Implement navigation actions.
- [x] 5.5 [P1][depends:5.2,5.3][I: visual states and i18n][O: zh/en copy, risk chips, status chips, accessible labels][V: focused UI/i18n tests or snapshot coverage] Polish visible UX without implying OpenSpec/Trellis are required.

## 6. Dispatch And TaskRun Linkage

- [x] 6.1 [P0][depends:5.3][I: candidate/planned/ready task][O: dispatch confirmation dialog with engine, workspace, thread strategy, prompt summary, sources, acceptance][V: tests verify execution cannot start before confirm] Add explicit dispatch gate.
- [x] 6.2 [P0][depends:6.1,1.4][I: confirmed dispatch draft + existing TaskRun launch path][O: TaskRun created with orchestration task linkage][V: integration/focused tests assert linked run id, non-Kanban source, and task status projection] Route dispatch through existing TaskRun/thread/runtime path.
- [x] 6.3 [P0][depends:6.2][I: TaskRun active/terminal states][O: orchestration status projection running/waiting_input/blocked/review_needed][V: tests cover completed->review_needed and failed->blocked] Project linked run lifecycle back to orchestration task.
- [x] 6.4 [P0][depends:6.3][I: linked completed run][O: review actions accept result / request changes / create follow-up][V: tests cover accept->completed and request changes lineage] Implement review gate.
- [x] 6.5 [P1][depends:6.3][I: existing Task Center run detail][O: navigate from Task Center run to orchestration task][V: focused tests cover linked and unlinked runs] Add reverse navigation from run to task.

## 7. Provider Boundaries And Safety

- [x] 7.1 [P0][depends:2.4,6.4][I: orchestration task state changes][O: no automatic provider artifact writes][V: tests/static checks assert no OpenSpec/Trellis/spec-kit/agent-rule writes during ingest/dispatch/review] Enforce read-only provider boundary.
- [x] 7.2 [P0][depends:6.1][I: write-like provider actions][O: explicit future-action placeholder or disabled action with explanation][V: tests cover disabled state and copy] Avoid hidden writes while still showing the next workflow.
- [x] 7.3 [P1][depends:5.4][I: archive orchestration task][O: task hidden from active queue without deleting source artifacts][V: tests cover source artifacts unchanged] Implement local archive semantics.

## 8. Verification And Release Gates

- [x] 8.1 [P0][depends:all implementation tasks][I: OpenSpec artifacts][O: strict validation pass][V: `openspec validate add-agent-task-orchestration-center --strict --no-interactive`] Validate this change.
- [x] 8.2 [P0][depends:1-7][I: changed TypeScript modules][O: type safety pass][V: `npm run typecheck`] Run full TypeScript typecheck.
- [x] 8.3 [P0][depends:1-7][I: changed UI/store/readers][O: focused test pass][V: focused Vitest suites for orchestration store, core providers, Project Map bridge, center UI, dispatch/review] Run targeted frontend tests.
- [x] 8.4 [P1][depends:3.1][I: optional SpecHub provider implementation][O: provider-neutral candidate tests][V: focused SpecHub/OpenSpec/spec-kit degraded-state suites] Run optional spec provider tests if implemented.
- [x] 8.5 [P1][depends:8.3][I: touched runtime/session/backend contracts if any][O: backend/runtime validation][V: `cargo test --manifest-path src-tauri/Cargo.toml` and/or `npm run check:runtime-contracts`, or record not applicable] Run backend gates only if implementation crosses Tauri/Rust/runtime boundaries. Not applicable for this pass: no Tauri/Rust/backend runtime contract files changed.
- [x] 8.6 [P1][depends:8.1,8.2,8.3][I: desktop manual QA][O: manual matrix result][V: Project Map task dispatch, selected item preservation, queued/running status projection, queued cancel, linked session opening, review gate guard, orphan review correction] Complete minimal desktop smoke test before archive.

## 9. Manual QA Follow-up Corrections

- [x] 9.1 [P0][depends:6.1,6.2][I: Project Map queue dispatch UX][O: dispatch confirmation keeps current task selected and visible][V: manual QA confirms selected task detail remains after status changes] Preserve selected work item after dispatch.
- [x] 9.2 [P0][depends:6.2,6.3][I: linked TaskRun lifecycle][O: queue statuses derived from latest linked run: queued/running/failed/review/todo][V: typecheck and focused dispatch test] Derive queue status from TaskRun instead of task intent alone.
- [x] 9.3 [P0][depends:9.2][I: queued TaskRun][O: cancel dispatch action marks run canceled and task planned][V: manual QA confirms queued item can be canceled and retried] Add queued dispatch cancellation.
- [x] 9.4 [P0][depends:6.4,9.2][I: review-needed task with no completed linked run][O: Review Gate hidden and diagnostic shown][V: manual QA confirms `0 run / 0 session` task does not show review actions] Require completed linked run for Review Gate.
- [x] 9.5 [P0][depends:9.4][I: stale local review state][O: lifecycle projection corrects orphan review intent to planned/not_started][V: typecheck and manual QA] Correct orphan review state projection.

## 10. Code-First Calibration Implementation - 2026-06-03

- [x] 10.1 [P0][depends:8.6][I: transient provider candidate selected for dispatch][O: candidate is upserted into local OrchestrationTask store before TaskRun creation][V: not run this pass; implementation updates dispatch boundary] Fix provider candidate dispatch persistence risk.
- [x] 10.2 [P1][depends:8.6][I: manual provider utility and Work Queue empty state][O: user-facing manual task form creates local manual OrchestrationTask with no invented evidence][V: not run this pass; implementation wires UI -> local store] Implement manual task UI scope.
- [x] 10.3 [P1][depends:8.6][I: SpecHub provider reader and layout runtime][O: SpecHub provider snapshot is passed to Work Queue at runtime; Trellis/repository-signal runtime inputs remain deferred][V: not run this pass; implementation wires SpecHub snapshot only] Implement optional provider runtime scope for SpecHub and keep remaining providers deferred.
