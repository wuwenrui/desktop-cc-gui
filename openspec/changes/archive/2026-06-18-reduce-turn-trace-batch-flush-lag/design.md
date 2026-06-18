## Context

上一阶段 `reduce-message-row-render-amplification` 已经把 completed/non-streaming rows 的重复渲染压住。最新热启动实测中，用户可见输出延迟并不高：

- `firstDeltaToFirstVisibleTextMs=177`
- `lastVisibleTextAfterDeltaMs=85`
- `lastRenderLagMs=117`
- recent completed rows render delta = `0`

但同一 turn 的 `realtime.turnTrace.summary` 仍出现大窗口：

- `firstDeltaToBatchFlushEndMs=21095`
- `batchFlushDurationAvgMs=19962`
- `batchFlushEndToReducerCommitMs=12433`

这说明当前问题不是“继续证明 row render 卡”，而是 turnTrace summary 和 stream latency snapshot 的解释关系不够强。现有 `conversation-stream-latency-diagnostics` 已要求 correlated evidence，但没有要求 report 层在 summary/snapshot 冲突时降级结论。

## Goals / Non-Goals

**Goals:**

- 校准 `realtime.turnTrace.summary` 的 counters / deltas 语义，使其能解释 visible stream evidence。
- 保持 first visible text milestone 表示首次增长时间，同时让 `visibleTextGrowthCount` counter 反映最新 bounded growth count。
- 在 report 层加入 consistency caution：当可见输出快但 summary batch/reducer 大值异常时，不直接宣称 client batch/reducer lag。
- 用 focused tests 锁定 batch duration、route duration、reducer amplification、visible text growth counter 的口径。

**Non-Goals:**

- 不继续修改 `MessagesRows.tsx` 的 memo comparator。
- 不改变 Tauri IPC payload contract。
- 不引入新依赖。
- 不把 upstream first-token delay 纳入本阶段优化；例如 `sendToFirstDeltaMs=14602` 继续作为 upstream/provider/startup 侧事实。

## Decisions

### Decision 1: Treat this as diagnostics correctness before runtime optimization

选择：先修正 evidence interpretation 和 summary consistency，再判断是否改 reducer/batching。

备选方案：

- 继续优化 row render：被最新 completed row delta=0 事实否定，收益低。
- 直接改 reducer batching：风险高，且当前可见输出 latency 不支持这是首要瓶颈。

取舍：诊断链路校准成本低、回滚简单，并且能避免后续性能任务基于错误证据实施。

### Decision 2: Preserve first milestone semantics, update counter semantics

`turnTraceCorrelation.ts` 目前通过 `recordMilestone(..., "first-visible-text-growth")` 存储首次 visible text growth timestamp。这个语义应该保留，因为 `firstDeltaToFirstVisibleTextMs` 依赖它。

但 `counters.visibleTextGrowthCount` 必须表达最新 growth count，而不是只在首次 render 时写入。实现方向：

- `streamLatencyDiagnostics.noteThreadVisibleTextRendered(...)` 在每次 visible text length 增长时都可以通知 turn trace counter。
- `turnTraceCorrelation.recordMilestone(...)` 对 `first-visible-text-growth` 继续保留首次 timestamp。
- counter patch 每次都允许更新 `visibleTextGrowthCount`，以保持 summary 和 snapshot 一致。

### Decision 3: Report large batch/reducer values as caution unless visible evidence corroborates

runtime evidence scripts 应保留原始 measured values，但在出现下列组合时输出 caution：

- stream snapshot 显示 visible output latency under threshold；
- completed/non-streaming rows 没有 render amplification；
- turn summary 的 batch/reducer window 很大；
- summary `visibleTextGrowthCount` 与 stream snapshot count 不一致或缺失。

这样报告不会丢证据，也不会把证据解释过度。

## Risks / Trade-offs

- [Risk] Counter 更新频率增加可能增加极小 runtime overhead。→ Mitigation：只在已有 visible text growth 路径上写 bounded numeric counter，不写 body text，不新增 unbounded payload。
- [Risk] Report caution 可能让 release gate 更保守。→ Mitigation：保留 measured values，并把 caution 绑定到明确不一致条件，不 blanket downgrade。
- [Risk] 不直接改 reducer 可能推迟真实 reducer bug 修复。→ Mitigation：如果 consistency tests 证明 summary 大值真实且可见 evidence corroborates，再进入 reducer/batch implementation task。

## Migration Plan

1. 更新 delta spec，增加 summary/snapshot consistency requirement。
2. 补 focused tests：
   - `turnTraceCorrelation.test.ts`
   - `streamLatencyDiagnostics.test.ts`
   - runtime evidence report script tests
3. 实现最小代码改动：
   - visible text growth counter 每次增长同步给 turnTrace；
   - report 层识别 summary/snapshot inconsistency 并输出 caution。
4. 运行 OpenSpec strict validate、TypeScript、lint、focused Vitest。

Rollback：本阶段只改 diagnostics/reporting；若出现问题，可回退 counter notification 和 report caution，不影响 conversation streaming IPC。
