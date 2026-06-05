## ADDED Requirements

### Requirement: Orchestration Center SHALL Work Without Spec Or Workflow Providers

系统 SHALL 提供通用 `Agent Task Orchestration Center`，即使 workspace 没有 OpenSpec、spec-kit、Trellis、agent-rule files 或 CI workflow，也必须可用。

#### Scenario: plain workspace opens orchestration center

- **WHEN** active workspace has no `openspec/**`, `.trellis/**`, `.codex/**`, `.claude/**`, spec-kit files, or known workflow files
- **THEN** Orchestration Center SHALL open successfully
- **AND** user SHALL be able to create a manual task draft
- **AND** UI SHALL NOT describe missing optional providers as an error

#### Scenario: provider absence is represented as unavailable

- **WHEN** an optional provider is not detected for the workspace
- **THEN** Orchestration Center SHALL represent that provider as unavailable or empty
- **AND** core manual, Project Map, TaskRun, and session actions SHALL remain usable

### Requirement: Orchestration Center SHALL Aggregate Work Items Through Providers

系统 SHALL aggregate work items through provider-based source references instead of hard-coding one repository workflow.

#### Scenario: center lists provider-backed work items

- **WHEN** manual tasks, Project Map nodes, TaskRuns, sessions, or optional provider candidates are available
- **THEN** Orchestration Center SHALL list corresponding work items in one surface
- **AND** each item SHALL expose provider id, source kind, source label, and availability state

#### Scenario: malformed provider degrades without breaking center

- **WHEN** one provider artifact is missing, malformed, or schema-ambiguous
- **THEN** Orchestration Center SHALL mark that provider candidate as degraded or unknown
- **AND** healthy providers and core sources SHALL remain visible and usable

#### Scenario: provider filters narrow the queue

- **WHEN** user filters by provider id, source kind, status, engine, workspace, or risk marker
- **THEN** Orchestration Center SHALL narrow the visible work-item queue
- **AND** filtering SHALL NOT mutate task state

#### Scenario: selected work item remains visible after dispatch

- **WHEN** user confirms dispatch for the selected Project Map work item
- **AND** the work item's status changes so it no longer matches the active queue filter
- **THEN** Orchestration Center SHALL keep that work item selected in the detail pane
- **AND** the UI SHALL show a status or preservation notice instead of silently selecting a different queue item

#### Scenario: queue status follows linked TaskRun lifecycle

- **WHEN** an orchestration task has linked TaskRun records
- **THEN** Orchestration Center SHALL derive user-facing queue status from the latest linked TaskRun when available
- **AND** queued or planning runs SHALL appear as queued
- **AND** running, waiting-input, or blocked runs SHALL appear as running
- **AND** failed runs SHALL appear as failed
- **AND** completed runs SHALL appear as review
- **AND** canceled runs SHALL return the task to todo or equivalent planned state

### Requirement: Orchestration Task SHALL Preserve Source Evidence And Execution Scope

系统 SHALL persist orchestration tasks as work-item projections that keep provider refs, evidence refs, scope, acceptance, and linked execution ids separate from source artifacts.

#### Scenario: task stores provider-backed source references

- **WHEN** an orchestration task is created from any source
- **THEN** the task SHALL store source references with provider id and source kind
- **AND** the task SHALL store evidence references when evidence is available
- **AND** the task SHALL store confidence and stale markers when the source provides them

#### Scenario: manual task does not invent evidence

- **WHEN** user creates a manual task draft without source evidence
- **THEN** the task SHALL store provider id `core:manual` or equivalent
- **AND** evidence references SHALL be empty unless user attaches supported files or refs
- **AND** UI SHALL NOT present manual text as verified project evidence

#### Scenario: task keeps scope and acceptance summary

- **WHEN** a task draft is created
- **THEN** the draft SHALL include a scope summary
- **AND** the draft SHALL include an acceptance summary before it can be dispatched

#### Scenario: task links to runs and sessions by stable ids

- **WHEN** a task is dispatched or associated with prior work
- **THEN** the task SHALL store linked run ids and linked session ids
- **AND** the task SHALL NOT copy complete run or session payloads as its own truth

### Requirement: Dispatch SHALL Require Explicit User Confirmation

系统 SHALL require explicit user confirmation before starting agent execution from an orchestration task.

#### Scenario: user confirms dispatch details before execution

- **WHEN** user dispatches a candidate, planned, or ready orchestration task
- **THEN** the system SHALL show engine, workspace, thread strategy, prompt summary, source references, and acceptance summary
- **AND** execution SHALL start only after the user confirms

#### Scenario: provider ingestion does not auto-start execution

- **WHEN** Project Map, SpecHub, workflow provider, TaskRun, or repository-signal ingestion discovers a candidate task
- **THEN** the system SHALL NOT automatically start an agent run
- **AND** the item SHALL remain candidate or planned until user action promotes it

#### Scenario: low confidence task cannot silently become ready

- **WHEN** a task draft comes from low-confidence, unknown-confidence, or stale Project Map evidence
- **THEN** the task SHALL expose the risk marker
- **AND** the task SHALL NOT become ready without user review

### Requirement: Completed Runs SHALL Enter Review Gate Before Task Completion

系统 SHALL treat agent run completion as evidence for review, not as automatic orchestration task completion.

#### Scenario: completed run creates review-needed task state

- **WHEN** a linked TaskRun reaches completed status
- **THEN** the orchestration task SHALL enter `review_needed` or equivalent review state
- **AND** the task SHALL remain uncompleted until user accepts the result

#### Scenario: review gate requires completed linked run

- **WHEN** an orchestration task has review-needed intent
- **AND** the task has no completed linked TaskRun
- **THEN** Orchestration Center SHALL NOT show accept-result, request-changes, or create-follow-up review actions
- **AND** the UI SHALL explain that execution evidence is missing

#### Scenario: orphan review intent is corrected

- **WHEN** lifecycle projection sees a non-archived task marked review-needed
- **AND** no linked TaskRun can be found for that task
- **THEN** projection SHALL correct the task to planned or equivalent todo state
- **AND** projection SHALL reset review state to not-started

#### Scenario: failed run keeps task diagnosable

- **WHEN** a linked TaskRun fails or blocks
- **THEN** the orchestration task SHALL expose blocked or failure summary
- **AND** the task SHALL keep links to the failed run and conversation when available

#### Scenario: user requests follow-up from review

- **WHEN** user rejects or requests changes for a review-needed task
- **THEN** the system SHALL support creating a follow-up task or successor run
- **AND** lineage SHALL reference the parent task or parent run

### Requirement: Orchestration Actions SHALL Be Bounded And Provider-Aware

系统 SHALL expose only bounded actions that route to core surfaces, provider source surfaces, or existing execution paths.

#### Scenario: open source artifact from task detail

- **WHEN** task detail includes Project Map, spec provider, workflow provider, file, run, or session references
- **THEN** user SHALL be able to open the corresponding source surface when the route is supported
- **AND** unsupported routes SHALL be disabled or explained

#### Scenario: execution action uses existing run path

- **WHEN** user starts, retries, resumes, or forks execution from Orchestration Center
- **THEN** the action SHALL route through existing TaskRun/thread/runtime control paths
- **AND** Orchestration Center SHALL update from returned run state rather than locally faking success

#### Scenario: queued dispatch can be canceled before runtime start

- **WHEN** the latest linked TaskRun is queued or planning
- **THEN** Orchestration Center SHALL expose a cancel-dispatch action
- **AND** cancellation SHALL mark the TaskRun canceled
- **AND** cancellation SHALL keep the orchestration task available for retry

#### Scenario: running dispatch opens linked session when available

- **WHEN** the latest linked TaskRun is running or waiting for input
- **AND** the TaskRun has a linked thread id
- **THEN** Orchestration Center SHALL expose an open-session action for that linked thread
- **AND** if no linked thread id exists, the UI SHALL show a clear no-linked-session state

#### Scenario: archive hides task without deleting source artifacts

- **WHEN** user archives an orchestration task
- **THEN** the task SHALL leave the default active queue
- **AND** the system SHALL NOT delete Project Map, SpecHub, workflow, TaskRun, session, or repository source artifacts

### Requirement: Orchestration Core SHALL Not Depend On Personal Or Repository-Specific Workflow Files

系统 SHALL keep personal/project-specific workflow files outside the orchestration core.

#### Scenario: personal agent rules are optional repository signals

- **WHEN** workspace contains `AGENTS.md`, `.codex/**`, `.claude/**`, or similar agent-rule files
- **THEN** Orchestration Center MAY expose them as optional repository signals
- **AND** the core task model SHALL NOT require them to exist

#### Scenario: Trellis files are optional workflow provider input

- **WHEN** workspace contains `.trellis/tasks/**`
- **THEN** Orchestration Center MAY expose Trellis candidates through an optional workflow provider
- **AND** absence of `.trellis/**` SHALL NOT reduce core functionality

### Requirement: Project Map Work Queue SHALL Reflect Current Runtime Boundary

系统 SHALL present the currently implemented orchestration surface as a Project Map Work Queue. Manual task creation and SpecHub runtime candidates are supported as bounded inputs; Trellis and repository-signal runtime candidates remain deferred until runtime entries are supplied.

#### Scenario: runtime surface is Project Map Work Queue

- **WHEN** user opens the current orchestration surface from Project Map
- **THEN** the UI SHALL present it as a Project Map work queue or equivalent project-map-scoped queue
- **AND** documentation SHALL NOT claim a fully independent generic orchestration center is complete unless runtime routes and provider inputs support that claim

#### Scenario: manual task UI creates local-only work item

- **WHEN** user creates a manual work item from the Work Queue
- **THEN** the system SHALL persist a local manual OrchestrationTask draft
- **AND** the task SHALL NOT invent Project Map, OpenSpec, Trellis, spec-kit, or repository evidence refs
- **AND** execution SHALL still require the explicit dispatch gate

#### Scenario: SpecHub runtime provider is wired while Trellis and repository signals are deferred

- **WHEN** the layout can build a SpecHub workspace snapshot for the active workspace
- **THEN** the Work Queue SHALL include the SpecHub provider snapshot alongside core Project Map and TaskRun snapshots
- **AND** Trellis and repository-signal runtime candidates SHALL remain deferred until runtime entries are supplied

### Requirement: Provider Candidate Dispatch SHALL Persist The Task Projection First

系统 SHALL persist provider-derived candidate tasks before starting execution so review and closure remain traceable.

#### Scenario: dispatching a transient provider candidate

- **WHEN** user dispatches a task that came from provider snapshots and is not yet persisted in the local OrchestrationTask store
- **THEN** the system SHALL upsert the task projection before creating a TaskRun or sending a thread message
- **AND** the linked TaskRun SHALL reference the persisted orchestration task id
- **AND** review gate, archive, and linked run navigation SHALL remain available after dispatch

#### Scenario: projection persistence fails before dispatch

- **WHEN** the system cannot persist the provider candidate task projection
- **THEN** dispatch SHALL fail before agent execution starts
- **AND** the system SHALL NOT create a TaskRun that cannot be traced back to an OrchestrationTask
