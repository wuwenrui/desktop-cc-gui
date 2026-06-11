# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 2 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Inventory / 盘点

- [ ] Audit `services/events.ts` terminal/runtime subscriptions and current consumers.
- [ ] Audit `rendererDiagnostics.ts` heartbeat/watchdog/listener ownership and caps.
- [ ] Run listener/timer inventory for high-risk surfaces: app shell、terminal/runtime、workspace focus refresh、git/history panel、session activity、file tree。
- [ ] Identify deferred media/object URL creation sites before introducing release hooks.

## Contract / 契约设计

- [ ] Define `eventBackpressure` contract: event kind, criticality, max events/frame, max bytes/flush, queue depth, dropped/coalesced counts.
- [ ] Define critical event bypass list and tests.
- [ ] Define lifecycle owner taxonomy and pilot enforcement surface.
- [ ] Define focus/visibility coalesced wave contract.
- [ ] Define media owner collection diagnostics: active count, revoked count, retained byte estimate when available.

## Implementation / 实施

- [ ] Introduce bounded backpressure path for terminal/runtime non-critical output.
- [ ] Preserve raw export/source path for complete terminal/runtime output where available.
- [ ] Coalesce duplicate status events by kind + stable payload hash within a bounded window.
- [ ] Add renderer diagnostics for backpressure queue depth, flush duration, dropped/coalesced counts.
- [ ] Add owner declarations/cleanup tests for pilot listener/timer surfaces.
- [ ] Migrate selected focus/visibility refresh sources into one coalesced wave.
- [ ] Add media owner collection / hook for object URL users and release on unmount/replacement.
- [ ] Extend `runtime-performance-evidence-gates` with backpressure/listener/media fields.

## Validation / 验证

- [ ] Backpressure flush cap tests.
- [ ] Critical event bypass tests.
- [ ] Duplicate status coalescing tests.
- [ ] Ring buffer eviction + raw export compatibility tests.
- [ ] Listener owner cleanup tests for migrated pilot surfaces.
- [ ] Focus wave coalescing tests.
- [ ] Object URL release tests.
- [ ] Diagnostics overhead/content-safety tests.
- [ ] `npm run perf:realtime:boundary-guard`
- [ ] `npm run perf:realtime:extended-baseline`
- [ ] `npm run check:runtime-evidence-gates`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `openspec validate renderer-resource-backpressure --strict --no-interactive`
