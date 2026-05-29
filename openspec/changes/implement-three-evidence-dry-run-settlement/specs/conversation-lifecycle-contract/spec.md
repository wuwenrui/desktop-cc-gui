## ADDED Requirements

### Requirement: Phase 1 Settlement Arbitration MUST Be Pure And Dry-Run Only

Phase 1 three-evidence turn settlement implementation MUST evaluate settlement decisions through a pure helper while preserving existing lifecycle behavior.

#### Scenario: pure helper evaluates scoped evidence

- **WHEN** frontend lifecycle code evaluates terminal, state, progress, or reconciliation-needed evidence
- **THEN** it MUST call a pure decision helper with explicit evidence, policy, and caller-provided current time
- **AND** the helper MUST return action, reason, scope match result, accepted evidence classes, and bounded diagnostics
- **AND** the helper MUST NOT mutate frontend state, call backend/Tauri APIs, write logs, or read wall-clock time directly

#### Scenario: Phase 1 does not clear lifecycle state

- **WHEN** the pure helper returns `settle`, `cleanup-residue`, `reject`, `defer`, `keep-running`, or `request-reconciliation`
- **THEN** Phase 1 integration MUST record the result as dry-run diagnostic only
- **AND** it MUST NOT clear `isProcessing`, `activeTurnId`, blocker residue, runtime lease state, message content, or conversation history

#### Scenario: missing terminal evidence requests reconciliation without completion

- **WHEN** no terminal evidence is available
- **AND** progress evidence is stale or absent
- **THEN** the pure helper SHOULD return `request-reconciliation` when reconciliation is allowed by policy
- **AND** Phase 1 MUST NOT mark the turn completed

#### Scenario: fresh progress keeps long work running

- **WHEN** terminal evidence is absent
- **AND** progress evidence is fresh
- **THEN** the pure helper MUST return a keep-running decision with progress-protected reason
- **AND** Phase 1 diagnostics MUST NOT classify the turn as completed

#### Scenario: scope mismatch never becomes cleanup

- **WHEN** evidence lacks required scope, belongs to another workspace/thread/engine, references an older turn, or references a stale runtime lease
- **THEN** the pure helper MUST return reject or defer
- **AND** it MUST NOT return `settle` or `cleanup-residue`
