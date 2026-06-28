## ADDED Requirements

### Requirement: Disk Codex Create Loading MUST Represent First Send Readiness

Codex disk create-session loading MUST only settle as ready when the disk session has the runtime and native thread readiness needed for an immediate first `sendMessage`, or MUST settle into a bounded recovering or failed state with actionable copy.

#### Scenario: disk loading completion permits first send
- **WHEN** the user creates a new Codex conversation with no provider profile id or with `__disk__`
- **AND** the create-session loading state completes successfully
- **THEN** the created conversation MUST be ready for the first `sendMessage` without requiring a second hidden runtime recovery step
- **AND** the composer/send readiness state MUST NOT claim readiness while the just-created disk thread binding is known stale, stopping, or unconfirmed

#### Scenario: disk readiness failure does not masquerade as loaded
- **WHEN** disk create-session receives a native thread id but same-runtime readiness confirmation fails, the runtime is stopping, or the binding is reported missing before first send readiness
- **THEN** the create-session flow MUST NOT present the session as fully loaded
- **AND** it MUST either continue a bounded recovering state or surface an actionable retry/reconnect failure

#### Scenario: managed provider creation remains unchanged
- **WHEN** a new Codex conversation is created with a managed provider profile id
- **THEN** disk-only readiness hardening MUST NOT run default disk runtime recovery, disk readiness confirmation, or disk fallback for that managed provider
- **AND** the existing managed provider-scoped creation behavior MUST be preserved

#### Scenario: Claude Code creation remains out of scope
- **WHEN** the user creates or resumes a Claude Code session
- **THEN** Codex disk loading hardening MUST NOT change Claude Code runtime acquisition, session creation, recovery, or user-facing copy
