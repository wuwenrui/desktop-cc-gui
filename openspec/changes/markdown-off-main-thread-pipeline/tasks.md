# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 5 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Inventory / 盘点

- [ ] Audit message Markdown live/final/history paths in `Markdown.tsx`, `LiveMarkdown.tsx`, and `FullMarkdownRuntime.tsx`.
- [ ] Audit existing fast markdown worker substrate under `src/features/markdown/fastMarkdownRenderer/**`.
- [ ] Identify which message Markdown work is serializable precompute versus React/DOM-bound rich render.

## Contract / 契约设计

- [ ] Define message markdown precompute protocol: message id, content hash, renderer profile, feature flags/options hash, schema version, timeout.
- [ ] Define cache key and invalidation for content/profile/options/schema changes.
- [ ] Define threshold strategy for worker precompute versus main path.
- [ ] Define stale result guard and fallback evidence fields.
- [ ] Define unsafe HTML / sanitization boundary: worker output is not trusted rendering authority.

## Implementation / 实施

- [ ] Reuse or extend fast markdown worker adapter for message precompute where serializable.
- [ ] Add markdown precompute cache keyed by renderer profile + message id + content hash + options hash.
- [ ] Route large final messages through worker precompute when threshold is met.
- [ ] Keep small messages and unsupported worker environments on existing main path.
- [ ] Add timeout/cancellation/stale guard and safe fallback.
- [ ] Add renderer diagnostics for mode, duration, fallback reason, cache state, threshold reason, evidence class.
- [ ] Extend `runtime-performance-evidence-gates` with markdown parse/precompute fields.

## Validation / 验证

- [ ] Worker/precompute protocol success/failure/timeout tests.
- [ ] Cache hit/miss/options/schema invalidation tests.
- [ ] Stale result drop tests.
- [ ] Worker unsupported fallback tests.
- [ ] Large final message fixture diagnostics test.
- [ ] Live markdown streaming compatibility regression tests.
- [ ] Existing rich Markdown feature tests continue passing.
- [ ] `npm run perf:realtime:extended-baseline`
- [ ] `npm run check:runtime-evidence-gates`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `openspec validate markdown-off-main-thread-pipeline --strict --no-interactive`
