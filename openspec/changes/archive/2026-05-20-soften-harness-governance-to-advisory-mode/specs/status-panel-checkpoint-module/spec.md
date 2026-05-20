## ADDED Requirements

### Requirement: Checkpoint Surface MUST Use Stable Advisory-Oriented Sections

The checkpoint surface MUST present governance information through stable sections: `Summary`, `Advisory Signals`, `Evidence Trail`, `Policy Audit`, and `Suggested Actions`. The section structure MUST make non-blocking governance warnings visible without treating them as execution blockers.

#### Scenario: expanded checkpoint renders stable advisory sections

- **WHEN** the dock checkpoint surface is expanded
- **THEN** it MUST render a summary of the current checkpoint state
- **AND** it MUST render advisory governance signals separately from blocking failures
- **AND** it MUST expose evidence trail and policy audit details when available
- **AND** it MUST render suggested actions as recommendations rather than mandatory gates

#### Scenario: section order remains stable

- **WHEN** advisory governance evidence changes between pass, warn, fail, stale, or unknown states
- **THEN** the checkpoint section order MUST remain stable
- **AND** the UI MUST NOT reorder core sections based on transient evidence severity

### Requirement: Compact Checkpoint Hosts MUST Preserve Advisory Visibility

Compact hosts such as popover checkpoint views MAY omit full audit tables by default, but they MUST preserve advisory visibility through a summary count, highest advisory level, source summary, or an equivalent expandable entry point.

#### Scenario: popover preserves advisory summary

- **WHEN** the popover checkpoint renders while advisory governance signals exist
- **THEN** it MUST show that advisory signals are present
- **AND** it MUST NOT imply that all governance evidence is clean merely because the full audit is hidden

#### Scenario: compact view does not block execution

- **WHEN** compact checkpoint hosts summarize advisory signals
- **THEN** the summary MUST NOT disable AI execution controls
- **AND** the summary MUST NOT require the user to run suggested validations before continuing

### Requirement: Suggested Actions MUST Be Optional And Executable

Checkpoint suggested actions for advisory governance signals MUST point to real validation commands or existing detail surfaces, while remaining optional guidance.

#### Scenario: suggested validation action maps to a real command

- **WHEN** checkpoint renders a suggested validation action for governance evidence
- **THEN** the action MUST reference an existing command, check, or detail surface
- **AND** the action MUST NOT be a placeholder without an executable path

#### Scenario: suggested action does not mutate verdict

- **WHEN** a suggested action is displayed but not executed
- **THEN** the checkpoint verdict MUST remain based on current evidence and policy decisions
- **AND** merely displaying the action MUST NOT upgrade advisory evidence to `blocked`
