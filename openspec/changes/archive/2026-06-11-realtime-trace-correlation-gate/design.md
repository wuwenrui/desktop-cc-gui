# Design / 设计

## Trace Milestones / 里程碑

Recommended milestone names:

- `user-send-committed`
- `runtime-process-started`
- `first-engine-delta-ingress`
- `batch-flush-start`
- `batch-flush-end`
- `reducer-commit`
- `first-visible-row-render`
- `first-visible-text-growth`
- `terminal-settlement`

## Evidence Shape / 证据结构

Per-turn summary should include ids/correlation dimensions, milestone timings, deltas, counts, max queue depth where available, and evidence class. It MUST NOT include prompt, assistant body, tool output body, or terminal content.

## Budget Candidates / 预算候选

- visible text lag P95: first delta ingress -> first visible text growth.
- batch flush duration P95.
- reducer amplification: action count / visible growth ratio or equivalent proxy.
- terminal settlement lag: last runtime activity -> terminal settled.

## Diagnostics Overhead / 诊断开销

Trace capture must be bounded and should be enabled in dev/perf builds or sampling mode. Long sessions should store summary records instead of unbounded per-delta logs.

## Classification / 证据分级

Browser/Tauri WebView timing with visible render signal can be `measured`; jsdom or fixture-only replay remains `proxy`. Reports must not upgrade proxy evidence to release-grade claims.

## Implementation / 实施

### Aggregator

- `src/features/threads/utils/turnTraceCorrelation.ts` 是单源真值，所有 `note*` 写入都走这一个模块。
- 默认启用条件：`ccgui.debug.streamLatencyTrace === "1" || "true" || "on"` 或 `ccgui.debug.turnTrace.enabled`；replay 路径通过 `__forceTurnTraceForTests(true)` 强制开启，保证 determinism。
- Bounded ring：默认 64 turns、TTL 30 分钟；`trim()` 先按 TTL 清掉再按 count 截。
- Replay 入口：`runTurnTraceReplay(events)` 在 `__forceTurnTraceForTests(true)` 下走与生产同一条 `note*` 路径，但 replay 中的 visible row/text timestamps 是 synthetic proxy；报告必须保持 `proxy`，不能升级为真实 WebView `measured`。

### Wiring 钩子

| Hook | Milestone(s) | 触发方 |
|---|---|---|
| `noteThreadTurnStarted` | `user-send-committed` | 用户发送 |
| `primeThreadStreamLatencyContext` + `noteThreadRuntimeProcessStarted` | `runtime-process-started` | engine 启动 |
| `noteThreadDeltaReceived` | `first-engine-delta-ingress` / `reducer-commit` | batcher 入口 |
| `noteRealtimeCoalescedFlush` / `noteThreadBatchFlushBoundary` | `batch-flush-start` / `batch-flush-end` | batcher flush 边界 |
| `noteThreadVisibleRender` | `first-visible-row-render` | live row 渲染 |
| `noteThreadVisibleTextRendered` | `first-visible-text-growth` | live text 增长 |
| `completeThreadStreamTurn` | `terminal-settlement` | turn 关闭 |

### Budget 接入

- `scripts/realtime-perf-report.ts --profile=extended` 写入 4 个 S-RS-VL/RA/FD/TS 行。
- `scripts/perf-aggregate.mjs` 把这 4 行汇入 `docs/perf/baseline.json`。
- `scripts/generate-runtime-evidence-report.mjs` 的 `buildRealtimeTraceBudgets(perfEvidence)` 在原 S-RS-VL/RA/FD/TS 行上做 in-place 增强（target/hardFail/reason/nextAction），并把数值带到 `## Realtime Correlation` 段落。
- Evidence class 在该路径上保持 `proxy`，因为 fixture 没有 Tauri/webview 真实 PerformanceObserver；升级到 `measured` 的口径在 `nextAction` 字段里写明。
