# agent-task-center Specification

## Purpose
TBD - created by syncing Task Center phase-one changes. Update Purpose after archive.
## Requirements
### Requirement: Task Center SHALL Expose An Independent Task-Run Surface

系统 MUST 提供独立于 Kanban 的 `Task Center` surface，用于展示 task runs 的当前状态与详情，并且这些 runs MUST 能从真实 Kanban execution lifecycle 中生成与更新。

#### Scenario: task center lists active and recoverable runs

- **WHEN** workspace 中存在 running、waiting_input、blocked、failed 或 completed task runs
- **THEN** Task Center SHALL 在独立 surface 中列出这些 runs
- **AND** 用户 SHALL 无需逐个打开会话线程才能判断当前执行态

#### Scenario: task center keeps planning and execution surfaces separate

- **WHEN** 用户查看 Kanban task 与 Task Center run
- **THEN** Kanban SHALL 继续承担 planning 语义
- **AND** Task Center SHALL 承担 execution / observation / recovery 语义

#### Scenario: kanban launch creates task center run

- **WHEN** 用户或系统通过 Kanban manual、scheduled 或 chained trigger 启动任务执行
- **THEN** 系统 SHALL 创建对应 trigger 的 TaskRun
- **AND** TaskRun SHALL 绑定 task definition、workspace、engine 与可用 thread id

### Requirement: Task Center SHALL Surface Run Diagnostics Without Opening The Conversation

系统 MUST 在 Task Center 中直接呈现 run-level 诊断摘要，而不是把关键执行信息继续藏在线程内部。

#### Scenario: active run exposes execution progress summary

- **WHEN** 某次 run 处于 `queued`、`planning`、`running`、`waiting_input` 或 `blocked`
- **THEN** Task Center SHALL 直接展示 `plan snapshot`、`current step`、`latest output summary` 中的可用字段
- **AND** 用户 SHALL 无需先打开 conversation 才能理解该 run 当前推进到哪一步

#### Scenario: terminal run exposes diagnostic and artifact summary

- **WHEN** 某次 run 进入 `failed`、`blocked`、`completed` 或 `canceled`
- **THEN** Task Center SHALL 直接展示 `blocked / failure reason` 与 artifacts summary 的可用字段
- **AND** 缺失字段 SHALL 以显式 unavailable / empty 状态呈现，而不是伪装成成功无产物

#### Scenario: launch failure is visible as run diagnostic

- **WHEN** Kanban execution 在 workspace connection、thread creation 或 first message send 边界失败
- **THEN** TaskRun SHALL 进入 `failed` 并记录可读 failure reason
- **AND** Kanban latest run summary SHALL 投影同一 failure reason

### Requirement: Task Center SHALL Provide Bounded Recovery And Navigation Actions

Task Center MUST 在 run 级别提供有边界的恢复与跳转动作，并且这些动作必须接到现有 control path，而不是只停留在 UI 展示层。

#### Scenario: workspace task center routes open conversation through existing thread selection

- **WHEN** 某次 run 已绑定 conversation thread
- **THEN** 用户 SHALL 能从 Workspace Home 内的 Task Center 直接打开对应 conversation
- **AND** 该跳转 SHALL NOT 改写 run 自身状态

#### Scenario: retry and fork create successor execution through existing kanban launch path

- **WHEN** 用户对 settled run 发起 `retry` 或 `fork new run`
- **THEN** 系统 SHALL 复用既有 Kanban execution launch path 创建新的 execution attempt
- **AND** successor run SHALL 保留 parent lineage 或 fork trigger

#### Scenario: unsupported cancel path is explicitly bounded

- **WHEN** 当前 runtime control path 无法安全取消某条未激活 thread 的 run
- **THEN** Task Center SHALL 禁用该 `cancel` 动作或显式降级
- **AND** UI SHALL NOT 伪装为已成功取消

### Requirement: TaskRun details show Browser Snapshot v2 evidence
Agent Task Center SHALL display Browser Snapshot v2 evidence linked to a TaskRun, including source URL, title, capture time, freshness, summary, diagnostics, privacy state, and candidate code files when available.

#### Scenario: TaskRun has browser evidence
- **WHEN** a TaskRun includes Browser Snapshot v2 evidence
- **THEN** Task Center SHALL show the evidence in the run detail with available, stale, expired, or degraded state

#### Scenario: Browser evidence has code candidates
- **WHEN** linked browser evidence includes page-to-code candidates
- **THEN** Task Center SHALL display candidate file references with reason and confidence metadata

### Requirement: TaskRun evidence preserves browser context boundaries
Agent Task Center SHALL NOT display or persist raw DOM, cookies, headers, storage, password values, token values, or authorization secrets as TaskRun browser evidence.

#### Scenario: Evidence contains redacted fields
- **WHEN** Browser Snapshot v2 evidence includes redaction metadata
- **THEN** Task Center SHALL show redaction status without exposing redacted values

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
