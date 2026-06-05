## Design

### Existing Runtime Contract

The current backend path routes Codex session creation through bounded runtime acquisition:

- Tauri command `start_thread(...)` calls `start_thread_with_runtime_retry(...)`.
- `start_thread_with_runtime_retry(...)` delegates to `run_start_thread_with_hook_safe_fallback_and_recovery_probe(...)`.
- `run_start_thread_with_retry_and_recovery_probe(...)` ensures runtime once, attempts `thread/start`, and retries at most once when the error is classified as a stopping runtime race.
- If the second attempt hits the same stopping race, it returns the stable `[SESSION_CREATE_RUNTIME_RECOVERING]` recoverable error.

### Classifier

The classifier treats manual shutdown, `manual_shutdown`, and `[RUNTIME_ENDED] ... stopped after ...` messages as stopping-runtime race evidence. It deliberately does not classify generic failures such as `workspace not connected`.

### Daemon Parity

The daemon `start_thread(...)` path has matching one-shot retry behavior and returns the same recoverable error when the race persists.

### Chosen Scope

This change does not alter runtime logic. It closes the task by preserving the current bounded retry strategy in OpenSpec and validating existing focused regression coverage.

### Risk

Low. No production code change is required unless validation exposes drift.
