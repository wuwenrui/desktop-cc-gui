## ADDED Requirements

### Requirement: Codex Terminal Reconciliation MUST Use Event-Owned Thread Identity

Codex terminal settlement and terminal-history reconciliation MUST target the Codex thread that owns the event or active turn evidence. Terminal-like Codex events MUST NOT settle, clear processing, or schedule terminal reconciliation against the currently highlighted thread solely because that thread is active in the UI.

#### Scenario: background completion does not settle highlighted thread
- **WHEN** Codex thread A is processing in the background
- **AND** Codex thread B is the highlighted active UI thread
- **AND** terminal or assistant-completion evidence for thread A arrives
- **THEN** the system MUST route terminal settlement or reconciliation only to thread A
- **AND** thread B MUST NOT have processing, active-turn, or conversation state mutated by A's completion evidence

#### Scenario: missing identity cannot use active thread for terminal mutation
- **WHEN** a Codex terminal-like event lacks enough thread or turn identity to prove ownership
- **THEN** the system MUST NOT use the highlighted active thread as a terminal settlement fallback
- **AND** the system MAY record diagnostic evidence for the unowned event

### Requirement: Codex Assistant Completion MUST Trigger Bounded Thread-Scoped Reconciliation

When a processing Codex thread receives assistant completion evidence but no matching `turn/completed` has settled the turn, the frontend MUST schedule at most one bounded reconciliation for that thread and turn. Assistant completion evidence MUST NOT directly clear processing; reconciliation MUST reuse the authoritative history or existing terminal path before releasing the processing state.

#### Scenario: assistant completion without terminal schedules one reconcile
- **WHEN** a Codex thread is processing
- **AND** the same thread receives `completeAgentMessage` or equivalent assistant completion evidence
- **AND** no matching `turn/completed` has settled the active turn within the bounded follow-up window
- **THEN** the client MUST schedule at most one terminal reconciliation for that Codex thread and turn
- **AND** processing MUST be cleared only after authoritative history or terminal evidence confirms the turn has completed

#### Scenario: matching terminal completion keeps existing path
- **WHEN** a Codex thread receives assistant completion evidence
- **AND** the matching `turn/completed` settles the turn through the existing terminal path
- **THEN** the assistant-complete follow-up MUST NOT schedule duplicate reconciliation for the same thread and turn

#### Scenario: successor turn is not cleared by old completion evidence
- **WHEN** assistant completion evidence belongs to an older Codex turn
- **AND** the same thread has already started a different successor `turnId`
- **THEN** the old completion evidence MUST NOT clear processing for the successor turn
- **AND** any reconciliation MUST remain scoped to the old turn evidence
