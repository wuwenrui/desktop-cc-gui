## ADDED Requirements

### Requirement: Turn Semantic Diff Provides Evidence-Backed Review Facts

The session activity semantic diff SHALL provide evidence-backed review facts for a conversation turn, including deterministic diff-derived facts, validation command evidence, risk hints, and future AI review hints that reference evidence.

#### Scenario: Semantic facts carry structured evidence refs

- **WHEN** a semantic diff fact is rendered
- **THEN** the fact SHALL carry one or more structured evidence refs when concrete evidence exists
- **AND** the UI SHALL expose one compact evidence line without duplicating the same path in a second ref row
- **AND** file-backed evidence SHALL be actionable and open the referenced file line when line data exists
- **AND** long evidence labels and refs such as file paths SHALL wrap within the available surface instead of overflowing or being replaced by an ellipsis.

#### Scenario: Validation command evidence is connected

- **WHEN** a turn contains command events that run validation commands such as tests, lint, typecheck, or OpenSpec validation
- **THEN** the semantic diff SHALL render those commands as validation evidence
- **AND** completed commands SHALL be distinguished from failed commands.

#### Scenario: Test files are not treated as executed tests

- **WHEN** a turn changes test files but has no validation command evidence
- **THEN** the semantic diff MAY show a test-file coverage hint
- **AND** it SHALL NOT claim that tests were run successfully.

#### Scenario: TypeScript and React facts are extracted from hunks

- **WHEN** a turn's diff hunk adds TypeScript exports, React components, hooks, state hooks, or event handlers
- **THEN** the semantic diff SHALL describe those concrete facts when extractable
- **AND** it SHALL cite the file or hunk evidence.

#### Scenario: Test assertion facts are extracted from hunks

- **WHEN** a turn's diff hunk adds test cases or assertions
- **THEN** the semantic diff SHALL describe the added test coverage or assertion surface when extractable
- **AND** it SHALL keep confidence bounded to the diff evidence.

#### Scenario: AI review facts require evidence

- **WHEN** future AI review facts are supplied to the semantic diff model
- **THEN** facts without evidence refs SHALL be ignored
- **AND** AI-sourced facts SHALL render as review hints rather than verified deterministic facts.

#### Scenario: Deterministic facts remain visible with AI review

- **WHEN** AI review facts and deterministic rule facts are both available
- **THEN** the semantic diff SHALL preserve deterministic facts
- **AND** AI review SHALL augment rather than replace them.
