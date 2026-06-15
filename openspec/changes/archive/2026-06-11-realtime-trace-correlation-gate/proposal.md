# realtime-trace-correlation-gate

## Summary / 摘要

建立 realtime ingress -> batch flush -> reducer commit -> first visible render -> visible text growth -> terminal settlement 的 trace correlation，并把 visible lag/render amplification 纳入 runtime performance budget gate。

## Problem / 问题

`P0-08` 指出 realtime path 已有 batching、virtualization、stream latency diagnostics、visible output stall detection，但 runtime evidence 仍缺少端到端关联。当前 `S-RS-FT` first token latency 在 fixture baseline 中为 `5000 ms`，visible lag risk 仍为 high。

没有 correlation 时，慢体验会被混成一个结果：无法区分 upstream first-token delay、backend forwarding stall、frontend batching/reducer 放大、React render lag、terminal pressure 或 scroll anchoring 问题。

## Goals / 目标

- 每个 turn 建立稳定 trace id，贯穿 runtime ingress、batcher、reducer、visible render、terminal settlement。
- 采集关键 timestamps：send committed、runtime started、first delta ingress、batch flush、reducer commit、first visible row、first visible text growth、terminal settlement。
- 增加 P95 budgets：visible text lag、render amplification、batch flush duration、terminal settlement lag。
- 将 evidence 写入 bounded diagnostics/perf artifacts，不记录 prompt、assistant body、terminal content。
- 更新 runtime evidence gates，让 realtime visible lag 从 proxy 走向 measured evidence。

## Non-Goals / 非目标

- 不重写 realtime batcher 或 virtualization 架构。
- 不改变 provider wire protocol 或 Tauri command payload。
- 不把所有 diagnostics 永久上报；本 change 只定义 bounded local/dev/perf evidence。
- 不为降低数字牺牲 scroll anchoring 或 message correctness。

## Approach / 方案

1. 定义 `turnTraceId` 和 correlation dimensions：workspaceId、threadId、engine、provider、model、platform。
2. 在 event ingress、batch flush、reducer commit、render-visible hook、terminal settlement 记录 bounded milestones。
3. 聚合为 per-turn trace summary，避免事件无限增长。
4. 将 trace summary 接入 `scripts/realtime-perf-report.ts` 或现有 runtime evidence artifact。
5. 增加 budget gate：visible text lag P95、render amplification、flush cost、terminal settlement lag。
6. 增加 long live assistant text + reasoning + tool blocks regression scenario。

## Risks / 风险

- diagnostics 本身可能造成 overhead，必须 bounded、sampled 或 dev/perf gated。
- React visible render timing 不一定在 jsdom 中可靠，需要明确 `measured` vs `proxy` evidence class。
- terminal pressure 和 frontend render lag 的 correlation 只能在 evidence surfaced 时成立，不能从单侧数据过度推断。

## Acceptance Criteria / 验收口径

- Realtime perf report 能按 turn 输出 correlated milestone summary。
- `runtime-evidence-gates.md` 可区分 measured/proxy/manual-only/unsupported realtime visible lag evidence。
- Long streaming scenario 保持 progressive reveal、scroll anchoring、reasoning/tool blocks 可见性。
- Diagnostics payload 不包含 prompt text、assistant output body 或 terminal output content。

## Validation / 验证

- Focused realtime batcher / diagnostics tests。
- `npm run perf:realtime:report`
- `npm run perf:realtime:boundary-guard`
- `npm run typecheck`
- `npm run lint`
- `openspec validate realtime-trace-correlation-gate --strict --no-interactive`

## Implementation Outcomes / 实施落点

落地后，turn-trace correlation 走两条独立的观测路径，都把 milestone 数据汇入同一个 bounded aggregator：

### 1. 实时路径 / runtime path

- `src/features/threads/utils/turnTraceCorrelation.ts`：bounded per-turn trace 聚合器，9 个 milestone，3 个 evidence class，per-turn summary 在 dev/perf gate 内通过 `ccgui.debug.streamLatencyTrace` 或 `ccgui.debug.turnTrace.enabled` 启用。
- `src/features/threads/utils/streamLatencyDiagnostics.ts`：在 `noteThreadTurnStarted` / `noteThreadDeltaReceived` / `noteThreadVisibleRender` / `noteThreadVisibleTextRendered` / `completeThreadStreamTurn` / `noteRealtimeCoalescedFlush` 六个钩子上写 trace milestone。
- `noteThreadBatchFlushBoundary(input)`：batcher 端点由 `noteRealtimeCoalescedFlush` 自动调用，刷新 `batch-flush-start` / `batch-flush-end`。
- 所有 milestone 写入 `appendRendererDiagnostic("realtime.turnTrace.summary", ...)`，payload 中**不包含** prompt / assistant body / tool body / terminal body。

### 2. 离线路径 / replay path

- `src/features/threads/contracts/realtimeTurnTraceReplay.ts`：基于同一 `RealtimeReplayEvent` 流合成 milestone 序列，输出 4 个 P95/median 预算（visible text lag P95、reducer amplification median、batch flush duration P95、terminal settlement P95），并把 per-turn 摘要落到 `docs/perf/realtime-turn-trace.json`；replay visible milestones 是 synthetic proxy，不能标为真实 WebView `measured`。
- `scripts/realtime-perf-report.ts` --profile=extended：把 4 个新预算作为 `S-RS-VL/RA/FD/TS` 加入 `docs/perf/realtime-extended-baseline.json`。
- `scripts/generate-runtime-evidence-report.mjs`：`buildRealtimeTraceBudgets(perfEvidence)` 对 baseline 中这 4 个 scenario 的行做 in-place 增强（target / hardFail / reason / nextAction），并在 `## Realtime Correlation` 段落把数值带到 markdown 报告。
- `runtime-evidence-gates.md` 会区分 measured/proxy/manual-only/unsupported，**目前 4 个新预算都被分类为 proxy**，因为 replay 路径无法提供 webview PerformanceObserver 真实值；未来 wire PerformanceObserver 后再升级到 measured。

### 边界保证

- `src/features/threads/contracts/realtimeTurnTraceReplay.guard.test.ts`：3 个 guard test，确保 trace correlation 不会扰动 reducer semantic hash、不会在长 live streaming 场景丢失 text/reasoning/tool 计数、不会泄露 prompt/assistant/tool/terminal 文本到 summary。
- `src/features/threads/contracts/realtimeBoundaryGuard.test.ts`：原有 batcher 边界 guard test 继续通过；turn-trace replay 不会改变 baseline/optimized 的 semanticsHash。
- 现有 `streamLatencyDiagnostics.test.ts`（29 个测试）继续通过，证明 wiring 未破坏既有流式延迟分类。

### Evidence Class 规则

- `measured`：first-engine-delta-ingress + first-visible-row-render + first-visible-text-growth 三个里程碑都由真实 runtime/WebView timing 在同一 clock domain（performance.now）下记录。replay fixture 即使合成了 visible milestones，也必须保持 `proxy`。
- `proxy`：ingress 已记录但 visible render 里程碑缺失（jsdom/replay 无真实 DOM 渲染信号）。
- `manual-only`：send / runtime started 存在但 ingress 缺失。
- `unsupported`：所有路径都没跑过。
