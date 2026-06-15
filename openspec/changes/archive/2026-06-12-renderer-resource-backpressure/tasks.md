# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 2 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Inventory / 盘点

- [x] Audit `services/events.ts` terminal/runtime subscriptions and current consumers.
- [x] Audit `rendererDiagnostics.ts` heartbeat/watchdog/listener ownership and caps.
- [x] Run listener/timer inventory for high-risk surfaces: app shell、terminal/runtime、workspace focus refresh、git/history panel、session activity、file tree。
- [x] Identify deferred media/object URL creation sites before introducing release hooks.

## Contract / 契约设计

- [x] 先定义公共 substrate 边界：`eventBackpressure` API、listener owner registry、`useFocusRefresh` 契约、diagnostics 字段命名；下游 change 只能复用这些公开契约。
- [x] Define `eventBackpressure` contract: event kind, criticality, max events/frame, max bytes/flush, queue depth, dropped/coalesced counts.
- [x] Define critical event bypass list and tests.
- [x] Define lifecycle owner taxonomy and pilot enforcement surface.
- [x] Define focus/visibility coalesced wave contract.
- [x] Define media owner collection diagnostics: active count, revoked count, retained byte estimate when available.

## Implementation / 实施

- [x] 先落公共 substrate skeleton 和 tests，不迁移业务 consumer；确认 Step 3 / Step 4 可按 stable API 复用。
- [x] Introduce bounded backpressure path for terminal/runtime non-critical output.
- [x] Preserve raw export/source path for complete terminal/runtime output where available.
- [x] Coalesce duplicate status events by kind + stable payload hash within a bounded window.
- [x] Add renderer diagnostics for backpressure queue depth, flush duration, dropped/coalesced counts.
- [x] Add owner declarations/cleanup tests for pilot listener/timer surfaces.
- [x] Migrate selected focus/visibility refresh sources into one coalesced wave.
- [x] Add media owner collection / hook for object URL users and release on unmount/replacement.
- [x] Extend `runtime-performance-evidence-gates` with backpressure/listener/media fields.

## Validation / 验证

- [x] Backpressure flush cap tests.
- [x] Critical event bypass tests.
- [x] Duplicate status coalescing tests.
- [x] Ring buffer eviction + raw export compatibility tests.
- [x] Listener owner cleanup tests for migrated pilot surfaces.
- [x] Focus wave coalescing tests.
- [x] Object URL release tests.
- [x] Diagnostics overhead/content-safety tests.
- [x] `npm run perf:realtime:boundary-guard`
- [x] `npm run perf:realtime:extended-baseline`
- [x] `npm run check:runtime-evidence-gates`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `openspec validate renderer-resource-backpressure --strict --no-interactive`
