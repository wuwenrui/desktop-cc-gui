## 1. Evidence And Baseline

- [x] 1.1 [P0][Dep:none][I: `v0.5.3..v0.5.5` comparison notes][O: implementation note in code comments or change verification][V: reviewer can confirm AskUserQuestion main flow was unchanged across compared tags] Record the baseline finding that this is Windows lifecycle hardening, not a frontend submit regression.
- [x] 1.2 [P0][Dep:none][I: current Claude AskUserQuestion response path][O: identified logging/diagnostic insertion points][V: code review can trace request accepted -> turn id -> session id -> terminate -> spawn -> first event] Map the exact AskUserQuestion resume checkpoints before editing.

## 2. Windows Wrapper And Resolver Hardening

- [x] 2.1 [P0][Dep:1.2][I: `app_server_cli` resolver][O: Claude runtime candidate preference keeps explicit user path but prefers `.cmd` / `.exe` over implicit `.ps1`][V: Rust unit tests cover `.cmd`, `.exe`, `.bat`, `.ps1`, direct path ordering] Harden implicit Windows Claude binary selection for managed runtime execution.
- [x] 2.2 [P0][Dep:2.1][I: wrapper classifier][O: wrapper kind metadata available for Claude runtime command construction][V: Rust unit tests assert wrapper kind values for `.cmd`, `.bat`, `.exe`, `.ps1`, direct] Expose wrapper kind for AskUserQuestion resume diagnostics.
- [x] 2.3 [P1][Dep:2.2][I: doctor diagnostic payload][O: Claude doctor reports selected Windows runtime candidate and wrapper kind][V: focused doctor tests or snapshot assertions include selected path and wrapper kind] Align engine-environment doctor with runtime wrapper selection.

## 3. AskUserQuestion Resume Diagnostics

- [x] 3.1 [P0][Dep:1.2][I: `respond_to_user_input`][O: accepted response diagnostic includes request id and turn id without leaking answer text][V: Rust test or log review verifies fields and redaction] Add request acceptance diagnostics for AskUserQuestion answers.
- [x] 3.2 [P0][Dep:3.1][I: `handle_ask_user_question_resume`][O: resume checkpoint diagnostics include session id presence, wrapper kind, resolved binary path, parent PID, and resume source][V: focused Rust tests cover diagnostics construction where possible] Add resume checkpoint diagnostics before parent termination and resume spawn.
- [x] 3.3 [P1][Dep:3.2][I: runtime diagnostics surface][O: Windows AskUserQuestion resume-pending / resumed / failed evidence is queryable through existing runtime diagnostics][V: runtime diagnostics tests assert bounded event/counter updates] Add runtime churn evidence for AskUserQuestion resume attempts.

## 4. Failure Propagation And Recovery

- [x] 4.1 [P0][Dep:3.2][I: Windows parent termination path][O: taskkill failure returns or emits actionable failure with PID/status context][V: Rust tests cover failure classification seam; Windows manual test confirms diagnostic on forced failure if feasible] Make parent termination failure explicit instead of silent.
- [x] 4.2 [P0][Dep:3.2][I: resume spawn path][O: spawn failure includes wrapper/path details and emits a turn/runtime error suitable for clearing processing state][V: Rust tests cover simulated spawn failure or command construction failure path] Make AskUserQuestion resume spawn failure explicit.
- [x] 4.3 [P0][Dep:4.1,4.2][I: frontend submit/hook behavior][O: accepted answer remains visible as submitted evidence or recoverable runtime error when resume fails][V: focused Vitest added only if backend response shape or frontend state handling changes] Preserve user answer evidence and avoid indefinite pseudo-processing.

## 5. Regression Coverage

- [x] 5.1 [P0][Dep:2.1,2.2][I: Rust command tests][O: Windows wrapper preference and classification tests][V: `cargo test --manifest-path src-tauri/Cargo.toml wrapper_kind` or focused equivalent] Cover Windows wrapper selection and classification.
- [x] 5.2 [P0][Dep:3.1,3.2,4.2][I: Claude AskUserQuestion tests][O: tests for request-id routing, missing session id diagnostic, resume spawn diagnostic, and answer preservation][V: focused Claude Rust tests pass] Cover AskUserQuestion resume diagnostics and failure paths.
- [x] 5.3 [P1][Dep:4.3][I: frontend hook/component tests][O: tests for retry/recoverable failure only if frontend code changes][V: focused Vitest suite for `useThreadUserInput` / `RequestUserInputMessage`] Cover frontend recovery behavior if touched.

## 6. Verification And Evidence

- [x] 6.1 [P0][Dep:5.1,5.2][I: OpenSpec artifacts][O: strict OpenSpec validation evidence][V: `openspec validate harden-windows-ask-user-question-resume --strict --no-interactive`] Validate the change artifacts.
- [x] 6.2 [P0][Dep:5.1,5.2][I: backend test suite][O: focused Rust validation evidence][V: focused `cargo test --manifest-path src-tauri/Cargo.toml ...` command recorded] Run focused backend tests.
- [x] 6.3 [P1][Dep:5.3][I: frontend touched files if any][O: focused frontend validation evidence][V: focused Vitest and `npm run typecheck` if frontend changed] Run frontend validation only for touched frontend paths.
- [x] 6.4 [P0][Dep:6.2][I: Windows host with Claude installed][O: manual verification note for `.cmd` or `.exe`; `.ps1` if available][V: AskUserQuestion answer submit logs accepted -> terminate -> spawn -> first resume event or explicit failure] Capture Windows manual evidence before claiming issue #658 fixed.
