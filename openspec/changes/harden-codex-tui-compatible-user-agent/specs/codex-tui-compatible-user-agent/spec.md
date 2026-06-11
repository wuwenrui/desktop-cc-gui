## ADDED Requirements

### Requirement: Codex App-Server Launch MUST Present A Codex-TUI Compatible Client Identity

Codex app-server sessions launched by mossx MUST present a Codex-compatible client identity without changing non-Codex engines.

#### Scenario: Codex initialize uses codex-tui client info

- **WHEN** mossx launches a Codex app-server workspace session
- **THEN** the `initialize` payload sent to the child process MUST set `clientInfo.name` to `codex-tui`
- **AND** it MUST set `clientInfo.title` to `codex-tui`
- **AND** it MUST set `clientInfo.version` to a parsed Codex CLI version when one is available
- **AND** it MUST fall back to `0.137.0` when version parsing fails

#### Scenario: terminal host hints are supplied for Codex compatibility

- **WHEN** mossx spawns the Codex app-server child process
- **THEN** the child environment MUST include `TERM_PROGRAM` and `TERM_PROGRAM_VERSION`
- **AND** existing non-empty environment values MUST be preserved
- **AND** missing values MUST fall back to `Apple_Terminal` and `470.2`
- **AND** this compatibility environment MUST be scoped to Codex app-server launch, not Claude, Gemini, OpenCode, or unrelated child processes

#### Scenario: GUI control-plane filtering accepts codex-tui

- **WHEN** internal transcript/history filtering sees an app-server initialize/control-plane payload
- **AND** `clientInfo.name` or `clientInfo.title` is `codex-tui`
- **AND** `capabilities.experimentalApi` is present
- **THEN** the payload MUST be classified as GUI control-plane
- **AND** legacy `ccgui` control-plane payloads MUST remain classified as GUI control-plane
- **AND** ordinary user text mentioning `codex-tui` MUST NOT be filtered by keyword alone

#### Scenario: non-Codex engine identity remains unchanged

- **WHEN** mossx launches or parses Claude, Gemini, OpenCode, or other non-Codex engine traffic
- **THEN** this change MUST NOT rewrite their client identity or terminal host behavior
- **AND** any filtering compatibility added for `codex-tui` MUST remain gated by structured control-plane signals
