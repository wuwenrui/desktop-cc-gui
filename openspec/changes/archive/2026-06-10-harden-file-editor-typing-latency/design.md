# Design / 设计

## Hot Path Boundary / 热路径边界

File editor typing MUST be treated as a high-frequency foreground interaction. The synchronous keystroke path is limited to:

1. CodeMirror transaction.
2. Local editor document update.
3. Minimal local dirty marker update.
4. Visible editor echo.

The following work MUST NOT run synchronously for every keystroke:

- Tauri file read/write invoke.
- FS write.
- `clientStorage` write.
- Workspace file tree refresh.
- AppShell-wide recomputation.
- Composer/context-ledger publication.
- Full preview rebuild.
- External sync full-content reload.

## State Ownership / 状态归属

| State | Owner | Timing |
|---|---|---|
| Editor document text | CodeMirror/editor-local state | immediate |
| Dirty marker | file editor local state | immediate and small |
| Current cursor/selection/line range | editor-local first, global publication later | delayed/coalesced |
| Active-file reference for Composer/context | global state | delayed/latest-wins |
| Save status | file panel state + persistence side channel | explicit save or debounced autosave |
| External-change notice | external sync hook | event/debounce guarded |
| Stable preview snapshot | render model | explicit refresh/live preview only |

## Persistence Policy / 持久化策略

Typing MUST NOT persist transient editor state on every keystroke.

- Explicit save remains user-critical and should execute immediately.
- Autosave, if enabled, MUST debounce and collapse repeated edits.
- Preference or metadata writes triggered by editor interaction MUST be grouped by store/key and debounced.
- Save diagnostics MAY record counts and timings, but MUST NOT include file content.

## External Sync and Watcher Feedback / 外部同步与 Watcher 回声

Watcher and external sync must separate four cases:

1. Dirty buffer + external disk change: preserve dirty buffer and expose conflict UI.
2. Clean buffer + external disk change: expose pending refresh or apply only when live preview explicitly allows it.
3. Self-save watcher event: suppress full reload/reparse if saved content hash/version matches the editor snapshot.
4. Stale event for previous file/snapshot: drop by file identity and snapshot version.

## Evidence / 证据

The evidence payload is content-safe and bounded.

Recommended fields:

- workspace id, file id/path hash, file kind, byte length bucket, line count bucket.
- input event count and cadence.
- visible echo latency P50/P95/P99.
- editor transaction duration P95.
- React commit duration where available.
- long task count and max duration.
- Tauri invoke count during typing window.
- FS write count during typing window.
- `clientStorage` write count during typing window.
- stale external sync drops and self-save suppression count.
- evidence class: `measured`, `proxy`, `manual-only`, `unsupported`.

## Rollback / 回滚

The optimization should be layer-rollback safe:

- Diagnostics can be disabled without changing editor semantics.
- Delayed line-range publication can fall back to current publication behavior while preserving typing correctness.
- Persistence coalescing can be disabled per writer if it causes data-loss risk.
- External sync guards MUST NOT be rolled back in a way that overwrites dirty buffers.

