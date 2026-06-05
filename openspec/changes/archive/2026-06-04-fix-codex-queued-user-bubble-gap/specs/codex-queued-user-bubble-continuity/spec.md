## ADDED Requirements

### Requirement: Codex Queued Follow-Up User Bubble Continuity

Codex queued follow-up handoff MUST preserve exactly one visible user bubble for the queued message while runtime send and history reconcile converge.

#### Scenario: queued follow-up creates visible handoff bubble

- **WHEN** a non-command queued Codex follow-up is flushed to the active thread
- **THEN** the client MUST expose a thread-scoped optimistic user bubble for the queued message
- **AND** the bubble MUST preserve text, images, collaboration mode, selected agent metadata, and browser context attachment metadata when provided

#### Scenario: stale history reconcile does not create a zero-bubble gap

- **WHEN** Codex realtime history reconcile is scheduled before authoritative history contains the queued follow-up user message
- **AND** the local thread still contains a pending optimistic queued user bubble
- **THEN** the client MUST delay or skip destructive reconciliation for that attempt
- **AND** the visible timeline MUST continue to contain the queued follow-up user bubble

#### Scenario: authoritative history replaces optimistic bubble without duplicates

- **WHEN** refreshed Codex history contains a user message equivalent to the queued follow-up
- **THEN** the client MUST remove the optimistic queued bubble residue
- **AND** the visible timeline MUST contain exactly one matching user bubble
- **AND** that remaining bubble SHOULD use the authoritative history item id
