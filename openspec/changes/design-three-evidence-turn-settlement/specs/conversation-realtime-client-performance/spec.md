## ADDED Requirements

### Requirement: Settlement Diagnostics MUST Support Three-Evidence Dry-Run Decisions

Realtime diagnostics MUST support dry-run three-evidence settlement decisions before guarded settlement behavior is enabled.

#### Scenario: dry-run decision records why settlement would or would not occur

- **WHEN** the client receives terminal evidence, observes busy residue, evaluates a suspected stuck foreground turn, or requests reconciliation
- **THEN** diagnostics SHOULD record the dry-run settlement decision such as `wouldSettle`, `wouldReject`, `wouldDefer`, `wouldKeepRunning`, `wouldRequestReconciliation`, or `wouldCleanupResidue`
- **AND** the record MUST include the terminal/state/progress/reconciliation evidence classes and conversation scope match result used for the decision without full conversation content

#### Scenario: scope mismatch remains visible without touching current UI

- **WHEN** dry-run settlement sees terminal, progress, status-query, or replay evidence from another thread, another engine, an older turn, an older runtime lease, or a previous foreground owner
- **THEN** diagnostics MUST classify the decision as scope mismatch, stale evidence, or equivalent
- **AND** the foreground UI state MUST remain unchanged by that evidence

#### Scenario: long-task protection remains distinguishable from stuck settlement

- **WHEN** a foreground turn has no terminal evidence but has fresh progress evidence
- **THEN** diagnostics MUST classify the decision as progress-protected or equivalent
- **AND** the system MUST NOT report the case as completed, terminal settlement failure, or provider delay without additional evidence

#### Scenario: busy residue remains separate from provider or render delay

- **WHEN** final output is visible or terminal evidence was handled
- **AND** state evidence still shows processing residue
- **THEN** diagnostics MUST classify the issue as settlement busy residue or equivalent
- **AND** it MUST remain distinguishable from upstream provider delay, backend forwarding stall, event delivery failure, and client render amplification

#### Scenario: reconciliation outcome is visible

- **WHEN** the frontend requests authoritative turn status or missed terminal replay because terminal evidence is absent and progress is stale
- **THEN** diagnostics MUST record a bounded reconciliation outcome such as `status-completed`, `status-running`, `status-unknown`, `query-failed`, `replay-terminal`, or `replay-unscoped`
- **AND** the record MUST include scope match result and decision reason without full conversation content

#### Scenario: Phase 2 behavior is kill-switchable

- **WHEN** guarded busy-residue cleanup or stale-progress reconciliation application is enabled
- **THEN** diagnostics MUST identify whether the behavior was dry-run, feature-flagged active, or disabled by kill switch
- **AND** disabling the behavior MUST leave the original normal completion path available
