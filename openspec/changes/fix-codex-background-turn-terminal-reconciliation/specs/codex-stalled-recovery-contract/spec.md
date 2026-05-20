## ADDED Requirements

### Requirement: Codex Processing Activation MUST Allow Terminal-Drift Reconciliation

When a Codex thread is activated while still marked processing, the client MUST allow a lightweight terminal-drift reconciliation if the thread has assistant completion evidence, suspected terminal drift, or equivalent stale-processing diagnostics. This activation reconcile MUST preserve existing no-progress and execution-active timeout semantics for turns without terminal-drift evidence.

#### Scenario: activating stale processing thread reconciles terminal drift
- **WHEN** a user switches to a Codex thread that is still marked `isProcessing=true`
- **AND** the thread has assistant completion evidence or terminal-drift diagnostics for the active turn
- **THEN** the client MUST perform at most one lightweight terminal-drift reconciliation for that thread and turn
- **AND** the activation path MUST NOT skip recovery solely because the thread is currently marked processing

#### Scenario: activating live long-running thread preserves processing
- **WHEN** a user switches to a Codex thread that is still marked `isProcessing=true`
- **AND** the thread has no assistant completion evidence, terminal-drift diagnostics, backend stalled settlement, runtime-ended event, or equivalent recovery signal
- **THEN** the client MUST preserve the existing active-work protection
- **AND** the activation path MUST NOT force terminal reconciliation solely because the thread is processing

#### Scenario: activation reconcile is idempotent per turn
- **WHEN** a user repeatedly switches into the same stale Codex processing thread
- **THEN** activation-triggered terminal-drift reconciliation MUST be deduplicated per thread and turn
- **AND** repeated switching MUST NOT create a refresh storm
