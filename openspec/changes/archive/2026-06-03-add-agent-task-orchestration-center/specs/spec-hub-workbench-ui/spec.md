## ADDED Requirements

### Requirement: SpecHub SHALL Provide Provider-Neutral Orchestration Candidates

SpecHub SHALL expose spec work as provider-neutral candidates so Orchestration Center does not hard-code OpenSpec.

#### Scenario: OpenSpec change maps to generic spec candidate

- **WHEN** SpecHub detects an OpenSpec change
- **THEN** it SHALL be representable as a candidate with provider id, source kind `spec_change`, label, status summary, and source refs
- **AND** Orchestration Center SHALL NOT need OpenSpec-specific parsing to display the candidate

#### Scenario: spec-kit item maps to generic spec candidate

- **WHEN** SpecHub detects a spec-kit item with enough metadata
- **THEN** it SHALL be representable using the same provider-neutral candidate shape
- **AND** provider-specific details SHALL remain inside the provider metadata

#### Scenario: unknown spec provider degrades safely

- **WHEN** SpecHub provider is unknown, unavailable, or degraded
- **THEN** Orchestration Center SHALL show unavailable or degraded state for that provider
- **AND** core manual and Project Map task flows SHALL remain usable
