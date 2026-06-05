# agent-task-run-history Specification

## Purpose
TBD - created by syncing Task Center phase-one changes. Update Purpose after archive.

## Requirements

### Requirement: Task Definition And Task Run SHALL Be Stored As Separate Concepts

系统 MUST 将任务定义与某次具体执行拆成两层模型，而不是把 run history 直接堆进单条 Kanban task。

#### Scenario: one task keeps multiple independent runs

- **WHEN** 同一 Kanban task 被多次手动触发、重试或调度执行
- **THEN** 系统 SHALL 为每次执行创建独立 `runId`
- **AND** 每次 run SHALL 保留自己的状态、时间戳与输出摘要

#### Scenario: task definition does not become run-history blob

- **WHEN** 系统持久化 task run history
- **THEN** run records SHALL 存放在独立 run store 或等价独立投影层
- **AND** 原始 task definition SHALL 不被迫承载无限增长的执行历史正文

### Requirement: Task Runs SHALL Keep Explicit Trigger And Lineage Metadata

每次 run MUST 明确记录触发来源与 lineage，而不是只保留当前状态。

#### Scenario: retry creates a successor run with parent linkage

- **WHEN** 用户对失败 run 执行 retry
- **THEN** 系统 SHALL 创建新的 run 记录
- **AND** 新 run SHALL 记录 `parentRunId` 或等价 lineage

#### Scenario: chained execution records upstream linkage

- **WHEN** 下游任务因上游成功而自动续跑
- **THEN** 系统 SHALL 创建新的 downstream run
- **AND** 该 run SHALL 记录 `upstreamRunId` 或等价来源链路

### Requirement: Task Runs SHALL Preserve Diagnosable Observability Fields

每次 run MUST 保留足以支撑 Task Center 诊断的核心可观测字段，而不是只记录最终状态。

#### Scenario: active run keeps progress snapshot

- **WHEN** 某次 run 进入 `planning`、`running`、`waiting_input` 或 `blocked`
- **THEN** run record SHALL 保留可用的 `planSnapshot`、`currentStep`、`latestOutputSummary` 或等价进度投影
- **AND** 缺失的 engine-specific 细节 MAY 留空，但 SHALL NOT 阻止 run 进入统一生命周期

#### Scenario: settled run keeps terminal diagnostics and artifacts

- **WHEN** 某次 run 进入 `failed`、`completed` 或 `canceled`
- **THEN** run record SHALL 保留可用的 `failureReason` / `blockedReason` / artifact summary
- **AND** 这些字段 SHALL 与该 run 的 `runId` 稳定绑定，而不是只保存在线程临时 UI 状态里

### Requirement: One Task Definition SHALL Have At Most One Active Run In Phase 1

Phase 1 中同一 task definition MUST 保持单任务单 active run，避免不同入口并发制造重复执行。

#### Scenario: duplicate trigger is blocked or focused to existing active run

- **WHEN** 同一 task definition 已存在 `queued`、`planning`、`running`、`waiting_input` 或 `blocked` run
- **AND** 用户再次执行 manual trigger，或系统尝试再次触发 scheduled execution
- **THEN** 系统 SHALL NOT 创建第二条 active run
- **AND** 系统 SHALL 返回 deterministic blocked / focus-existing outcome

#### Scenario: retry requires a settled parent and no competing active run

- **WHEN** 用户对某条失败或已结束的 run 执行 retry
- **AND** 同一 task definition 当前不存在其他 active run
- **THEN** 系统 SHALL 创建新的 successor run 并记录 `parentRunId`
- **AND** 若当前已存在其他 active run，系统 SHALL NOT 再创建额外 successor run

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
