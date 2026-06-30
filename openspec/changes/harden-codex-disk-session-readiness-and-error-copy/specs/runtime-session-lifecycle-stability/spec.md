## ADDED Requirements

### Requirement: Internal Runtime Cleanup MUST Be Distinguished From User Shutdown In Foreground Readiness

Runtime lifecycle diagnostics that affect foreground Codex disk create-session or immediate first-send readiness MUST distinguish internal cleanup/replacement from user-requested manual shutdown.

#### Scenario: stale reuse cleanup during readiness is recoverable lifecycle state
- **WHEN** a disk Codex runtime ends during create-session readiness or immediate first-send readiness with source `stale_reuse_cleanup`, `internal_replacement`, or equivalent internal cleanup source
- **THEN** frontend and backend diagnostics MUST classify it as a recoverable runtime lifecycle interruption when retryable
- **AND** the user-facing state MUST guide retry or reconnect rather than presenting it as user manual shutdown

#### Scenario: benign cleanup without foreground work stays non-disruptive
- **WHEN** a stale disk Codex runtime is cleaned up and no foreground create-session, send, resume, active turn, or pending request is attached
- **THEN** the system MAY record lifecycle evidence
- **AND** it MUST NOT create a foreground conversation failure notice solely from that benign cleanup

#### Scenario: lifecycle fields remain correlatable
- **WHEN** the UI maps internal cleanup to user-readable recovery copy
- **THEN** diagnostics MUST still preserve correlatable lifecycle fields such as workspace, engine, thread id when available, reasonCode, shutdown source, recovery source, retryability, and user action
