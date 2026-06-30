## ADDED Requirements

### Requirement: Disk Codex Stale Binding Copy MUST Explain Recoverable Connection Loss

Disk Codex stale binding failures that affect create-session readiness or immediate first send MUST be surfaced as recoverable connection or old-binding state, not as raw provider/runtime diagnostics.

#### Scenario: thread not found explains stale binding
- **WHEN** a disk Codex create-session or immediate first send fails with `thread not found`, `session not found`, or classified `stale-thread-binding`
- **THEN** the user-facing copy MUST explain that the previous Codex session binding is no longer usable or that the connection was interrupted
- **AND** it MUST provide an actionable next step such as retry, reconnect, recover thread, or start a fresh conversation
- **AND** raw strings such as `thread not found` MAY remain available in diagnostics but MUST NOT be the primary summary copy

#### Scenario: internal cleanup does not blame user shutdown
- **WHEN** a disk Codex failure includes `stale_reuse_cleanup`, `internal_replacement`, or equivalent internal cleanup source
- **THEN** the user-facing stale recovery copy MUST NOT say or imply that the user manually shut down Codex
- **AND** diagnostics MAY retain the original cleanup source for support and correlation

#### Scenario: durable stale conversation remains conservative
- **WHEN** the stale disk Codex thread has accepted user work or durable local activity
- **THEN** copy improvements MUST NOT authorize silent replacement of that durable conversation
- **AND** recovery MUST still require verified rebind or explicit fresh/fork continuation under the existing stale-thread recovery contract
