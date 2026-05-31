## ADDED Requirements

### Requirement: Spec Hub Apply Sessions SHALL Be System-Auto Traceable Sessions
Spec Hub apply execution sessions SHALL be classified as traceable automatic sessions so they remain auditable without appearing at workspace root.

#### Scenario: Codex apply thread is system-auto
- **WHEN** Spec Hub apply starts a Codex thread for execution
- **THEN** the thread SHALL be classified with `sessionPurpose=spec-hub-apply`
- **AND** it SHALL use `visibility=system-auto`

#### Scenario: Non-Codex apply session is system-auto
- **WHEN** Spec Hub apply starts a Claude, Gemini, OpenCode, or compatible remote engine session
- **THEN** the session SHALL be classified with `sessionPurpose=spec-hub-apply`
- **AND** it SHALL use `visibility=system-auto`

#### Scenario: Apply execution remains auditable
- **WHEN** Spec Hub apply execution finishes, fails, or times out
- **THEN** runtime state SHALL preserve the execution thread/session reference and engine identity
- **AND** the session SHALL be accessible from the reserved system-auto grouping rather than workspace root
