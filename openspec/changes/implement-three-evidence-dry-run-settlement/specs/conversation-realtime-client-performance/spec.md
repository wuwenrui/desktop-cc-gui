## ADDED Requirements

### Requirement: Dry-Run Settlement Diagnostics MUST Be Bounded And Distinguishable

Phase 1 diagnostics MUST expose settlement arbitration outcomes without changing runtime or UI behavior.

#### Scenario: dry-run actions are recorded as would-decisions

- **WHEN** Phase 1 records a settlement arbitration result
- **THEN** diagnostics SHOULD map helper actions to dry-run labels such as `wouldSettle`, `wouldReject`, `wouldDefer`, `wouldKeepRunning`, `wouldRequestReconciliation`, or `wouldCleanupResidue`
- **AND** the record MUST include scope match result and decision reason without full conversation content

#### Scenario: busy residue remains diagnostic-only

- **WHEN** terminal evidence is matched but state evidence still indicates busy residue
- **THEN** Phase 1 diagnostics MAY record `wouldCleanupResidue`
- **AND** the integration MUST NOT perform cleanup or alter visible conversation state

#### Scenario: reconciliation-needed is separate from provider delay

- **WHEN** terminal evidence is absent and progress is stale or absent
- **THEN** diagnostics SHOULD record reconciliation-needed or equivalent
- **AND** the record MUST remain distinguishable from upstream provider delay, runtime still active, render delay, and normal long-task protection

#### Scenario: content safety is preserved

- **WHEN** dry-run settlement diagnostics are persisted or shown in debug entries
- **THEN** they MUST use bounded ids, booleans, counts, timestamps, enum status, and bounded reason strings
- **AND** they MUST NOT include full prompts, assistant responses, tool outputs, command outputs, file diffs, auth files, or secret values
