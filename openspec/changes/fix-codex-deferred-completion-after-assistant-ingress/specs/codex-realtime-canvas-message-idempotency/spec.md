## ADDED Requirements

### Requirement: Codex Terminal Settlement MUST Bypass Stale Collaboration Blockers After Assistant Ingress

When a Codex realtime turn has already delivered assistant stream ingress and subsequently emits `turn/completed`, the frontend MUST settle the parent turn even if collaboration child-agent or wait-tool snapshots still appear active. The system MUST preserve stale blocker details in diagnostics, but those blockers MUST NOT keep `isProcessing` true indefinitely once terminal parent-turn evidence is present.

#### Scenario: assistant delta and terminal turn settle despite stale child blocker

- **WHEN** a Codex turn starts a `collabAgentToolCall`
- **AND** the assistant response is visible through an `item/agentMessage/delta` or equivalent assistant snapshot
- **AND** the parent turn emits `turn/completed`
- **AND** the child-agent snapshot still reports `running` or lacks terminal completion evidence
- **THEN** the thread MUST clear processing state for the parent turn
- **AND** the active turn id MUST be cleared
- **AND** diagnostics MUST retain the remaining blocker details

#### Scenario: no assistant ingress keeps conservative deferral

- **WHEN** a Codex turn starts a `collabAgentToolCall`
- **AND** no assistant stream ingress has been observed
- **AND** the parent turn emits `turn/completed`
- **AND** the child-agent snapshot still reports `running` or lacks terminal completion evidence
- **THEN** the existing deferred-completion behavior MUST remain active
- **AND** the thread MUST NOT clear processing state solely from the child-blocked `turn/completed`
