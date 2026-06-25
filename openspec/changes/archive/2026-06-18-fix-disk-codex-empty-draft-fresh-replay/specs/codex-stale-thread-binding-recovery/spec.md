## MODIFIED Requirements

### Requirement: First-Turn Stale Codex Drafts MUST Use Fresh Continuation Semantics

Codex stale-thread recovery MUST distinguish durable stale conversation identities from first-turn drafts that never accepted user work.

#### Scenario: empty stale draft can be replaced without manual recovery card
- **WHEN** a Codex thread identity fails with `thread not found`
- **AND** canonical accepted-turn / durable-activity facts prove the identity has no accepted user turn, no completed assistant response, and no persisted durable activity
- **THEN** the system MAY replace the stale draft with a fresh Codex thread for the current first prompt
- **AND** the primary user path MUST continue the prompt in the fresh thread rather than asking the user to recover the old empty identity
- **AND** this fresh replacement MUST be attempted before stale fork fallback for the same failed empty draft

#### Scenario: same-id refresh does not verify a missing first-turn draft
- **WHEN** a newly started Codex empty draft fails the first prompt with `thread not found`
- **AND** refresh/rebind returns the same `threadId` that just failed
- **THEN** the system MUST NOT treat that same id as a verified rebind
- **AND** the system MUST continue through first-turn fresh replacement or visible failure semantics rather than retrying the same missing id as recovered

#### Scenario: cold-start missing thread gets bounded readiness retry
- **WHEN** the first `turn/start` after Codex runtime cold start reports `thread not found`
- **THEN** the backend SHOULD perform same-runtime `thread/resume` plus short bounded readiness retry before surfacing the failure
- **AND** the retry MUST remain bounded and MUST NOT route the request to another provider/runtime

#### Scenario: durable stale thread still requires verified rebind or explicit fresh continuation
- **WHEN** a Codex thread identity fails after one or more accepted user turns or durable activity facts exist
- **THEN** the system MUST first attempt verified rebind through the existing stale-thread recovery contract
- **AND** fresh continuation MUST be explicit and user-visible rather than silently replacing the old thread
