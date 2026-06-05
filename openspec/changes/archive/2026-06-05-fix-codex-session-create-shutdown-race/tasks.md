## 1. Contract

- [x] 1.1 Create OpenSpec proposal for Codex create-session shutdown race closure.
- [x] 1.2 Document the existing bounded retry design and daemon parity.
- [x] 1.3 Add spec delta for app/daemon create-session retry parity.

## 2. Implementation Review

- [x] 2.1 Confirm `start_thread_with_runtime_retry(...)` uses bounded retry.
- [x] 2.2 Confirm stopping-runtime classifier rejects non-runtime errors.
- [x] 2.3 Confirm persistent stopping race returns stable recoverable error.
- [x] 2.4 Confirm daemon `start_thread(...)` mirrors the bounded retry behavior.

## 3. Validation

- [x] 3.1 Run focused Rust start-thread retry tests.
- [x] 3.2 Run `npm run typecheck`.
- [x] 3.3 Run strict OpenSpec validation for this change.
- [x] 3.4 Run full strict OpenSpec validation.
