## 1. Backend Timing

- [x] 1.1 Add bounded per-thread Codex turn timing state around `turn/start`.
- [x] 1.2 Enrich Codex app-server event params with content-safe `ccguiTiming`.
- [x] 1.3 Clear timing state on terminal turn events.
- [x] 1.4 Split first runtime/reasoning/tool activity from non-empty assistant first text timing.
- [x] 1.5 Split first assistant item lifecycle timing from first assistant text delta timing.

## 2. Renderer Diagnostics

- [x] 2.1 Extend `noteThreadAppServerEventReceived` to preserve Codex backend phase fields.
- [x] 2.2 Add tests for content-safe backend timing diagnostics and malformed field normalization.
- [x] 2.3 Preserve bounded pre-first-text event counters and method names in renderer diagnostics.
- [x] 2.4 Preserve `realtime.turnTrace.summary` and `stream-latency/*` diagnostics in independent bounded buckets.

## 3. Report

- [x] 3.1 Add `codexPostAckFirstDeltaP95` from `stream-latency/app-server-event`.
- [x] 3.2 Add comparison notes across first-delta, turn-start ack, and post-ack first-delta wait.
- [x] 3.3 Add `codexPostAckFirstRuntimeEventP95` and `codexFirstRuntimeEventToFirstTextDeltaP95`.
- [x] 3.4 Add assistant item phase report metrics when timing fields are available.
- [x] 3.5 Add provider/model first-response dominance notes when assistant item startup accounts for the post-runtime wait.

## 4. Validation

- [x] 4.1 Run OpenSpec validate.
- [x] 4.2 Run focused Rust, Vitest, and Node report tests.
- [x] 4.3 Run typecheck, lint, and diff check.
- [x] 4.4 Add retention and dominance regression tests.
