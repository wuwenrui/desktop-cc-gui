## ADDED Requirements

### Requirement: V0511 Evidence Gates MUST Consume Producer Artifacts

Runtime performance evidence gates MUST consume v0.5.11 producer artifacts for supported `S-IO-*` scenarios before classifying a summary as unsupported.

#### Scenario: supported producer populates summary

- **WHEN** a producer artifact contains valid metric rows for `S-IO-RR`, `S-IO-AS`, `S-IO-FC`, `S-IO-FS`, or `S-IO-FP`
- **THEN** `scripts/generate-runtime-evidence-report.mjs` MUST populate the matching summary with those values
- **AND** the summary MUST expose the evidence class from the producer artifact

#### Scenario: missing producer remains explicit

- **WHEN** no trustworthy producer artifact exists for a v0.5.11 runtime evidence summary
- **THEN** the summary MUST remain `unsupported`
- **AND** it MUST include a concrete reason and next action instead of a silent null value

### Requirement: V0511 Archive Readiness MUST Distinguish Residual Warnings From Hard Failures

Archive-readiness output MUST keep hard failures separate from visible residual performance debt.

#### Scenario: warning result remains actionable

- **WHEN** `npm run perf:archive-readiness -- --json` exits with warnings but no hard failures
- **THEN** the JSON result MUST report `ok: true`
- **AND** every warning MUST include a record id, owner, and next action
