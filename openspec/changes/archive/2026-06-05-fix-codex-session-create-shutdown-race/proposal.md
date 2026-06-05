## Why

Codex create-session can race with runtime shutdown: a runtime may look reusable when the user starts a new session, then enter manual-shutdown/runtime-ended before `thread/start` completes. The codebase already contains guarded retry logic for this path, but the Trellis task is still open and the behavior needs an OpenSpec closure artifact.

## What Changes

- Capture the existing Codex create-session stopping-runtime race behavior as a completed OpenSpec change.
- Keep the implementation minimal: no new runtime strategy, no unbounded retry, and no frontend UI expansion.
- Verify the existing Rust retry classifier and bounded retry tests.
- Archive the change after strict OpenSpec validation.

## Non-Goals

- Add new recovery buttons or composer behavior.
- Change runtime lifecycle ownership.
- Retry non-runtime errors.
- Introduce infinite reconnect loops.
