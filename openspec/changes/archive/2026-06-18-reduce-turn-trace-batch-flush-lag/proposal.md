## Why

v0.5.11 最新热启动实测显示，上一阶段 `MessageRow` render amplification 已经收口：completed/non-streaming rows 的 render delta 稳定为 `0`，first visible text latency 约 `177ms`，last visible text latency 约 `85ms`。但同一份 `realtime.turnTrace.summary` 仍报告 `firstDeltaToBatchFlushEndMs=21095ms`、`batchFlushDurationAvgMs=19962ms`、`batchFlushEndToReducerCommitMs=12433ms` 这类大值，和用户可见输出速度不一致。

本变更用于把下一阶段性能工作从 row render memo 调整中拆出来，专门校准 turnTrace / batch flush / reducer commit 指标链路，避免用可疑 summary 指标误判真实瓶颈。

## 目标与边界

- 目标：让 `realtime.turnTrace.summary` 的 batch flush、reducer commit、visible text growth 相关 counters 能解释最新实测现象，并能区分真实 client pipeline lag 与诊断口径偏差。
- 目标：补齐可执行测试，覆盖 visible text 多次增长、batch flush timing、terminal settlement 后 summary 的一致性。
- 目标：使性能报告脚本在遇到 summary 与 stream snapshot 明显不一致时输出明确的 caution / next action，而不是直接把大值解释为 UI 卡顿。
- 边界：仅处理 turnTrace correlation、stream latency diagnostics、runtime evidence report 相关链路。

## 非目标

- 不继续扩大 `MessagesRows.tsx` / `useFileLinkOpener.ts` 的 row render 优化范围。
- 不改变 Tauri conversation streaming IPC payload contract。
- 不引入新的 runtime dependency。
- 不把 upstream first-token delay 当作 frontend reducer/render 问题处理；例如最新实测 `sendToFirstDeltaMs=14602ms` 应继续归类到 upstream/provider/startup 侧。

## What Changes

- Modify turn trace correlation so `visibleTextGrowthCount` and first-visible-text milestone semantics are explicit: first milestone remains first growth timestamp, but counters must represent the latest observed bounded growth count.
- Audit batch flush duration semantics and separate queue wait/window duration from route work duration in tests and diagnostics labels.
- Add consistency checks between `stream-latency/*` snapshots and `realtime.turnTrace.summary` for the same turn where correlation dimensions exist.
- Update runtime evidence scripts so they preserve measured values but surface diagnostic inconsistency as a caution before recommending implementation work.
- Add focused tests for turnTrace summary consistency, especially the case where visible output is fast but terminal summary carries large batch/reducer windows.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-stream-latency-diagnostics`: clarify that turn-level summary counters and deltas must be internally consistent with stream latency snapshots before they are used as evidence for client-side batch/reducer lag.

## 技术方案选项

| Option | Approach | Trade-off |
|--------|----------|-----------|
| A. 继续优化 `MessageRow` | 在 row comparator 和 handlers 上继续加过滤条件 | 与最新事实不匹配；completed rows 已经 delta=0，继续改动收益低且可能引入 UI regression |
| B. 校准 turnTrace / batch / reducer 诊断链路 | 先修正指标语义、测试和报告 caution，再决定是否需要业务优化 | 更贴近最新证据；能防止误把诊断大值当作真实 UI 卡顿 |

选择 Option B。当前事实显示用户可见输出已经较快，异常集中在 summary 指标口径；必须先把证据链校准，再决定是否改 reducer 或 batch scheduling。

## 验收标准

- `conversation-stream-latency-diagnostics` delta spec 明确要求 summary counters 与 stream snapshot 一致性检查。
- Focused tests 覆盖：
  - first visible text milestone 只记录首次增长时间；
  - `visibleTextGrowthCount` counter 能保留最新增长次数；
  - batch flush duration 与 precise route duration 分离；
  - evidence report 对 summary/snapshot 不一致输出 caution 或 equivalent next action。
- `npx openspec validate reduce-turn-trace-batch-flush-lag --strict --no-interactive` 通过。
- 相关 TypeScript/Vitest 目标测试通过。

## Impact

- `src/features/threads/utils/turnTraceCorrelation.ts`
- `src/features/threads/utils/streamLatencyDiagnostics.ts`
- `src/features/threads/utils/turnTraceCorrelation.test.ts`
- `src/features/threads/utils/streamLatencyDiagnostics.test.ts`
- `scripts/realtime-perf-report.ts`
- `scripts/perf-realtime-runtime-report.mjs`
- `scripts/perf-v0511-runtime-evidence.ts`
- `openspec/specs/conversation-stream-latency-diagnostics/spec.md` via delta spec
