# large-file-modularization-governance Delta Spec

## ADDED Requirements

### Requirement: Large File Gate SHALL Distinguish Known Debt From New Regressions

The large-file gate SHALL record known hard-debt files in the baseline when immediate safe splitting is not part of the current change.

#### Scenario: known hard debt is baseline tracked

- **WHEN** a file remains above its hard-fail threshold after the safe refactor scope is complete
- **THEN** the file MAY be recorded in the large-file baseline
- **AND** future line-count growth SHALL be treated as a regression
- **AND** the baseline SHALL NOT be used to hide newly introduced large files without explicit review

### Requirement: Style Surface Splits SHALL Preserve Selector Contracts

Feature stylesheet splits SHALL preserve selector contracts when cohesive style regions are extracted to lower gate pressure.

#### Scenario: Project Map inspector styles are extracted

- **WHEN** Project Map inspector/detail styles grow the main stylesheet beyond the style hard-fail threshold
- **THEN** those styles MAY move to a feature-local imported stylesheet
- **AND** existing class names and component markup SHALL remain compatible
