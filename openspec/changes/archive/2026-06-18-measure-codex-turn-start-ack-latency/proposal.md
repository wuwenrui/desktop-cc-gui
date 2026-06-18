## Why

上一阶段已经把 Codex/MiniMax first-delta latency 独立成 `firstDeltaLatencyP95`，最新证据为 `14602ms`，同时 visible lag 与 reducer amplification 均健康。为了继续定位 first-delta 前的大头，需要把 frontend `send_user_message` invoke 到 backend `turn/start` ack 的耗时拆出来。

## What Changes

- Add a bounded renderer diagnostic for Codex `send_user_message` turn-start acknowledgement latency.
- Extend realtime runtime report with `turnStartAckLatencyP95`.
- Add report notes that compare first-delta latency with turn-start ack latency so the remaining wait can be attributed to post-ack provider/startup phase investigation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-realtime-client-performance`: realtime evidence must distinguish turn-start ack latency from first-delta latency.
- `conversation-stream-latency-diagnostics`: Codex first-delta diagnostics must keep bounded turn-start ack evidence without including prompt or assistant text.

## Impact

- `src/services/tauri.ts`
- `src/services/tauri.test.ts`
- `scripts/perf-realtime-runtime-report.mjs`
- `scripts/perf-realtime-runtime-report.test.mjs`
