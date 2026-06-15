# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 5 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Inventory / 盘点

- [x] Audit message Markdown live/final/history paths in `Markdown.tsx`, `LiveMarkdown.tsx`, and `FullMarkdownRuntime.tsx`.
- [x] Audit existing fast markdown worker substrate under `src/features/markdown/fastMarkdownRenderer/**`.
- [x] Identify which message Markdown work is serializable precompute versus React/DOM-bound rich render.

## Contract / 契约设计

- [x] Define message markdown precompute protocol by reusing/extending `fastMarkdownRenderer` worker substrate: message id, content hash, renderer profile, feature flags/options hash, schema version, timeout.
- [x] Define cache key and invalidation for content/profile/options/schema changes.
- [x] Define threshold strategy for worker precompute versus main path.
- [x] Define stale result guard and fallback evidence fields.
- [x] Define unsafe HTML / sanitization boundary: worker output is not trusted rendering authority.

## Implementation / 实施

- [x] Reuse or extend fast markdown worker adapter for message precompute where serializable.
- [x] Add markdown precompute cache keyed by renderer profile + message id + content hash + options hash.
- [x] Route large final messages through worker precompute when threshold is met.
- [x] Keep small messages and unsupported worker environments on existing main path.
- [x] Add timeout/cancellation/stale guard and safe fallback.
- [x] Add renderer diagnostics for mode, duration, fallback reason, cache state, threshold reason, evidence class.
- [x] Extend `runtime-performance-evidence-gates` with markdown parse/precompute fields only after Step 1-4 evidence field names are merged.

## Validation / 验证

- [x] Worker/precompute protocol success/failure/timeout tests.
- [x] Cache hit/miss/options/schema invalidation tests.
- [x] Stale result drop tests.
- [x] Worker unsupported fallback tests.
- [x] Large final message fixture diagnostics test.
- [x] Live markdown streaming compatibility regression tests.
- [x] Existing rich Markdown feature tests continue passing.
- [x] `npm run perf:realtime:extended-baseline`
- [x] `npm run check:runtime-evidence-gates`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `openspec validate markdown-off-main-thread-pipeline --strict --no-interactive`
