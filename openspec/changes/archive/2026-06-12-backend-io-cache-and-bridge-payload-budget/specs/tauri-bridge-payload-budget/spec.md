## ADDED Requirements

### Requirement: High-Volume Tauri Invoke Responses MUST Carry Payload Budget Evidence

High-volume Tauri invoke commands MUST expose content-safe payload budget evidence and SHOULD support pagination, truncation, or summary-first hydration when responses exceed default budgets.

#### Scenario: payload size and item count are reported

- **WHEN** a high-volume invoke command completes in dev, perf, or evidence mode
- **THEN** diagnostics MUST include command name, stable surface id, item count, estimated serialized bytes, partial/truncated state, and evidence class
- **AND** diagnostics MUST avoid raw file contents, prompt text, assistant body, terminal output, diff body, secrets, and unredacted absolute paths.

#### Scenario: over-budget response remains compatible

- **WHEN** a legacy caller receives a response that exceeds the documented payload budget
- **THEN** the command MAY still return the legacy-compatible response
- **AND** it MUST emit a budget regression indicator with next-action guidance for pagination or summary-first hydration.

#### Scenario: pagination or summary-first is available for selected commands

- **WHEN** a command is migrated to the new bridge budget contract
- **THEN** it MUST support pagination, truncation metadata, or summary-first detail hydration
- **AND** the UI MUST show partial/truncated state instead of silently hiding missing data.

#### Scenario: budget metadata is reviewable

- **WHEN** a high-volume DTO or command contract is introduced or changed
- **THEN** the code or spec MUST document expected item-count and payload-size budget
- **AND** runtime evidence gates MUST be able to classify pass/fail/unsupported from structured fields.
