## Context

当前 v0.5.11 性能证据链已经完成两轮收敛：

- `MessageRow` completed rows render delta 已稳定为 `0`
- fresh turn `visibleTextGrowthCount=61`
- `reducerAmplification=1`
- `visibleTextLagP95=177ms`
- `batchFlushDurationP95=0.17ms`

剩余明显波动集中在 first-delta 前：

- old turn: `sendToFirstDeltaMs=14602`
- fresh turn: `sendToFirstDeltaMs=1272`

现有 `turnTraceCorrelation.ts` 已经计算 `sendToFirstDeltaMs`，但 `scripts/perf-realtime-runtime-report.mjs` 没有把它输出为独立 metric。结果是报告能说明 visible/reducer 健康，却不能直接把下一步指向 upstream/provider/startup phase。

## Goals / Non-Goals

**Goals:**

- 将 `sendToFirstDeltaMs` 输出为 release evidence fragment 中的 first-delta latency metric。
- 当 first-delta latency 主导但 visible/reducer 健康时，报告 notes 明确提示 upstream/provider/startup phase investigation。
- 保持 measured values content-safe：只输出 ids、durations、counters、dimensions，不输出 prompt/assistant body/tool output。

**Non-Goals:**

- 不改 Codex provider request path。
- 不改 Tauri IPC payload。
- 不改 reducer、batcher、MessageRow。
- 不处理 hidden-window `document` ReferenceError。

## Decisions

### Decision 1: Add report-level metric before provider optimization

选择：先在 `perf-realtime-runtime-report.mjs` 输出 first-delta metric。

备选：

- 直接优化 provider/runtime startup：缺少 phase breakdown，可能误改。
- 只靠手工观察 `sendToFirstDeltaMs`：不可沉淀到 release evidence gate。

取舍：report-level metric 是最小变更，可以把后续优化建立在稳定证据上。

### Decision 2: Use existing turnTrace summary as source

`turnTraceCorrelation.ts` 已经在同一 clock domain 里记录：

- `user-send-committed`
- `first-engine-delta-ingress`
- `deltas.sendToFirstDeltaMs`

因此本阶段不新增 runtime event，只消费已有 summary 字段。这样避免扩大热路径写入量。

### Decision 3: Notes explain dominance, metrics remain separate

first-delta metric 不应替代 visible lag、reducer amplification、batch route duration、terminal settlement。报告只在 notes 中说明“first-delta dominates”，并给出 next action。

## Risks / Trade-offs

- [Risk] P95 with few samples may overstate variability. → Mitigation：notes include measured summary count and source path; future multi-turn sampling can improve confidence.
- [Risk] `sendToFirstDeltaMs` still cannot distinguish provider network vs runtime process startup. → Mitigation：next action explicitly says upstream/provider/startup phase investigation, not final root cause.
- [Risk] Adding a metric may require downstream report consumers to handle a new key. → Mitigation：appenditive JSON metric, no existing field removal.

## Migration Plan

1. Add focused tests for first-delta metric and dominance note.
2. Update `perf-realtime-runtime-report.mjs` to emit `firstDeltaLatencyP95`.
3. Run OpenSpec validate, script tests, typecheck, lint, diff check.
4. Re-run report generation against fresh `.artifacts/realtime-runtime-diagnostics.json` and confirm the new metric reports `14602ms`/`1272ms` sample set correctly.
