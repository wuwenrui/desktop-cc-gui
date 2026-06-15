# markdown-off-main-thread-pipeline

## Why

roadmap `P1-04 大 Markdown 离主线程解析` 的真实背景是：P0 `lazy-markdown-runtime` 已经把 `react-markdown` / remark / rehype full runtime 放到 lazy boundary，live streaming 也已有 lightweight path，但 final rich Markdown 仍可能在主线程执行高成本 segmentation、math detection、tool-call parsing、rich runtime render scheduling。仓库同时已经存在 `src/features/markdown/fastMarkdownRenderer/fastMarkdown.worker.ts`、`workerAdapter.ts`、`FileMarkdownFastPreview` 和 `FullMarkdownRuntime.tsx`。因此本 change 不应从零造 worker，也不应承诺在 worker 里执行 ReactMarkdown/DOM 渲染；合理目标是复用现有 worker substrate，把可 worker 化的 heavy precompute/fast compile 移出主线程，并为 rich render 建立 threshold、cache、stale guard、fallback 和 evidence。代码实现可提前研究，但 evidence gate 字段必须等 Step 1-4 的字段命名稳定后再落。

## Code Facts / 现状事实

- `src/features/messages/components/Markdown.tsx` lazy-loads `FullMarkdownRuntime` and uses `LightweightMarkdown` for live/progressive behavior.
- `src/features/messages/components/FullMarkdownRuntime.tsx` still renders ReactMarkdown with `remark-gfm` / `remark-math` / `remarkFileLinks` / `rehype-raw` / `rehype-sanitize` / optional KaTeX on the main React render path.
- `src/features/markdown/fastMarkdownRenderer/workerAdapter.ts` already implements shared worker creation, request ids, fallback to main-thread `compileFastMarkdown`, and stale-capable request ids for file preview usage.
- Existing `message-markdown-streaming-compatibility` spec requires incomplete live streams to avoid full parser execution for every fragment and completed messages to converge with history restore.

## Problem / 问题

- Large completed assistant messages can still trigger main-thread work before or during rich Markdown rendering.
- Worker substrate exists for file preview fast markdown, but message final rendering does not have a clear off-main-thread precompute / cache / evidence contract.
- Stale async results can appear when a message changes while background parsing/precompute is still running.
- Worker failure or unsupported environments need safe fallback without breaking final readable Markdown.

## Goals / 目标

- Define a message Markdown parse/precompute pipeline with thresholds, source version, content hash, timeout, cancellation/stale guard, and diagnostics.
- Reuse existing fast markdown worker substrate where possible for heavy non-React work: block scan, heading/heavy-block metadata, safe fast HTML/segments, content hash, or other serializable precompute.
- Keep full rich ReactMarkdown rendering on the main React path when rich features require React components, but schedule it behind lazy boundary / transition / fallback as appropriate.
- Cache parse/precompute results by `rendererProfile + messageId + contentHash + optionsHash`.
- Preserve live lightweight path and existing final/history convergence requirements.
- Feed markdown parse/precompute mode, duration, fallback reason, cache state, and evidence class into `runtime-performance-evidence-gates`.

## Non-Goals / 非目标

- 不替换 `react-markdown` / remark / rehype / KaTeX / Mermaid 选型。
- 不在 worker 中执行 React component rendering、DOM mutation、Tauri API 或 unsafe HTML rendering。
- 不改变 live streaming progressive reveal / lightweight renderer 语义。
- 不把 file preview fast renderer 与 message renderer 强行合并成一个视觉实现。

## Delivery Boundaries / 交付边界

1. **Audit current pipeline**：确认 message live/final/history restore paths and file-preview worker capabilities。
2. **Protocol reuse**：扩展或复用 fast markdown worker message protocol，只传 serializable inputs/outputs。
3. **Threshold/cache/stale guard**：大 final message 才走 worker precompute；小消息保持 main path，避免 worker startup overhead。
4. **Rich render fallback**：worker unsupported/timeout/error 时回到 existing main-thread render，并记录 fallback evidence。
5. **Evidence gate hold**：代码可以先接 worker/cache/stale guard；`runtime-performance-evidence-gates` 字段必须等 Step 1-4 合入后一次性追加，避免字段命名漂移和文档冲突。

## Initial Budgets / 初始预算

- Worker precompute threshold SHOULD start at `>= 10_000` characters or equivalent heavy-block/math/tool-call complexity trigger; exact threshold may be tuned by evidence.
- Worker timeout target `<= 2_000ms`; timeout falls back to main path with `fallbackReason=timeout`.
- Cache key MUST include message id, content hash, renderer profile, feature flags/options hash, and schema version.
- Diagnostics MUST NOT include markdown body content; content hash and length/counts are allowed.

## Risks / 风险

- Worker output must be serializable and sanitized on the correct side; unsafe HTML must not be trusted because it came from a worker.
- If cache key omits renderer options, stale or wrong markdown structure can appear after feature flag/theme/profile changes.
- Worker fallback to main thread is safe functionally but may still be slow; evidence must classify this honestly.
- Final rich render still uses React on main thread for React components; this change reduces precompute pressure but is not a promise that every rich render cost leaves the main thread.

## Acceptance Criteria / 验收口径

- Large final message path has documented threshold, cache key, stale guard, timeout, and fallback behavior.
- Worker/precompute results never replace newer message content; stale results are dropped by source version/content hash.
- Worker failure/unsupported/timeout falls back to readable final Markdown and records fallback evidence.
- Live streaming path remains on lightweight/progressive behavior and does not load full parser for every partial fragment.
- `runtime-performance-evidence-gates` outputs markdown parse/precompute budget fields with accurate evidence class.

## Validation / 验证

- Worker/precompute protocol tests for success, timeout, failure, unsupported worker, and stale result.
- Cache tests for hit/miss/options hash/schema version invalidation.
- Live path regression tests from `message-markdown-streaming-compatibility`.
- Large final message fixture test with content-safe diagnostics.
- Existing Markdown rich feature tests: file links, math, code blocks, tool-call fallback.
- `npm run perf:realtime:extended-baseline`
- `npm run check:runtime-evidence-gates`
- `npm run typecheck`
- `npm run lint`
- `openspec validate markdown-off-main-thread-pipeline --strict --no-interactive`

## Execution Order / 执行顺序

- **Position**: Step 5 of 5（串行链最末）
- **Predecessors**（软依赖，本 change 可较早启动，但**正式落 evidence gate 字段时必须等**）:
  - Step 1 `composer-and-message-row-render-budget` —— `runtime-performance-evidence-gates` 字段 schema 已就位（避免本 change 新增字段时与 composer / messages 字段命名冲突）。
  - Step 2 `renderer-resource-backpressure` —— `eventBackpressure` 抽象已就位（worker 主线程 fallback 通知可复用此抽象）。
  - Step 3 `backend-io-cache-and-bridge-payload-budget` —— 后端 timing 透出到 frontend perf report 协议已就位（本 change 的 parse duration 复用此协议）。
  - Step 4 `workspace-tree-and-large-file-listing-budget` —— per-workspace shared file index 已就位（`FileMarkdownFastPreview` 可受益，但不是硬依赖）。
- **Successors**: 无（串行链终点）。
- **Reused Artifacts / 本 change 必须复用**:
  1. `rendererDiagnostics` 字段命名（`messages.markdown.parse.*`）—— 与 Step 1 / 2 / 3 / 4 前缀对齐。
  2. `eventBackpressure` 抽象 —— worker 启动失败 / stale / cancellation 通知复用（如果本 change 决定走 `eventBackpressure`）。
  3. `runtime-performance-evidence-gates` 已有字段的命名风格 —— 新增 `markdown.parse.*` 字段保持一致。
- **Required Public Artifacts / 本 change 必须对外暴露**:
  1. **`markdownParseWorker` 协议**（`{ messageId, contentHash, source, options }` → serializable precompute result + `{ durationMs, parseMode, evidence }`）—— 复用或扩展现有 `fastMarkdownRenderer` worker substrate，不另造平行 worker。
  2. **`markdownParseCache` 抽象**（`{ get, set, invalidate }`，键 = `rendererProfile + messageId + contentHash + optionsHash + schemaVersion`）—— 独立可复用。
  3. `runtime-performance-evidence-gates` 新增 `markdown.parse.*` 字段。
- **Cross-Change Constraint**: 本 change 是串行链终点，启动时间可早于 Step 4，但任何对 `runtime-performance-evidence-gates.json` / `runtime-performance-evidence-gates.md` 的写入必须**等 Step 1-4 全部合并后再批量追加**，避免 gate 文档被两个分支同时改。
- **Parallelism Note**: 本 change 的代码实现（worker / cache / fallback）可与 Step 3 / Step 4 并行开发在独立 worktree；只需在最后合并 evidence gate 文档时串行落盘。
- **Blocking Rule**: 前 4 个 change 全部 `openspec validate` 通过 + commit 合入前，本 change 不应提交 evidence gate 文档变更。
