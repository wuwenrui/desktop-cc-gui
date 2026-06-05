## ADDED Requirements

### Requirement: Live User Question Pinning Regression Coverage MUST Stay Display-Only

Live user-question pinning MUST remain covered by focused regression tests and MUST stay scoped to presentation state.

#### Scenario: focused tests cover sticky handoff and live window trimming

- **WHEN** live user-question pinning is changed or verified
- **THEN** focused coverage MUST demonstrate sticky handoff by scroll position
- **AND** focused coverage MUST demonstrate that bounded live-window trimming preserves the latest ordinary user question candidate

#### Scenario: focused tests exclude pseudo-user sticky candidates

- **WHEN** user-like rows are generated from memory-only payloads, note-card summaries, agent-task notifications, or other pseudo-user presentation helpers
- **THEN** focused coverage MUST demonstrate that those rows do not become live sticky user-question candidates
- **AND** the original ordinary user question MUST remain eligible when present

#### Scenario: pinning closure does not expand runtime contracts

- **WHEN** live user-question pinning is active or verified
- **THEN** the implementation MUST NOT require new Tauri commands, storage fields, runtime events, or history loader payload fields
- **AND** copy behavior MUST remain bound to the original user message row
