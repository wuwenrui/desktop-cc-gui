## ADDED Requirements

### Requirement: Phase 2a Settlement Reconciliation MUST Query Authoritative Status Before Cleanup

Phase 2a three-evidence settlement reconciliation MUST define an authoritative status-query path for missing terminal evidence, without performing lifecycle cleanup.

#### Scenario: reconciliation-needed requests scoped status

- **WHEN** lifecycle arbitration has scoped state evidence for a foreground turn
- **AND** terminal evidence is absent
- **AND** correlated progress evidence is stale or absent
- **THEN** Phase 2a MUST request or plan an authoritative status query using the scoped workspace, engine, thread, turn or verified alias, and runtime lease when available
- **AND** it MUST NOT mark the turn completed from timeout, frontend silence, visible text, history content, or stale runtime cleanup

#### Scenario: status query confirmed terminal is re-evaluated

- **WHEN** a scoped authoritative status query returns `completed`, `failed`, `stalled`, or `runtime-ended`
- **THEN** lifecycle arbitration MUST convert that response into Terminal Evidence candidate
- **AND** it MUST re-evaluate the candidate through the same pure decision helper and scope gate before any future side effect is allowed

#### Scenario: status query running protects active work

- **WHEN** a scoped authoritative status query returns `running`
- **THEN** lifecycle arbitration MUST keep the turn active
- **AND** it MUST NOT clear `isProcessing`, `activeTurnId`, blocker residue, runtime lease state, message content, or conversation history

#### Scenario: unknown or failed status does not complete

- **WHEN** a status query returns `unknown`, returns `query-failed`, times out, lacks sufficient scope, or fails frontend scope validation
- **THEN** lifecycle arbitration MUST defer settlement or enter a degraded/reconnect diagnostic state
- **AND** it MUST NOT classify the turn as completed

#### Scenario: Phase 2a remains cleanup-free

- **WHEN** Phase 2a observes `request-reconciliation`, terminal-confirmed status, `running`, `unknown`, or `query-failed`
- **THEN** it MUST record bounded diagnostics only
- **AND** it MUST NOT perform guarded cleanup, terminal replay, message mutation, history mutation, or normal completion path replacement

### Requirement: Runtime Recovery Signals MUST NOT Substitute For Terminal Evidence

Runtime recovery and acquire failures MUST remain diagnostic context unless a scoped authoritative status response confirms terminal state.

#### Scenario: stale runtime cleanup remains diagnostic-only

- **WHEN** the client observes `stale_reuse_cleanup`, manual runtime shutdown, runtime recovery quarantine, concurrent runtime acquire timeout, or stopping-runtime race
- **THEN** lifecycle arbitration MAY attach that signal as bounded diagnostic context
- **AND** it MUST NOT treat that signal as `completed` settlement evidence for the foreground turn

#### Scenario: recovery quarantine does not clear busy state

- **WHEN** runtime recovery is quarantined or paused after repeated acquire failures
- **THEN** lifecycle arbitration MUST keep settlement separate from runtime recovery state
- **AND** it MUST NOT clear foreground processing state unless a later scoped terminal status is accepted by the pure decision helper
