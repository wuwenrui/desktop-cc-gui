## ADDED Requirements

### Requirement: Codex Create Session Shutdown Race Retry MUST Stay Bounded Across Entrypoints

Codex create-session entrypoints MUST share the same stopping-runtime race semantics: reject a runtime that is already ending, perform at most one fresh reacquire/retry for the create request, and settle persistent races as a recoverable create-session error.

#### Scenario: app create-session retries once after stopping runtime race

- **WHEN** the Tauri Codex `start_thread` command starts a session
- **AND** the first `thread/start` attempt fails because the bound runtime ended during manual shutdown or equivalent stopping lifecycle
- **THEN** the app path MUST perform one fresh runtime acquire before retrying `thread/start`
- **AND** it MUST NOT retry non-runtime errors such as workspace connectivity failures

#### Scenario: persistent app race returns stable recoverable error

- **WHEN** the app create-session retry also fails with a stopping-runtime race
- **THEN** the app path MUST return a stable recoverable create-session error such as `[SESSION_CREATE_RUNTIME_RECOVERING]`
- **AND** it MUST NOT enter an unbounded retry loop

#### Scenario: daemon create-session keeps parity with app path

- **WHEN** the daemon `start_thread` path observes the same stopping-runtime race
- **THEN** it MUST use the same bounded retry and recoverable-error semantics as the app path
- **AND** daemon parity MUST NOT create a second retry strategy that diverges from the app command path
