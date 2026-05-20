## ADDED Requirements

### Requirement: Governance Evidence Consumption MUST Default To Advisory Semantics

The system MUST treat all harness governance evidence consumed by the bridge, existing and new, as advisory by default. Missing artifacts, stale artifacts, malformed advisory reports, platform qualifiers, spec warnings, large-file near-threshold findings, and heavy-test-noise warnings MUST remain visible as governance evidence without automatically creating a blocking checkpoint verdict.

#### Scenario: missing governance artifact remains advisory

- **WHEN** a governance artifact is missing from the workspace
- **THEN** the evidence bridge MUST emit degraded or unknown evidence with a documented degradation reason
- **AND** the emitted evidence MUST NOT by itself force a `blocked` checkpoint verdict

#### Scenario: stale governance artifact remains visible without blocking

- **WHEN** an artifact-backed governance evidence item is stale
- **THEN** the evidence bridge MUST preserve the evidence source, observed time, and stale reason
- **AND** consumers MUST be able to render the stale state as an advisory signal
- **AND** the stale state MUST NOT by itself force a `blocked` checkpoint verdict

#### Scenario: advisory evidence keeps provenance

- **WHEN** governance evidence is rendered as an advisory signal
- **THEN** the evidence MUST still expose source identity and available provenance such as observed time, artifact path, artifact hash, and qualifier
- **AND** the UI MUST NOT hide provenance merely because the signal is non-blocking

### Requirement: Advisory Evidence MUST Preserve AI Execution Continuity

The bridge MUST NOT introduce evidence consumption behavior that requires shell execution, user confirmation, external CI completion, or synchronous artifact generation before an AI turn can continue.

#### Scenario: evidence gap does not block AI turn continuation

- **WHEN** the current workspace has an evidence gap such as a missing OpenSpec consistency artifact or absent platform qualifier
- **THEN** the bridge MUST represent the gap as advisory evidence
- **AND** the application MUST keep the AI execution flow available
- **AND** the evidence gap MUST NOT require immediate user confirmation before the next AI action

#### Scenario: suggested rerun remains optional

- **WHEN** the evidence bridge records a degradation reason that has a known validation command
- **THEN** downstream consumers MAY show the command as a suggested action
- **AND** the bridge MUST NOT execute that command on the render or policy evaluation path
