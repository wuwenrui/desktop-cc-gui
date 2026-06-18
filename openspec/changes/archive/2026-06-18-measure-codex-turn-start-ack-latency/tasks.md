## 1. Diagnostics

- [x] 1.1 Add content-safe `stream-latency/codex-turn-start-ack` diagnostic around `send_user_message`.
- [x] 1.2 Emit the diagnostic on success and error without changing invoke behavior.

## 2. Report

- [x] 2.1 Add `turnStartAckLatencyP95` from the new diagnostic label.
- [x] 2.2 Add note comparing first-delta latency with turn-start ack latency when both are measured.

## 3. Validation

- [x] 3.1 Run OpenSpec validate.
- [x] 3.2 Run service/report tests.
- [x] 3.3 Run typecheck, lint, and diff check.
