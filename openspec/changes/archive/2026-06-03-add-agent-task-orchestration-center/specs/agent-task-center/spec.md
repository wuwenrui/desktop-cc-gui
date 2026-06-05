## ADDED Requirements

### Requirement: Task Center Runs SHALL Link To Orchestration Tasks

Task Center SHALL support optional linkage between TaskRuns and OrchestrationTasks while preserving TaskRun as the execution record truth.

#### Scenario: run created from orchestration task stores linkage

- **WHEN** an agent run is dispatched from Orchestration Center
- **THEN** the created TaskRun SHALL store the orchestration task id or equivalent stable linkage
- **AND** Task Center SHALL expose a way to navigate back to the orchestration task

#### Scenario: existing run can be associated without changing execution truth

- **WHEN** user associates an existing TaskRun with an orchestration task
- **THEN** the association SHALL NOT rewrite the run lifecycle history
- **AND** the association SHALL NOT change linked conversation membership

### Requirement: Task Center Run Completion SHALL Project To Orchestration Review

Task Center SHALL project terminal run outcomes to linked orchestration tasks without automatically completing them.

#### Scenario: completed linked run moves task to review

- **WHEN** a linked TaskRun reaches completed status
- **THEN** the linked orchestration task SHALL become review-needed
- **AND** Task Center SHALL NOT mark the orchestration task as accepted

#### Scenario: review projection requires an actual linked run

- **WHEN** an orchestration task has no matching linked TaskRun
- **THEN** Task Center lifecycle projection SHALL NOT create a review-needed state from task intent alone
- **AND** stale review-needed state without a linked run SHALL be corrected to a planned or todo-equivalent state

#### Scenario: failed linked run exposes recovery route

- **WHEN** a linked TaskRun reaches failed or blocked status
- **THEN** Task Center SHALL preserve the failure or blocked reason
- **AND** Orchestration Center SHALL expose retry, follow-up, or open-conversation actions when supported
