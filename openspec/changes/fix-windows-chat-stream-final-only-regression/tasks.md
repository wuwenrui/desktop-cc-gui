## 1. Backend Regression Guards

- [x] 1.1 Add a Claude fake-process test that emits a text delta, waits, then completes; verify the first `TextDelta` reaches subscribers before process exit. Input: fake CLI stdout lines. Output: failing guard if backend buffers until EOF. Validation: focused Claude Rust test.
- [x] 1.2 Add Codex backend timing tests for canonical and legacy text-delta aliases. Input: JSON-RPC app-server events. Output: `ccguiTiming.firstTextDelta*` populated only for supported non-empty delta methods. Validation: focused app_server Rust test.
- [x] 1.3 Add Codex final-only regression coverage. Input: reasoning/tool/lifecycle plus terminal completion without text-delta method. Output: no `firstTextDeltaReceivedAtMs` on terminal event. Validation: focused app_server Rust test.

## 2. Minimal Implementation

- [x] 2.1 Update Codex backend timing helper to share one bounded method recognizer for supported assistant text delta aliases. Depends on 1.2. Validation: app_server tests.
- [x] 2.2 Preserve Claude platform pacing behavior with no code change unless the new test exposes a real buffering bug. Depends on 1.1. Validation: Claude tests confirm Windows batching and non-Windows immediate flushing.

## 3. Verification

- [x] 3.1 Run `cargo test --manifest-path src-tauri/Cargo.toml claude`.
- [x] 3.2 Run focused Codex app-server Rust tests.
- [x] 3.3 Run `openspec validate fix-windows-chat-stream-final-only-regression --strict --no-interactive`.
