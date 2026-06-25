## Why

v0.5.11 最新两轮 Codex/MiniMax streaming 实测显示，client visible output path 已经稳定：两轮 `firstDeltaToFirstVisibleTextMs=177ms`，`reducerAmplification=1`。但 first-delta 等待波动明显：旧 turn `sendToFirstDeltaMs=14602ms`，fresh turn `sendToFirstDeltaMs=1272ms`。

本变更用于补齐 Codex first-delta / upstream startup latency 的可观测性，避免继续把 first-token 等待误归因到 row render、batch flush 或 reducer。

## 目标与边界

- 目标：在 Codex/MiniMax streaming turn 中明确记录 first-delta 等待阶段的 evidence，包括 turn start、first-delta warning、first delta arrival、engine/provider/model dimensions。
- 目标：让 runtime evidence report 把 `sendToFirstDeltaMs` 作为 first-delta latency 指标输出，并和 visible text latency、reducer amplification 分开解释。
- 目标：当 first-delta 慢但 visible output / reducer 正常时，报告必须把 next action 指向 upstream/provider/startup phase investigation，而不是 client render optimization。
- 边界：只补前端 diagnostics/reporting；不改 provider API、runtime process lifecycle、Tauri command payload。

## 非目标

- 不直接优化 MiniMax/Codex provider 请求耗时。
- 不改变 streaming event ordering。
- 不改变 batch flush/reducer/MessageRow 行为。
- 不处理 hidden-window Vite dependency `ReferenceError: Can't find variable: document`，该问题单独作为稳定性 bug。

## What Changes

- Extend runtime evidence reporting to include measured first-delta latency from `realtime.turnTrace.summary.deltas.sendToFirstDeltaMs`.
- Add report notes/next action for turns where first-delta latency dominates while visible text latency and reducer amplification remain healthy.
- Add tests using synthetic diagnostics matching the observed shape:
  - slow first delta: `sendToFirstDeltaMs=14602`, visible latency `177`, reducer amplification `1`
  - normal first delta: `sendToFirstDeltaMs=1272`, visible latency `177`, reducer amplification `1`
- Preserve existing `stream-latency/upstream-pending` and `waiting-for-first-delta` diagnostics; do not introduce unbounded payloads.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-realtime-client-performance`: realtime evidence must report first-delta latency separately from visible lag and reducer amplification.
- `conversation-stream-latency-diagnostics`: upstream/first-delta diagnostics must keep Codex/provider dimensions and avoid classifying first-delta wait as client render lag.

## 技术方案选项

| Option | Approach | Trade-off |
|--------|----------|-----------|
| A. 直接优化 provider/runtime startup | 先改 Codex startup 或 provider request path | 当前只有前端 summary 证据，缺少 phase breakdown；容易误修 |
| B. 补 runtime evidence first-delta 指标和分类 | 先把 `sendToFirstDeltaMs` 纳入报告，并和 visible/reducer 指标分离 | 成本低、风险低，能指导下一步是否进入 provider/runtime 层 |

选择 Option B。当前事实证明 UI 可见链路稳定，先让报告明确“first-delta wait dominates”才是最小正确动作。

## 验收标准

- Runtime evidence report 输出 measured `firstDeltaLatencyP95` 或等价指标，来源为 `realtime.turnTrace.summary.deltas.sendToFirstDeltaMs`。
- 当 `sendToFirstDeltaMs` 明显高于 visible latency 且 `reducerAmplification<=1` 时，报告 notes 必须提示 upstream/provider/startup investigation。
- Focused report tests 覆盖 slow 和 normal first-delta 样本。
- `npx openspec validate measure-codex-first-delta-latency --strict --no-interactive` 通过。
- 相关 script tests、TypeScript/lint/diff check 通过。

## Impact

- `scripts/perf-realtime-runtime-report.mjs`
- `scripts/perf-realtime-runtime-report.test.mjs`
- `scripts/realtime-perf-report.ts` if aggregate report display needs the new metric
- `openspec/specs/conversation-realtime-client-performance/spec.md` via delta spec
- `openspec/specs/conversation-stream-latency-diagnostics/spec.md` via delta spec
