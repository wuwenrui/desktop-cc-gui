## ADDED Requirements

### Requirement: Workspace Projection SHALL Expose Task Run And Orchestration Links Separately From Session Membership

Workspace projection SHALL expose orchestration/task/run/session relationships without changing shared session catalog membership semantics.

#### Scenario: linked sessions are projected separately

- **WHEN** an orchestration task links to one or more sessions
- **THEN** workspace projection SHALL expose those links as task/session associations
- **AND** session catalog membership SHALL remain governed by existing session catalog rules

#### Scenario: task aggregate does not inflate session count

- **WHEN** workspace overview renders orchestration or task-run aggregates
- **THEN** those aggregates SHALL NOT be counted as additional sessions
- **AND** session counts SHALL remain based on session membership truth

#### Scenario: degraded task source is explainable

- **WHEN** a task/run/session association references a missing run, missing session, or unreadable source
- **THEN** workspace projection SHALL expose a degraded marker
- **AND** UI SHALL explain which linked source is unavailable
