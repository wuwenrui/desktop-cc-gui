# P0 Performance Workspace Reconciliation - 2026-06-10

## Purpose

This note reconciles the current dirty worktree against the active P0 performance OpenSpec changes.

The goal is to prevent two failure modes:

- Marking tasks complete because nearby files changed, without evidence that the specific capability contract was implemented.
- Continuing implementation without first closing completed evidence anchors, which would make later performance deltas hard to interpret.

## Scope

Included active changes:

- `refresh-v059-performance-baseline`
- `enforce-bundle-budget-gate`
- `harden-file-editor-typing-latency`
- `parallelize-bootstrap-locale-loading`
- `split-startup-css-loading`
- `split-app-shell-performance-boundaries`
- `lazy-markdown-runtime`
- `lazy-file-preview-dependencies`
- `search-index-and-bounded-hydration`
- `realtime-trace-correlation-gate`

## Code Evidence Attribution

| Change | Evidence observed in dirty worktree | Status decision |
|---|---|---|
| `refresh-v059-performance-baseline` | `docs/perf/baseline.*`, `docs/perf/history/v0.5.9-baseline.*`, `docs/perf/runtime-evidence-gates.*`, perf aggregation script changes | Closure candidate |
| `enforce-bundle-budget-gate` | `scripts/check-bundle-chunking.mjs`, `scripts/bundle-budget.config.json` | Closure candidate |
| `harden-file-editor-typing-latency` | File editor state/external-sync tests, file typing diagnostics, file view panel hot-path changes | Closure candidate |
| `parallelize-bootstrap-locale-loading` | `src/bootstrapApp.tsx`, `src/i18n/index.ts`, bootstrap/i18n tests, user-run desktop startup/input smoke | Archived after manual verification |
| `split-startup-css-loading` | `src/bootstrap.ts` CSS removal, `src/styles/featureStyleLoaders.ts`, feature activation style loaders, CSS-ready guard, post-build bundle gate with `app-css` gzip `132.2 KiB`, user-run first-screen/feature first-open visual QA | Archived after manual verification |
| `split-app-shell-performance-boundaries` | `src/app-shell-parts/lazyViews.tsx`, `src/app-shell-parts/renderAppShell.tsx`, lazy boundary test | Partial; controller lazy and `@ts-nocheck` cleanup remain |
| `lazy-markdown-runtime` | Naive `Markdown.tsx` shell split was attempted and reverted after focused Markdown tests exposed regressions | Do not mark implementation complete |
| `lazy-file-preview-dependencies` | Async per-language CodeMirror extension cache, stale loader guard, lazy `FilePdfPreview` boundary, focused tests, build and bundle gate | Partial implementation complete |
| `search-index-and-bounded-hydration` | Recency cache moved out of hot query compute, active-first bounded global hydration, provider-level timing metrics, focused search tests | Partial implementation complete |
| `realtime-trace-correlation-gate` | Perf report artifacts changed, but no correlated realtime trace source implementation observed | Do not mark implementation complete |

## Closure Order

1. `refresh-v059-performance-baseline`
2. `enforce-bundle-budget-gate`
3. `harden-file-editor-typing-latency`
4. `parallelize-bootstrap-locale-loading`
5. `split-startup-css-loading`
6. `split-app-shell-performance-boundaries`
7. `lazy-markdown-runtime`
8. `lazy-file-preview-dependencies`
9. `search-index-and-bounded-hydration`
10. `realtime-trace-correlation-gate`

## Remaining Work by Category

### Closure candidates

- Archived and synced: `refresh-v059-performance-baseline`, `enforce-bundle-budget-gate`, `harden-file-editor-typing-latency`, `parallelize-bootstrap-locale-loading`, `split-startup-css-loading`.

### Manual verification completed

- `parallelize-bootstrap-locale-loading`: user-run desktop startup / renderer-ready / composer typing before-after input history hydration smoke passed on 2026-06-10.
- `split-startup-css-loading`: user-run desktop first-screen, compact first-screen, and moved-feature first-open visual checks passed on 2026-06-10.

### Implementation backlog

- `split-app-shell-performance-boundaries`
  - Move eligible inactive feature controllers behind lazy boundaries.
  - Remove remaining core-shell `@ts-nocheck` debt using explicit TypeScript contracts.

- `lazy-markdown-runtime`
  - Split full Markdown parser chain without changing existing completed-message first-render semantics.
  - Preserve tool-call fallback, math, file links, progressive reveal, and code-block tests.
  - Add startup/bundle evidence only after focused Markdown tests pass.

- `lazy-file-preview-dependencies`
  - Split remaining CodeMirror runtime/search activation from static file panel path.
  - Adjust chunk strategy if needed so dynamic language modules are not all collapsed into eager `vendor-codemirror` evidence.
  - Add file type switching and find-in-file lazy search regression tests.

- `search-index-and-bounded-hydration`
  - Add per-workspace normalized indexes and source version invalidation.
  - Add stale async provider guard beyond current debounced synchronous providers.
  - Record representative query elapsed/candidate evidence.

- `realtime-trace-correlation-gate`
  - Add turn-level trace correlation from ingress to visible render and terminal settlement.

## Operating Rule

Do not archive a P0 change only because adjacent code changed. Archive only when its own `tasks.md`, spec deltas, validation claims, and evidence artifacts line up.
