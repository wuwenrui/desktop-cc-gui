## ADDED Requirements

### Requirement: Task Center SHALL surface browser evidence linked to task runs

Task Center SHALL display browser context evidence associated with TaskRuns so users can review which page state informed an AI execution.

#### Scenario: run detail shows linked browser evidence
- **WHEN** a TaskRun has linked Browser Session, Browser Context Snapshot, screenshot reference, or browser action audit entries
- **THEN** Task Center SHALL expose a browser evidence section in the run detail
- **AND** the section SHALL show title, URL, capture time, and availability state when available

#### Scenario: run detail handles expired browser evidence
- **WHEN** linked browser evidence is expired, deleted, unsupported, or unavailable
- **THEN** Task Center SHALL show an explicit degraded evidence state
- **AND** the run itself SHALL remain readable and recoverable

#### Scenario: browser action history remains audit-only
- **WHEN** a TaskRun includes browser action audit entries
- **THEN** Task Center SHALL present those entries as execution evidence
- **AND** Task Center SHALL NOT treat action completion as automatic user acceptance of the run result
