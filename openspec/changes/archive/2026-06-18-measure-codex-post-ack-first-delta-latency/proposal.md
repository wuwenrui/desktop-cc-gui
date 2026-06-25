## Why

上一轮真实热启动证据显示 `turnStartAckLatencyP95=114ms`，但 `firstDeltaLatencyP95=3616ms`，`postAckFirstDeltaWaitApprox=3502ms`。这证明当前瓶颈不在 frontend render，也不在 frontend -> backend `send_user_message` ack，而在 backend ack 之后到 first delta 之前。

## 目标与边界

- 目标：把 Codex `turn/start` response ack、backend stdout event ingress、first text delta ingress、backend emit、renderer receive 之间的阶段时间拆出来。
- 边界：只增加 content-safe diagnostics 与 report 聚合，不优化 provider、不改 Codex protocol、不改 provider routing。

## 非目标

- 不修改 `turn/start` request payload 语义。
- 不改变 managed/disk provider runtime selection。
- 不把 prompt、assistant text、tool output、terminal output 或 file content 写入 diagnostics。

## What Changes

- Attach bounded `ccguiTiming` metadata to Codex app-server events emitted by Rust backend.
- Capture backend-side timestamps for `turn/start` ack, stdout ingress, first stream event, first text delta, and app-server emit.
- Extend renderer/runtime evidence report with post-ack first-delta phase metrics.
- Add focused Rust, Vitest, and Node report tests.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-realtime-client-performance`: realtime evidence must distinguish post-ack first-delta wait from frontend ack and render waits.
- `conversation-stream-latency-diagnostics`: stream latency diagnostics must preserve content-safe backend phase timing for Codex.

## 技术方案取舍

| Option | 方案 | 取舍 |
|---|---|---|
| A | 新增 Tauri command 查询 backend timing buffer | 需要跨 command 状态与 lifecycle 管理，容易引入 drift；不选 |
| B | 复用 app-server event `params.ccguiTiming` metadata | 已有 frontend parser 与 diagnostics 通道，和事件天然同生命周期；选择 |
| C | 直接写 backend log | 不能进入 renderer diagnostics/report 自动证据链，且难以按 turn 聚合；不选 |

## 验收标准

- 新 report 能输出 `codexPostAckFirstDeltaP95` 或明确 unsupported reason。
- 对同一 turn，report 能保留 `turnStartAckLatencyP95`、`firstDeltaLatencyP95`、`codexPostAckFirstDeltaP95` 的对比 note。
- Diagnostics content-safe，只包含 ids、method、timestamps、durations、counts 和 bounded labels。
- Focused tests、typecheck、lint、Rust targeted tests、OpenSpec strict validate 通过。

## Impact

- `src-tauri/src/backend/app_server.rs`
- `src-tauri/src/backend/app_server_runtime_lifecycle.rs`
- `src-tauri/src/backend/app_server_event_helpers.rs`
- `src-tauri/src/backend/app_server_tests.rs`
- `src/features/threads/utils/streamLatencyDiagnostics.ts`
- `src/features/threads/utils/streamLatencyDiagnostics.test.ts`
- `scripts/perf-realtime-runtime-report.mjs`
- `scripts/perf-realtime-runtime-report.test.mjs`
