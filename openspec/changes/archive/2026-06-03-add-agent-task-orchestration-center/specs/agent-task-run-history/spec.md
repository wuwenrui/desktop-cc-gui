## ADDED Requirements

### Requirement: Task Runs SHALL Preserve Orchestration Lineage

TaskRun history SHALL preserve optional orchestration lineage fields so execution attempts remain traceable to project-level work items.

#### Scenario: dispatched run records orchestration task id

- **WHEN** a TaskRun is created from an orchestration task
- **THEN** the run SHALL record the orchestration task id
- **AND** the run SHALL keep its existing run id, trigger, status, timestamps, and diagnostics

#### Scenario: successor run preserves parent task and run lineage

- **WHEN** user retries, resumes as successor, forks, or creates a follow-up from an orchestration task
- **THEN** the successor run SHALL preserve parent run id when applicable
- **AND** the successor run SHALL preserve orchestration task id or follow-up task linkage

#### Scenario: run history remains independent from orchestration projection

- **WHEN** an orchestration task is archived, hidden, or deleted from local projection
- **THEN** TaskRun history SHALL remain readable
- **AND** run diagnostics SHALL NOT be deleted as a side effect

#### Scenario: canceled queued dispatch remains traceable

- **WHEN** user cancels a queued orchestration dispatch before runtime start
- **THEN** TaskRun history SHALL mark that run as canceled
- **AND** the canceled run SHALL remain readable as historical lineage
- **AND** retrying the orchestration task SHALL create or link a new run instead of overwriting the canceled run

### Requirement: Task Runs SHALL Support Non-Kanban Orchestration Sources

TaskRun history SHALL support runs launched from orchestration tasks without pretending every run originated from Kanban.

#### Scenario: orchestration run uses orchestration source

- **WHEN** a TaskRun is created from an OrchestrationTask that is not a Kanban task
- **THEN** the run SHALL preserve a non-Kanban task definition source such as `orchestration`
- **AND** the run SHALL record the orchestration task id
- **AND** the run SHALL remain readable by existing Task Center views

#### Scenario: legacy Kanban runs remain compatible

- **WHEN** existing stored TaskRuns contain task definition source `kanban`
- **THEN** normalization SHALL keep those records readable
- **AND** migration SHALL NOT require rewriting old Kanban runs before Task Center can render
