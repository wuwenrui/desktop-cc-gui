## MODIFIED Requirements

### Requirement: Fresh Continuation MUST Preserve User Intent Visibility

When stale Codex recovery falls back to a fresh thread, the user's immediate intent MUST remain visible and target the new active identity.

#### Scenario: fresh continuation inherits source provider binding

- **WHEN** a stale Codex first-turn draft or recover-and-resend path creates a fresh continuation
- **AND** the source thread metadata contains a non-empty `providerProfileId`
- **THEN** the fresh Codex thread creation request MUST include that same `providerProfileId`
- **AND** blank, whitespace, null, or undefined provider profile ids MUST be treated as disk default and omitted from the request payload
- **AND** the system MUST NOT silently switch a provider-bound stale recovery to the disk provider.

#### Scenario: fork continuation inherits source provider binding

- **WHEN** stale Codex recovery falls back to a fork continuation
- **AND** the source thread metadata contains a non-empty `providerProfileId`
- **THEN** the fork request MUST include `{ activate: true, providerProfileId }`
- **AND** the parent thread metadata and visibility MUST remain unchanged
- **AND** blank provider ids MUST be omitted so legacy disk-default behavior remains compatible.
