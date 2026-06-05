# large-file-modularization-governance Delta Spec

## MODIFIED Requirements

### Requirement: Completion Criteria for Governance Milestones

The system SHALL define measurable completion criteria for the Deferred + JIT governance mode, retained hard-debt elimination, and staged P0/P1 modularization batches.

#### Scenario: Deferred strategy review
- **WHEN** governance review is performed
- **THEN** review MUST include hard-gate violations count, JIT remediation outcomes, and unresolved risk list
- **AND** retained near-threshold files MAY be documented as watchlist items without mandatory decomposition plan

#### Scenario: Staged P0/P1 split completion review
- **WHEN** a P0/P1 modularization batch is marked complete
- **THEN** the review MUST list the original line count, final line count, matched policy, warn threshold, fail threshold, and remaining headroom for each split file
- **AND** each P0 file MUST either be reduced below warn threshold or retain at least 150 lines of fail-threshold headroom with a recorded follow-up split rationale
- **AND** each P1 file MUST retain at least 200 lines of fail-threshold headroom unless an explicit risk acceptance is documented
- **AND** no batch MAY be marked complete if it introduces new large-file hard debt

#### Scenario: Retained hard-debt elimination
- **WHEN** a retained fail-scope baseline entry is selected for cleanup
- **THEN** the cleanup MUST reduce the source file below its matched fail threshold through boundary-driven modularization
- **AND** the baseline MUST be regenerated only after the retained source no longer exceeds the fail threshold
- **AND** the cleanup MUST preserve public facades, selector contracts, command names, payload shapes, and persisted fields for the same batch
