## ADDED Requirements

### Requirement: Active Thread Map MUST Canonicalize Verified Stale Bindings Before Lifecycle Use

When a persisted active workspace thread id has a verified stale-thread alias, frontend lifecycle state MUST converge that active id to the canonical target before send, resume, refresh, or restore consumers can keep using the stale id.

#### Scenario: active workspace map repairs a stale Codex thread alias

- **GIVEN** `activeThreadIdByWorkspace` contains a Codex `threadId` with a verified persisted alias
- **AND** the alias chain resolves to a latest canonical `threadId`
- **WHEN** the thread lifecycle state observes the active workspace map
- **THEN** the active workspace entry MUST be rebound to the latest canonical `threadId`
- **AND** lifecycle consumers MUST NOT continue to treat the stale source `threadId` as the current active conversation

#### Scenario: active workspace map ignores empty or already canonical bindings

- **GIVEN** an active workspace entry has an empty, missing, or already canonical `threadId`
- **WHEN** active-thread canonicalization runs
- **THEN** the system MUST NOT dispatch a redundant active-thread mutation
- **AND** existing loaded thread content MUST remain untouched
