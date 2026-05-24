## Implementation Evidence

Date: 2026-05-24

## Code Hot-Path Inventory

- `useFileDocumentState` previously committed raw `content` after read completion. The hook now owns a `FileDocumentSnapshot` with `contentHash`, `byteLength`, `lineCount`, `snapshotVersion`, and bounded line access.
- `FileViewPanel` previously called `measureFilePreviewMetrics(content)` and built a full `lines` array for every code preview. It now consumes snapshot metrics and only materializes full lines for small previews.
- `FileViewBody` now uses `CodePreviewVirtualList` for large code previews. Visible rows are highlighted through a bounded cache keyed by snapshot hash, language, line index, and line text.
- `FileTreePanel` now upgrades `visibleTreeNodeEntries` into `VisibleFileTreeRow` and switches large visible trees to `@tanstack/react-virtual`; root actions remain fixed outside the virtual list.
- `FileMarkdownPreview` keeps existing compile/block architecture but uses a render-pressure-aware progressive cadence and defers heavy blocks during active editor split engine pressure.
- `useFileExternalSync` now keeps clean disk refreshes pending while render pressure is active and guards pending apply by `previewSnapshotVersion`.
- `FilePreviewPopover` caps text/code hover previews to a deterministic line budget.
- `FileStructuredPreview` falls back to bounded code/text preview when shell/dockerfile content exceeds structured parse budgets.
- Editor line-range tracking now updates the local file panel affordance first and publishes the Composer active-file reference through a delayed low-priority path. Cursor clicks no longer synchronously force layout/composer/context-ledger recomputation.
- Edit-mode AI annotation controls are now footer-scoped: the editor body no longer renders a sticky top annotation toolbar, the footer path state toggle has been removed, footer inner controls no longer use nested per-button borders, and annotation draft actions are left-aligned.
- CodeMirror edit annotation marker/draft widgets now resolve through a sorted target helper before `RangeSetBuilder.add`, preventing range-order crashes when a new draft targets an earlier line than an existing marker.

## Final Review Closeout

Final workspace review found and fixed these edge risks before commit:

| Severity | Finding | Fix |
|---|---|---|
| P0 | File read completion could still cascade into unbounded render work if secondary surfaces or tree/code preview bypassed the viewport boundary. | Added snapshot-based bounded line access, code preview virtualization, file tree virtualization, popover caps, and structured-preview parse budgets. |
| P1 | A clean external disk update detected during an auto-apply debounce could be dropped when the visible preview snapshot version changed before the debounce fired. | `useFileExternalSync` now records the disk snapshot as `externalPendingRefresh` with `expectedSnapshotVersion` instead of returning silently. |
| P1 | Manual pending refresh apply could clear state without preserving the disk update when preview snapshot versions diverged. | Pending apply now either confirms the already-synced snapshot, promotes to conflict if local content changed, or applies only when the expected snapshot still matches. |
| P1 | Engine conversation render pressure could still allow clean external refreshes to rebuild the file preview immediately. | Clean refreshes remain pending while `FileRenderPressure` indicates foreground editor/chat pressure. |
| P1 | Edit-mode annotation draft could crash CodeMirror when the active draft line sorted before an existing marker line. | Added sorted marker/draft target resolution and focused regression coverage for same-line marker-before-draft plus later marker ordering. |
| P2 | File editor exposed duplicate annotation/path controls in the body topbar and footer, adding visual noise and regression risk. | Removed the editor-body annotation toolbar, moved the annotation action into the current-file footer, removed the path state toggle, and simplified footer button chrome. |
| P2 | New preview fallback UI initially contained hardcoded English strings. | Preview popover and structured fallback labels now use existing i18n keys. |

## Validation

Measured locally on macOS:

- `npm run typecheck` passed.
- `npm run lint` passed.
- Focused Vitest passed:
  - `src/features/files/utils/fileDocumentSnapshot.test.ts`
  - `src/features/files/hooks/useFileExternalSync.test.tsx`
  - `src/features/files/hooks/useFileDocumentState.test.tsx`
  - `src/features/files/utils/fileRenderProfile.test.ts`
  - `src/features/files/components/FilePreviewPopover.test.tsx`
  - `src/features/files/components/FileStructuredPreview.test.ts`
  - `src/features/files/components/FileMarkdownPreview.test.tsx`
  - `src/features/files/components/FileViewPanel.test.tsx`
  - `src/features/files/components/FileViewPanel.external-change.test.tsx`
  - `src/features/files/components/FileTreePanel.run.test.tsx`
- Full heavy-test noise sentry passed:
  - `npm run check:heavy-test-noise`
  - 533 Vitest files completed.
  - repo-owned `act` warnings: 0.
  - repo-owned stdout payload lines: 0.
  - repo-owned stderr payload lines: 0.
- Large-file governance passed:
  - `npm run check:large-files` found 0 fail-scope files.
  - `npm run check:large-files:gate` found 0 fail-scope files.
  - `npm run check:large-files:near-threshold` reported only existing watch-scope warnings.
  - `node --test scripts/check-large-files.test.mjs` passed.
- Heavy-test noise parser and batch runner tests passed:
  - `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
- `openspec validate refactor-file-open-rendering-scheduler --strict --no-interactive` passed.
- `npm run check:runtime-evidence-gates` passed and regenerated runtime evidence reports.
- `npm run perf:long-list:browser-scroll` passed as proxy virtualization evidence.

## File-Open Evidence Matrix

| Scenario | Evidence | Classification | Notes |
|---|---|---|---|
| `large-code-open` | `FileViewPanel` large code test asserts `.fvp-code-preview.is-virtualized`, snapshot line count `1500`, and mounted `.fvp-code-line` count below total lines. | measured unit/runtime-jsdom | Browser frame timing still needs manual app smoke before archive. |
| `large-markdown-under-streaming` | `FileMarkdownPreview` pressure test asserts 16ms does not advance progressive chunks under active render pressure and the passive cadence advances later. | measured unit/runtime-jsdom | Uses narrow `FileRenderPressure` prop, no conversation reducer import. |
| `large-tree-expand` | `FileTreePanel` large tree test asserts virtualized row container and row-count contract after expanding `src` with 320 files. | measured unit/runtime-jsdom | Existing small-tree tests cover selection, context, drag, root actions, and lazy states. |
| `external-sync-under-pressure` | `useFileExternalSync` pressure test asserts clean auto refresh remains pending and does not replace visible content while engine/editor split pressure is active. | measured hook/jsdom | Dirty conflict behavior remains covered by existing conflict test. |
| `editor-line-click-latency` | `FileViewPanel` editor-line test asserts line affordance updates locally immediately while `onActiveFileLineRangeChange` is delayed and coalesced. | measured unit/runtime-jsdom | Targets the edit-mode cursor-click hot path reported after the first implementation pass. |
| `editor-annotation-widget-order` | `FileViewPanel` focused test asserts edit-mode marker/draft targets are ordered as same-line marker, same-line draft, later marker before CodeMirror receives ranges. | measured unit/runtime-jsdom | Regression guard for `Ranges must be added sorted by from position and startSide`. |
| `footer-scoped-annotation-controls` | `FileViewPanel` focused test asserts the old `.fvp-annotation-toolbar` is absent and the footer annotation action remains available. | measured unit/runtime-jsdom | Visual chrome cleanup is CSS-only and should be smoke-checked in the app. |
| generic long-list scroll | `npm run perf:long-list:browser-scroll` passed. | proxy | Supports virtualization confidence only; not a substitute for file-open evidence. |
| Windows compatibility | Snapshot newline tests cover CRLF/LF bounded access; existing Windows-path FileViewPanel tests remain passing. | partial/proxy | Real Windows app smoke not available in this environment and remains a residual archive gap. |
| macOS compatibility | Local commands above ran on macOS workspace. | measured local | Native app manual smoke still recommended before archive. |

## Residual Risk

- Markdown compile itself is still synchronous for the active snapshot. The staged/pending guards prevent stale commits and passive cadence avoids foreground timer contention, but a very large Markdown compile can still require future workerization if manual smoke shows first-paint stalls.
- File tree virtualization is threshold-gated at large visible row counts to limit blast radius. Small trees intentionally keep the previous recursive path.
- Windows native scroll/drag/watcher behavior was not directly measured in this environment.
