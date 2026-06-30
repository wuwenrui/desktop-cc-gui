## ADDED Requirements

### Requirement: Live Runtime Cleanup Diagnostics MUST Be Low-Interruption

The realtime conversation message canvas MUST distinguish transient managed-runtime cleanup diagnostics from blocking runtime reconnect failures without changing backend lifecycle semantics.

#### Scenario: transient cleanup does not render as blocking failure
- **WHEN** an assistant diagnostic message contains `[RUNTIME_ENDED]`
- **AND** the diagnostic identifies expected managed cleanup such as `stale_reuse_cleanup` or `internal_replacement`
- **THEN** the live message canvas MUST render a lightweight runtime notice rather than the full blocking reconnect failure presentation
- **AND** the notice copy MUST describe background runtime switching / cleanup rather than connection failure
- **AND** the notice MUST NOT repeat raw `[RUNTIME_ENDED]` diagnostic text inside the card or as a separate message below it
- **AND** the notice styling MUST use existing theme tokens instead of OS-specific hardcoded surfaces

#### Scenario: blocking runtime failures keep recovery actions
- **WHEN** an assistant diagnostic message indicates broken pipe, workspace-not-connected, recovery quarantine, stale thread/session recovery, or runtime-ended without expected cleanup source
- **THEN** the live message canvas MUST keep the existing recovery actions available
- **AND** the UI MUST NOT suppress the failure as a transient cleanup status
- **AND** the UI MAY keep raw diagnostic detail visible for blocking recovery troubleshooting

#### Scenario: stale runtime diagnostics are not kept active after assistant output resumes
- **WHEN** a runtime reconnect diagnostic exists in the message history
- **AND** a newer assistant message is not a runtime reconnect diagnostic
- **THEN** the live message canvas MUST NOT render the reconnect card for the older diagnostic
- **AND** the older diagnostic's raw `[RUNTIME_ENDED]` / reconnect text MUST NOT remain visible as a normal assistant message
- **AND** a newer user message alone MUST NOT clear the card while the latest assistant message is still the diagnostic

#### Scenario: UI tone does not change lifecycle authority
- **WHEN** a runtime diagnostic is rendered with transient visual tone
- **THEN** frontend lifecycle settlement MUST still rely on existing runtime, backend, user action, or terminal turn authority
- **AND** the UI MUST NOT infer completion solely from assistant text visibility or historical output quality

#### Scenario: transient notice remains theme-compatible
- **WHEN** the app is running in light, dark, or system theme
- **THEN** the transient cleanup notice MUST inherit existing message surface, border, hover, and text tokens
- **AND** the implementation MUST NOT add platform-specific branches for macOS, Windows, or Linux
- **AND** Windows light / WebView2 surfaces MUST remain covered by the existing theme variable overrides
