## Context

Current runtime evidence can say:

- user send to first delta: `sendToFirstDeltaMs`
- first delta to visible text: `firstDeltaToFirstVisibleTextMs`
- app-server emit to renderer: `appServerEventRouteDurationAvgMs`

It cannot yet say how much of `sendToFirstDeltaMs` was spent waiting for backend `turn/start` acknowledgement.

## Goals / Non-Goals

**Goals:**

- Record frontend-side `send_user_message` invoke duration as Codex turn-start ack latency.
- Keep the diagnostic content-safe: no prompt text, no assistant text, no tool output.
- Report the ack latency separately from first-delta and visible latency.

**Non-Goals:**

- No backend protocol changes.
- No provider request optimization.
- No streaming reducer or MessageRow changes.

## Decisions

- Add the diagnostic in `src/services/tauri.ts::sendUserMessage`, because this service is the narrow Codex `send_user_message` boundary and already has workspace/thread/model dimensions.
- Emit on both success and error so timeout/failure cases remain visible.
- Add an append-only metric to `perf-realtime-runtime-report.mjs`.

## Risks / Trade-offs

- [Risk] Service-layer diagnostic lacks provider profile id. -> Mitigation: it still carries workspace/thread/model; provider details remain available from turnTrace summary when primed.
- [Risk] Ack latency does not distinguish backend request queue from app-server turn/start processing. -> Mitigation: this is still a useful split before deeper backend instrumentation.
