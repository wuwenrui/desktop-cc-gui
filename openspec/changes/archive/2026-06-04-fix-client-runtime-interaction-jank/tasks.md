## 1. Baseline And Evidence Setup

- [x] 1.1 [P0] Inventory current hot-path render/update sites for Composer, Messages, thread switching, Sidebar, Session Radar, and session catalog. Input: current source tree. Output: code reference map in implementation notes. Verification: references include at least one file/line for each hot path.
- [x] 1.2 [P0] Capture current proxy baseline for streaming typing using existing Composer input fixtures. Input: `src/test-fixtures/perf/composerInputFixture50.ts` and `composerInputFixture100ime.ts`. Output: focused Vitest or helper evidence. Verification: test/proxy report records render count or input update cadence.
- [x] 1.3 [P0] Define measured evidence collection method for browser/Tauri/WebView runs. Input: available dev tooling. Output: documented command or manual profiler checklist. Verification: checklist classifies evidence as measured/proxy/manual-only/unsupported.
- [x] 1.4 [P1] Add bounded diagnostic shape for client interaction performance evidence if no reusable shape exists. Input: existing diagnostics utilities. Output: content-safe evidence helper. Verification: unit test proves payload excludes prompt/assistant/tool body text.

## 2. Composer Input Hot Path

- [x] 2.1 [P0] Audit `Composer` props passed to `ChatInputBoxAdapter` during streaming and mark send-critical vs advisory props. Input: `Composer.tsx`. Output: prop classification notes or helper types. Verification: classification includes text, attachments, selection/IME, context usage, rate limits, stream phase, status summary.
- [x] 2.2 [P0] Extend `ChatInputBoxAdapter` comparator for structurally equal stream-facing props that currently churn references. Input: adapter props. Output: comparator helpers and focused tests. Verification: structurally equal advisory payloads do not rerender adapter; send-critical changes still rerender.
- [x] 2.3 [P0] Keep Composer draft text, IME composition, selection, attachments, and submit payload outside any deferred path. Input: Composer/ChatInputBox state flow. Output: focused regression test. Verification: streaming + IME fixture preserves final draft and send payload.
- [x] 2.4 [P1] Stabilize advisory prop construction in `Composer` to avoid rebuilding equal arrays/objects during streaming. Input: context chips, queue, rate limits, status panel, stream phase. Output: memoized or primitive dependency projections. Verification: adapter comparator test or render counter confirms no-op updates.
- [x] 2.5 [P1] Add a typing-active convergence test for deferred advisory props. Input: streaming state fixture. Output: test covering active typing lag and post-idle convergence. Verification: deferred props converge after idle/settlement without changing draft text.

## 3. Status Panel Projection

- [x] 3.1 [P0] Extract current `useStatusPanelData` expensive derivations into pure helpers with explicit inputs. Input: `useStatusPanelData.ts`. Output: helper functions for tool entry collection and scoped status projection. Verification: existing status panel tests pass.
- [x] 3.2 [P0] Add scoped index or cache for `itemsByThread` / fallback parent derivation. Input: active thread id, thread parent map, items by thread. Output: indexed projection path. Verification: test proves repeated text deltas do not rebuild all-thread fallback parent map.
- [x] 3.3 [P0] Route active typing + streaming through scoped/deferred status summary. Input: Composer active interaction state and status data. Output: last-good or deferred summary behavior. Verification: streaming typing test proves status projection does not scan all threads per input event.
- [x] 3.4 [P1] Preserve subagent navigation target correctness after projection caching. Input: task/collab tool fixtures. Output: focused tests. Verification: task output, receiver thread, and fallback link navigation remain correct.

## 4. Messages Streaming Render

- [x] 4.1 [P0] Verify `Messages` still uses stable timeline snapshot plus latest live assistant/reasoning override. Input: existing Messages tests. Output: regression test or updated assertion. Verification: live row gets latest text while grouping/boundaries use stable snapshot.
- [x] 4.2 [P0] Add guard against new timeline-heavy derivations depending directly on latest `renderSourceItems` during streaming. Input: Messages derivation dependencies. Output: test or static review checklist. Verification: grouping, anchors, sticky, boundary sets derive from stable timeline presentation.
- [x] 4.3 [P0] Add streaming interactive-controls responsiveness coverage. Input: Stop button, message toolbar, copy/fork/rewind, context controls, and scroll controls. Output: focused test or profiler checklist. Verification: control handlers remain reachable while live output deltas are arriving and do not wait for full timeline/status/catalog derivation.
- [x] 4.4 [P1] Decouple control enabled/disabled state from deferred advisory summaries where it is runtime-critical. Input: streaming control state and toolbar props. Output: immediate runtime-control state path with deferred visual summaries only. Verification: Stop/settlement state follows canonical runtime state; deferred summaries cannot drop a user click.
- [x] 4.5 [P1] Throttle or coalesce scroll-key/auto-follow work under high-frequency streaming. Input: existing scroll effects. Output: adjusted scheduling. Verification: test or measured evidence shows input path not blocked by repeated smooth scroll work.
- [x] 4.6 [P1] Evaluate thinking-state virtualization alternatives without enabling unsafe full virtualization. Input: long timeline fixture. Output: evidence note comparing content-visibility, collapsed middle steps, non-live row virtualization. Verification: evidence records active row/scroll/selection risks.
- [x] 4.7 [P2] Implement safe non-live row bounding only if evidence from 4.6 supports it. Input: selected strategy. Output: bounded render path. Verification: long-list and live-row tests pass; no active row reset.

## 5. Foreground-First Thread Switching

- [x] 5.1 [P0] Map all thread selection entrypoints: Sidebar, Topbar tabs, Radar, search, notification action, workspace flows. Input: source search. Output: entrypoint matrix. Verification: matrix lists handler and current async work for each entrypoint.
- [x] 5.2 [P0] Split foreground active selection from non-critical work in the primary navigation helper. Input: `navigateToThreadWithUiOptions`. Output: foreground-first handler. Verification: focused test proves `setActiveThreadId` occurs without awaiting history/catalog work.
- [x] 5.3 [P0] Add request token or scope guard for history restore and hydration triggered by thread switch. Input: refresh/hydration calls. Output: stale response guard. Verification: rapid A->B switch test proves late A result cannot overwrite B.
- [x] 5.4 [P1] Move right-panel collapse/layout-heavy mutation to transition or staged path when safe. Input: layout state mutations. Output: scheduled non-critical mutation. Verification: UI state remains correct in compact and non-compact tests.
- [x] 5.5 [P1] Add measured/proxy thread switch evidence separating foreground latency and hydration latency. Input: profiler checklist or test helper. Output: evidence report. Verification: report includes foreground selection, history restore, sidebar projection, catalog request phases.

## 6. Sidebar And Session Projection Render Cost

- [x] 6.1 [P0] Audit Sidebar workspace projection dependencies: thread rows, folder tree, folder overrides, move targets, running/recent counts, active ids. Input: `Sidebar.tsx` and related components. Output: dependency map. Verification: map identifies which changes should affect one workspace vs all workspaces.
- [x] 6.2 [P0] Memoize folder/session projection by workspace and primitive dependencies. Input: session folders, rows, overrides. Output: workspace-scoped projection helpers. Verification: tests prove unrelated workspace folder tree is not recomputed for active thread change.
- [x] 6.3 [P1] Stabilize `ThreadList` row props and handlers to reduce rerender blast radius. Input: `ThreadList.tsx`. Output: memoized row component or stable prop projection. Verification: active row/highlight change updates expected rows only.
- [x] 6.4 [P1] Keep running/recent session counts workspace-scoped. Input: Session Radar counts. Output: count projection keyed by workspace. Verification: count update for workspace A does not rebuild workspace B projection.

## 7. Session Catalog And Attribution Hydration

- [x] 7.1 [P0] Replace first-page `SESSION_CATALOG_PAGE_SIZE = 9_999` in frontend catalog callers with bounded page size. Input: settings catalog and thread actions catalog. Output: bounded constants and pagination behavior. Verification: tests assert limit is bounded and load older/search older remains available.
- [x] 7.2 [P0] Add debounce/transition for Session Management keyword and filter changes. Input: filter state flow. Output: coalesced query behavior. Verification: rapid keyword typing test issues one final request or drops stale responses.
- [x] 7.3 [P0] Add stale guard for catalog responses by workspace/mode/filter/cursor. Input: `useWorkspaceSessionCatalog`. Output: request key guard. Verification: old filter response cannot replace current rows.
- [x] 7.4 [P1] Add in-flight dedupe/cache for equivalent workspace session catalog queries. Input: service/hook call sites. Output: dedupe keyed by workspace, mode, filters, cursor, limit. Verification: equivalent callers share request; different attribution mode or filter does not.
- [x] 7.5 [P1] Update backend catalog projection if necessary to support bounded pages or capped partial evidence. Input: Rust session management catalog. Output: cursor/cap/source status improvements. Verification: Rust tests cover capped partial and no duplicate page entries.

## 8. Session Radar And Prewarm

- [x] 8.1 [P0] Audit Radar/prewarm hydration paths and identify foreground contention with active typing/switching. Input: `useWorkspaceThreadListHydration`, Session Radar hooks/components. Output: contention map. Verification: map lists active workspace hydration, related owner hydration, idle prewarm.
- [x] 8.2 [P0] Stage non-active workspace prewarm behind foreground interaction budget. Input: hydration scheduler. Output: delayed/idle/bounded prewarm behavior. Verification: active thread selection does not wait for prewarm.
- [x] 8.3 [P1] Ensure Radar navigation uses foreground-first switch contract. Input: Radar click handlers. Output: shared navigation path or compatible wrapper. Verification: running/recent Radar jump test passes and stale hydration cannot reselect old target.
- [x] 8.4 [P1] Stabilize Radar aggregate ordering and dedupe under staged updates. Input: Radar running/recent projection. Output: deterministic projection helper/tests. Verification: concurrent updates do not duplicate rows or reorder ties nondeterministically.

## 9. Validation And Closure

- [x] 9.1 [P0] Run `openspec validate fix-client-runtime-interaction-jank --strict --no-interactive`. Input: OpenSpec artifacts. Output: validation pass. Verification: command exits successfully.
- [x] 9.2 [P0] Run focused Vitest suites for Composer adapter/input, Messages streaming, thread switch, Sidebar projection, and Session catalog hooks. Input: touched frontend tests. Output: focused test pass. Verification: command outputs successful suites.
- [x] 9.3 [P1] Run `npm run typecheck` after implementation. Input: full TS project. Output: typecheck pass. Verification: command exits successfully.
- [x] 9.4 [P1] Run Rust focused tests or `cargo test --manifest-path src-tauri/Cargo.toml` if backend catalog behavior changes. Input: touched Rust files. Output: backend test pass. Verification: command exits successfully or skipped with reason if frontend-only.
- [x] 9.5 [P1] Produce final performance evidence report. Input: measured/proxy/manual evidence. Output: report classifying typing, streaming, thread switching, sidebar projection, and catalog hydration. Verification: report separates measured from proxy evidence and lists unresolved gaps.
