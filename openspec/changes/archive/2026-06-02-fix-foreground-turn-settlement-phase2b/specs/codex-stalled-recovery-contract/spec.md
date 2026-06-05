## MODIFIED Requirements

### Requirement: Stop After Codex Stall MUST Unblock Future Sends

Stopping, interrupting, or otherwise terminally settling a stalled Codex turn MUST produce a deterministic terminal or abandoned lifecycle result so future user messages are not trapped behind the stale in-flight state.

#### Scenario: stop settles stalled turn

- **WHEN** the user stops a Codex turn in stalled or dead-recoverable state
- **THEN** the turn MUST settle as abandoned, interrupted, failed, or equivalent terminal state
- **AND** processing and active-turn markers for that turn MUST be cleared

#### Scenario: interrupted foreground turn clears matching busy residue

- **WHEN** a Codex foreground turn is interrupted
- **AND** lifecycle evidence identifies the interrupted `workspaceId`, `engine`, `threadId`, and `turnId`
- **THEN** the system MUST clear processing and active-turn markers for that matching turn
- **AND** it MUST NOT leave the thread in pseudo-processing or busy-residue state

#### Scenario: interrupted cleanup does not clear successor turn

- **WHEN** a Codex foreground turn is interrupted
- **AND** a newer active successor turn exists for the same thread
- **THEN** cleanup for the interrupted turn MUST NOT clear the successor turn's processing or active-turn markers

#### Scenario: next send chooses verified or fresh target

- **WHEN** the user sends a new message after stopping a stalled Codex turn
- **THEN** the system MUST target a verified existing thread or create an explicit fresh continuation target
- **AND** the send MUST NOT reuse a thread identity already classified as unrecoverable

## ADDED Requirements

### Requirement: Codex Terminal Evidence Cleanup MUST Clear Foreground Busy Residue

When Codex lifecycle arbitration accepts scoped terminal evidence and reports `cleanup-residue`, the system MUST clear only the matching foreground busy residue instead of leaving the UI in pseudo-processing.

#### Scenario: matched terminal evidence clears busy residue

- **WHEN** Codex three-evidence arbitration accepts terminal evidence and state evidence for the current `workspaceId`, `engine`, `threadId`, and `turnId`
- **AND** the decision action is `cleanup-residue`
- **AND** the decision reason is `busy-residue`
- **THEN** the system MUST clear the matching turn's processing and active-turn markers
- **AND** the cleanup MUST be idempotent

#### Scenario: skipped reconciliation can still cleanup when helper already decided cleanup-residue

- **WHEN** the reconciliation query is skipped with `skipReason = "decision-not-reconciliation"`
- **AND** the same scoped payload has `scopeMatch.matched = true`
- **AND** `acceptedEvidence.terminal = true`
- **AND** `acceptedEvidence.state = true`
- **AND** `decisionAction = "cleanup-residue"`
- **THEN** Phase2b cleanup MUST be eligible for the matching foreground turn

#### Scenario: terminal cleanup rejects mismatched scope

- **WHEN** terminal evidence exists for an older or different `workspaceId`, `engine`, `threadId`, `turnId`, runtime session, or runtime lease
- **THEN** the system MUST treat that evidence as stale or diagnostic-only for the current active turn
- **AND** it MUST NOT clear current processing state

#### Scenario: normal long-running turn remains protected

- **WHEN** a Codex turn is still running or has only frontend silence, stale progress, visible text, or history content as evidence
- **THEN** Phase2b cleanup MUST NOT clear processing or active-turn markers
- **AND** the turn MUST remain eligible to receive progress or terminal evidence
