# Tasks: Stabilize Long Running Client Runtime 2026-06

## Execution Notes

- Execute in order: `0 -> 1 -> 2 -> 3 -> 4 -> 5`.
- Phase 1 is the P0 gate; do not start release evidence closure before process lifecycle diagnostics are split into registry and OS-liveness evidence.
- Phase 2/3 can be assigned to separate implementers after Phase 0, but Sidebar virtualization must wait for task 3.1 `SidebarVirtualItem`.
- Do not implement task 6 follow-ups in this change.

## 0. Baseline / Inventory

- [x] 0.1 [P0][depends:none][input:`docs/perf/parallel-conversation-jank-handbook.md`, `docs/perf/jank-fix-progress.md`, current code][output: baseline note in this change or `docs/perf/*` recording workspace count, session count, OS, run duration, active child count, module switch p95, visible row count, worker pending count][validation: baseline values are explicit and labeled measured/proxy/manual/unsupported] Capture current long-run baseline.
- [x] 0.2 [P0][depends:0.1][input:`chat-stream-render-isolation-2026-06` proposal/design/tasks][output: "do not duplicate" checklist for reducer fast path, streaming virtualization, workspace-scoped refs, Messages timer cleanup][validation: checklist appears in implementation notes before code changes] Align with chat-stream-render-isolation.

## 1. P0 Engine Child Process Lifecycle Parity

- [x] 1.1 [P0][depends:0.2][input:`src-tauri/src/engine/opencode.rs` `active_processes` map][output:`impl Drop for OpenCodeSession` using `try_lock`, `drain`, `start_kill`, warning on lock failure, no await][validation: focused Rust test or unit helper test proves remaining child handle gets best-effort kill] Add OpenCode Drop fallback.
- [x] 1.2 [P0][depends:1.1][input:`src-tauri/src/engine/gemini.rs` `active_processes` map][output:`impl Drop for GeminiSession` using same non-blocking contract][validation: focused Rust test or unit helper test proves remaining child handle gets best-effort kill] Add Gemini Drop fallback.
- [x] 1.3 [P0][depends:1.2][input:`src-tauri/src/engine/commands.rs` `get_engine_active_process_diagnostics`, frontend service wrapper][output: diagnostics include Claude/OpenCode/Gemini workspace rows,total registered active count,timestamp,local/remote qualifier][validation: `src-tauri/src/engine/commands_tests.rs` and `src/services/tauri.test.ts` updated/pass] Extend registered active process diagnostics.
- [x] 1.4 [P1][depends:1.3][input: active process insertion/removal sites and any existing IO/progress metadata][output: diagnostics-only stale child candidates using registered age plus optional progress metadata; engines without progress metadata emit `progressEvidence=unsupported`; no default kill][validation: test covers age-only stale candidate classification without killing and without claiming unsupported progress] Add diagnostics-only stale child candidate reporting.
- [x] 1.5 [P0][depends:1.3][input: active process diagnostics and platform process sampling availability][output: separate evidence fields for registered active process count and sampled OS child liveness after close][validation: evidence marks OS sampling as measured/manual/proxy/unsupported and never equates registry-zero with OS exit] Split registry and OS-liveness evidence.
- [x] 1.6 [P0][depends:1.5][input: Codex runtime/session lifecycle][output: audit note documenting why Codex is included/excluded from this child-process parity path][validation: note references actual Codex runtime ownership files and does not change behavior] Audit Codex process model.

## 2. P1 Home / Workspace Long List Virtualization

- [x] 2.1 [P1][depends:0.2][input:`src/features/home/components/HomeChat.tsx`, existing `@tanstack/react-virtual` patterns][output: workspace picker virtualizes when filtered workspace count >= 100; key remains `workspace.id`; search/filter semantics preserved][validation: HomeChat focused test with 200 workspaces renders bounded rows and preserves selection/search] Virtualize HomeChat workspace picker.
- [x] 2.2 [P1][depends:2.1][input: HomeChat CSS and popover layout][output: stable virtualized list height/scroll behavior without text overlap or layout jump][validation: focused component test or manual screenshot note records no visible overlap] Stabilize picker layout.

## 3. P1 Sidebar / ThreadList Session Virtualization And Lazy Projection

- [x] 3.1 [P1][depends:0.2][input:`src/features/app/components/Sidebar.tsx`, `ThreadList.tsx`, folder/worktree/pinned rendering paths][output: `SidebarVirtualItem` model covering workspace header, thread row, pinned row, folder row, separator, load-more, empty-state with stable domain keys][validation: focused unit fixture proves 200-thread mixed sidebar flattens to stable keys without index keys] Define Sidebar virtual item model.
- [x] 3.2 [P1][depends:3.1][input:`src/features/app/components/ThreadList.tsx`, `src/features/app/components/Sidebar.tsx`, `threadRowStatusStore.tsx`][output: session list virtualizes when row count >= 100; active/selected thread row remains reachable and mounted or restored correctly][validation: focused test with 200 threads confirms DOM rows <= virtualizer budget and active row semantics] Virtualize session rows.
- [x] 3.3 [P1][depends:3.2][input: `threadStatusById`, `backgroundActivityByThread`, sidebar projection call sites][output: visible-row lazy projection helper + bounded LRU max 200; no full projection on workspace switch][validation: projection spy shows only visible rows computed under 200-thread fixture] Add visible-row projection.
- [x] 3.4 [P1][depends:3.3][input: existing Sidebar/ThreadList tests][output: scroll restoration, selected row, pinned row, workspace group behavior preserved][validation: existing Sidebar/ThreadList focused tests pass plus new virtualized fixture] Preserve list semantics.
- [x] 3.5 [P1][depends:3.4][input:`npm run perf:long-list:baseline`][output: before/after long-list metrics recorded with environment qualifier][validation: no regression or documented residual blocker] Run long-list perf gate.

## 4. P1 Streaming Render / Worker Lifecycle Extension

- [x] 4.1 [P1][depends:0.2][input:`src/features/markdown/fastMarkdownRenderer/workerAdapter.ts`][output: diagnostics for `pendingRequestCount`, `disposedCount`, `fallbackCount`, `staleResultDropCount`, `lastFallbackReason`][validation: unit tests cover success, worker creation failure, broken worker, dispose rejects pending] Add worker lifecycle diagnostics.
- [x] 4.2 [P1][depends:4.1][input:`workerAdapter.ts`, `useFastMarkdownRender.ts`][output: adapter reports pending/dispose/fallback lifecycle; hook/caller reports stale visible-result drops via request ordinal or explicit latest-source registry][validation: unit tests distinguish adapter unknown request/dispose from hook-level stale visible-result ignore] Add stale result diagnostics at the correct ownership layer.
- [x] 4.3 [P1][depends:4.2][input:`markdown-parse-pipeline` existing final precompute contract][output: final large Markdown precompute uses existing worker-capable path; live partial fragments keep lightweight path][validation: focused Markdown tests prove live streaming does not invoke full rich parser per delta] Preserve live lightweight path.
- [x] 4.4 [P1][depends:4.3][input:`npm run perf:realtime:runtime-report`][output: worker pending/request/fallback data added as proxy evidence or explicit unsupported marker][validation: report remains content-safe and bounded] Wire render evidence.

## 5. Evidence Gates / Specs

- [x] 5.1 [P0][depends:1.5,3.3,4.1][input: spec deltas in this change][output: runtime evidence gate includes every `S-LR-*` metric with source path and evidence class, or explicit unsupported/manual-only marker][validation: `npm run check:runtime-evidence-gates` passes and missing measured evidence is not promoted] Encode evidence budgets.
- [x] 5.2 [P0][depends:5.1][input: OpenSpec artifacts][output: strict OpenSpec validation pass][validation:`openspec validate stabilize-long-running-client-runtime-2026-06 --strict --no-interactive`] Validate OpenSpec.
- [x] 5.3 [P0][depends:5.2][input: TypeScript/Rust code][output: `npm run typecheck`, `npm run lint`, focused vitest/Rust tests pass][validation: commands exit 0] Run code quality gates.
- [x] 5.4 [P1][depends:5.3][input: local Tauri/WebView run][output: release-grade runtime evidence deferral documented: this change records proxy/unsupported evidence only, and true 15-30min Tauri/WebView long-run trace remains follow-up 6.4][validation: no trace was fabricated; `S-LR-*` evidence class stays measured/proxy/manual/unsupported as encoded by runtime evidence gate] Document long-run trace deferral.

## 6. Explicit Follow-Up / Out Of Scope

- [ ] 6.1 [follow-up][owner:renderer-resource-backpressure] Introduce global timer owner registry and idle scheduling across all runtime hooks.
- [ ] 6.2 [follow-up][owner:image-resource-release] Extend `mediaResourceOwners` to `convertFileSrc` / data URL proxy and add `LocalImage` viewport/session release.
- [ ] 6.3 [follow-up][owner:handler-stability] Split `useThreadEventHandlers` internals only after rebuild evidence proves it matters; do not change `useAppServerEvents` public signature without a separate proposal.
- [ ] 6.4 [follow-up][owner:release-grade-evidence] Upgrade `S-LR-*` proxy budgets to measured runtime/WebView evidence.
