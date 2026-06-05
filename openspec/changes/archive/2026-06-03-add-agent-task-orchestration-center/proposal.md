## Why

0.5.4 已经把 Project Map、TaskRun、workspace session catalog、SpecHub provider abstraction 和 runtime diagnostics 分别补到可用状态，但它们仍然是分散入口：Project Map 解释项目结构，TaskRun 展示某次执行，会话记录 AI 过程，SpecHub/治理模块只在项目具备对应规范系统时提供计划证据。用户缺少一个通用的项目级执行台来回答：下一步该做什么、这个任务来自什么证据、应该派给哪个会话/engine、执行结果是否需要验收。

0.5.5 的方向应该是通用客户端能力，而不是只服务某个仓库或某个人的 OpenSpec/Trellis 工作流。`Agent Task Orchestration Center` 应作为 provider-based orchestration core：核心只依赖 Project Map、manual task、TaskRun 和 session 等通用产品模块；OpenSpec、spec-kit、Trellis、package scripts、GitHub Actions 等只能作为检测到时启用的 optional providers。

## Universal Client Boundary

### 通用核心

- `Project Map / Project X-Ray`：项目证据、节点、风险、source refs 和 confidence/stale marker。
- `Manual task draft`：用户手动创建任务，不要求项目有任何规范目录。
- `TaskRun / Task Center`：一次 AI 执行记录、状态、诊断、恢复动作。
- `Workspace session catalog`：workspace 级会话事实和 linked conversation navigation。
- `SpecHub provider abstraction`：当项目存在 spec provider 时读取通用 spec/change/task 视图。

### Optional Providers

- `OpenSpec provider`：仅当 workspace 配置或文件结构检测到 OpenSpec 时启用。
- `spec-kit provider`：仅当 SpecHub 检测到 spec-kit 时启用。
- `Trellis provider`：仅当 `.trellis/tasks/**` 存在且 schema 可识别时启用；这属于 developer workflow adapter，不是客户端基础能力。
- `Repository governance provider`：package scripts、CI workflows、agent rule files 等只能提供上下文和建议，不得成为任务中心启动条件。

### 禁止边界

- 客户端核心 MUST NOT 要求用户项目存在 `openspec/**`、`.trellis/**`、`.codex/**`、`.claude/**` 或本仓库特定 release workflow。
- 客户端核心 MUST NOT 写入 OpenSpec/Trellis/agent-rule artifacts；写入类操作必须由对应 provider 显式声明能力并经用户确认。
- UI 文案 MUST NOT 暗示所有用户都使用 OpenSpec/Trellis。

## 目标与边界

### 目标

- 新增 `Agent Task Orchestration Center`，作为通用项目级 AI 工程调度台，聚合 Project Map、manual task、TaskRun、linked session，以及可选 provider candidates。
- 定义 provider-based `OrchestrationTask` projection：核心字段不硬编码 OpenSpec/Trellis，source 通过 `provider`、`kind`、`capabilities` 和 `refs` 扩展。
- 支持从 Project Map 节点创建任务草案，并保留 source evidence、node id、suggested scope、confidence/stale marker。
- 支持从 manual input 创建任务草案，让没有 Project Map 或规范系统的普通项目也能使用任务中心。
- 支持从可选 spec/workflow providers 读取 candidate，但 provider 缺失时中心仍可完整工作。
- 支持人工可控的任务派发：用户选择 task draft、engine、workspace/thread strategy 后，才创建或复用 TaskRun。
- 提供任务状态矩阵：`candidate`、`planned`、`ready`、`running`、`waiting_input`、`blocked`、`review_needed`、`completed`、`archived`。
- 把 `open conversation`、`open source`、`open files`、`retry`、`create follow-up`、`archive` 作为 bounded actions，禁止 UI 伪造执行成功。

### 边界

- MVP 不引入自动 agent 调度黑箱；所有执行派发必须由用户确认。
- MVP 不引入 remote worker fleet、云端队列、多人协作权限系统或 server-side scheduler。
- MVP 不重写现有 Kanban / Task Center / Project Map / SpecHub；只新增 orchestration projection 和有限桥接动作。
- MVP 不自动修改 provider source artifacts；如需创建或更新 spec/task/rule，必须由 provider 显式 action 处理并确认。
- MVP 不承诺完全理解所有项目任务，只基于可读 artifact、项目证据和用户确认创建任务草案。
- MVP 不新增复杂 agent graph editor；跨任务依赖先用简单 parent/child/linkage 表达。

## 非目标

- 不做通用 Jira / Linear 替代品。
- 不做全自动“读取项目后自己开工”的 autonomous agent mode。
- 不把 Project Map 变成可编辑流程图。
- 不把 OpenSpec/Trellis/spec-kit 状态双向同步做成后台 watcher。
- 不为每个 engine 定制不同 UI；engine-specific telemetry 只能在统一模型下做降级展示。
- 不把本仓库 `.trellis`、OpenSpec archive、release gate、中文提交规范或 session record 流程做成客户端默认行为。

## What Changes

- 新增 `Agent Task Orchestration Center` surface：
  - 左侧任务队列：按 status、source provider、source kind、engine、workspace、risk marker 过滤。
  - 中央任务详情：展示目标、来源证据、执行计划、linked artifacts、linked sessions、run history。
  - 右侧 action rail：派发、打开会话、打开 source、打开 Project Map 节点、创建 follow-up、归档。
- 新增 provider-based `OrchestrationTask` projection model：
  - 来源可以是 `project_map_node`、`manual`、`task_run`、`spec_change`、`workflow_task`、`repository_signal` 等通用 kind。
  - 来源 provider 可以是 `core`、`project_map`、`manual`、`task_run`、`spec:openspec`、`spec:speckit`、`workflow:trellis`、`repo:generic` 等可扩展字符串。
  - 记录 `sourceRefs`、`evidenceRefs`、`scopeSummary`、`acceptanceSummary`、`linkedRunIds`、`linkedSessionIds`。
  - 与现有 `TaskRun` 分层：OrchestrationTask 表达“该推进什么”，TaskRun 表达“某次执行怎么跑”。
- Project Map 增加 “Create Task” bridge：
  - 从节点生成任务草案，不直接启动执行。
  - 草案必须带 source node、evidence files、confidence/stale marker。
  - stale/low-confidence 节点创建的任务必须显式标记风险。
- Manual task 增加 MVP 入口：
  - 用户可以在没有 Project Map、OpenSpec、Trellis 的 workspace 中创建任务草案。
  - manual draft 必须由用户填写 scope 和 acceptance，不能虚构来源证据。
- Optional provider ingestion：
  - SpecHub provider 可读取 OpenSpec/spec-kit 的通用 change/task summary。
  - Trellis provider 可读取 `.trellis/tasks/**`，但必须是 optional adapter。
  - malformed/missing provider artifact 降级为 `unknown/degraded`，不能阻塞整个中心打开。
- Task Center / TaskRun 增加 orchestration linkage：
  - run 可以绑定 orchestration task id。
  - run 完成后，orchestration task 进入 `review_needed`，等待用户确认产物是否满足 acceptance。
  - retry/follow-up 必须保留 parent task/run lineage。
- Workspace/session 增加聚合入口：
  - 从任务详情可以打开 linked conversation。
  - 从 session/run 可以反查所属 orchestration task。
  - session membership 仍由 workspace catalog 维护，任务聚合不得污染 session catalog 真值。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 继续加强现有 Task Center，只展示更多 run/session 信息 | 改动最少，复用当前模型 | 仍然是 execution list，无法承载“下一步工作项”心智 | 不采用 |
| B | 新增 provider-based `Agent Task Orchestration Center` core，核心聚合 Project Map/manual/TaskRun/session，可选 provider 只在检测到时补充 candidates | 通用性强；普通项目可用；OpenSpec/Trellis 不污染核心；MVP 可控 | 需要定义 provider abstraction 和 source normalization | **采用** |
| C | 直接以 OpenSpec/Trellis 为中心做 AI workflow workbench | 对本仓库效率最高 | 会把客户端绑定到个人/项目治理栈，普通用户不可用 | 不采用 |
| D | 直接做 autonomous multi-agent scheduler，自动从 Project Map 生成任务并并行执行 | 长期想象力最大 | 风险高、误触发成本高、需要权限/队列/冲突控制，当前基础不够 | 本期不采用 |

## Capabilities

### New Capabilities

- `agent-task-orchestration-center`: 通用项目级任务编排中心，覆盖 provider-based orchestration task projection、source linkage、manual/project-map task draft、人工派发、review/closure workflow 和统一任务详情。

### Modified Capabilities

- `agent-task-center`: 现有 run center 需要支持 orchestration task linkage，并把 run completion 投影为 orchestration review state。
- `agent-task-run-history`: TaskRun 需要支持 non-Kanban orchestration linkage，保留 orchestration task id、source lineage 和 follow-up/retry 关系。
- `project-xray-panel`: Project Map 节点需要提供 create-task bridge，并把 node evidence/stale/confidence 带入任务草案。
- `spec-hub-workbench-ui`: SpecHub 需要提供 provider-neutral change/task candidate summary 给 Orchestration Center；OpenSpec/spec-kit 均应走该抽象。
- `openspec-trellis-status-panel-bridge`: 现有治理证据 bridge 只作为 optional governance/workflow provider，不得成为 Orchestration Center 的核心依赖。
- `workspace-session-catalog-projection`: workspace 聚合需要把 task/session/run 关联作为独立 projection 暴露，不改变 session membership 真值。

## 验收标准

- 用户 MUST 能在没有 OpenSpec、Trellis、spec-kit 的普通 workspace 中打开 `Agent Task Orchestration Center`，创建 manual task draft，并派发到支持的 engine。
- 用户 MUST 能在有 Project Map 的 workspace 中从节点创建任务草案；草案 MUST 保留 node id、source evidence、confidence/stale marker 和 scope summary。
- 用户 MAY 在检测到 OpenSpec/spec-kit/Trellis 时看到 provider candidates；provider 不存在时 UI MUST 显示为 unavailable/empty，而不是错误或缺功能。
- 用户 MUST 在确认 engine、workspace/thread strategy 和 prompt summary 后才能启动任务；系统 MUST NOT 从 Project Map、SpecHub 或 workflow provider 自动启动 agent。
- 每个 OrchestrationTask MUST 能关联 0..n TaskRuns、0..n linked sessions、0..n source artifacts。
- TaskRun 完成后，对应 OrchestrationTask MUST 进入 `review_needed` 或等价待验收状态，而不是自动宣称需求完成。
- malformed provider artifact MUST 降级为可解释状态，不能导致整个中心崩溃。
- Task Center 中的 run MUST 能反查所属 OrchestrationTask；Orchestration Center 中的 task MUST 能打开 linked conversation/run。
- Orchestration core MUST NOT 自动修改 `openspec/**`、`.trellis/**`、`.codex/**`、`.claude/**` 或其他 provider artifacts；任何写入类动作必须由 provider 显式声明并经用户确认。
- MVP MUST 通过 `openspec validate add-agent-task-orchestration-center --strict --no-interactive`。
- 实现阶段至少需要通过 focused UI/store tests、`npm run typecheck`；若触及 Tauri/Rust storage 或 session backend，必须运行 `cargo test --manifest-path src-tauri/Cargo.toml`。

## Impact

- Frontend:
  - 可能新增 `src/features/agent-orchestration/**` 或扩展 `src/features/tasks/**`。
  - 影响 `src/features/project-map/**` 的 node action bridge。
  - 影响 `src/features/spec/**` 的 provider-neutral candidate export。
  - 影响 `src/features/governance/**` 或 workflow evidence reader 的 optional provider 消费方式。
  - 影响 `src/features/threads/**` / `src/features/session-activity/**` 的 linked session navigation。
- Storage / projection:
  - 新增 workspace-scoped local-first orchestration task projection store。
  - 复用现有 TaskRun store，但需要扩展 non-Kanban linkage。
  - 读取 optional providers 时保持 read-only。
- Behavior:
  - 增加从“项目证据/手工任务/provider candidate”到“执行任务”的人工确认路径。
  - 增加执行完成后的 review/closure gate。
- Specs:
  - 新增 `agent-task-orchestration-center`。
  - 修改 `agent-task-center`、`agent-task-run-history`、`project-xray-panel`、`spec-hub-workbench-ui`、`openspec-trellis-status-panel-bridge`、`workspace-session-catalog-projection`。

## 2026-06-03 Manual QA Corrections

Manual QA of the Project Map work queue found three product-contract gaps:

- Dispatch feedback was not anchored to the current work item. After confirmation, the selected item could leave the active filter and the detail pane silently switched to another task.
- Queue status was too coarse. User-facing state must reflect the real linked TaskRun lifecycle, not only orchestration task intent.
- Review Gate could appear without execution evidence. A task with `0 run / 0 session` must not be reviewable.

Additional acceptance constraints:

- Dispatch confirmation MUST preserve the currently selected Project Map work item in the detail pane, even if its status changes and it leaves the current filter.
- Queue status MUST be derived from the latest linked TaskRun when available:
  - `queued` / `planning` -> `queued`
  - `running` / `waiting_input` / `blocked` -> `running`
  - `failed` -> `failed`
  - `completed` -> `review`
  - `canceled` -> `todo`
- Queued dispatches MAY be canceled before runtime start; cancellation MUST mark the TaskRun canceled and keep the orchestration task available for retry.
- Running dispatches MUST expose a linked session/open-session action when a linked thread id exists.
- Review Gate MUST require at least one completed linked TaskRun. Orphan review intent without linked execution evidence MUST be shown as a diagnostic and corrected back to `planned` / `not_started` by lifecycle projection, except archived tasks.

## Code-First Calibration - 2026-06-03

本节按当前代码事实校准提案边界，避免 OpenSpec artifacts 继续描述尚未接入的能力。

### Current Runtime Surface

当前实际用户可见 surface 是 `Project Map Work Queue`，由 `OrchestrationCenterView` 渲染并挂在 Project Map 面板切换路径下。它不是一个已经完全独立、provider 全量接入的通用 `Agent Task Orchestration Center`。

当前 runtime 主链路是：

```text
Project Map node candidates
  -> local OrchestrationTask projection
  -> explicit dispatch gate
  -> TaskRun / thread message path
  -> linked run lifecycle projection
  -> review gate
  -> local archive
```

### Current Code Facts

- `src/features/agent-orchestration/**` 已存在 domain types、local store、Project Map provider、TaskRun provider、dispatch、review、navigation events 与 UI。
- `src/features/layout/hooks/useLayoutNodes.tsx` 当前把 core Project Map/TaskRun snapshots 接入 runtime UI；2026-06-03 implementation pass 已补上 SpecHub snapshot wiring，并允许有 workspace id 但没有 Project Map dataset 的 plain workspace 打开 Work Queue。
- `createManualOrchestrationTaskDraft` 已实现为 pure provider utility；2026-06-03 implementation pass 已补上用户可见 manual task creation control，创建结果只写 local OrchestrationTask store，不伪造 evidence refs。
- `readSpecHubOrchestrationCandidates`、`readTrellisOrchestrationCandidates`、`readRepositorySignalOrchestrationCandidates` 已实现并有 focused tests；runtime UI 当前只接入 SpecHub optional provider，Trellis 和 repository-signal runtime wiring 仍 deferred。
- Project Map provider 当前会从 dataset 所有 nodes 派生 candidates；这更像 `Project Map Work Queue` 的全图候选投影，而不是经过用户挑选后的任务列表。
- Dispatch path 已通过 app shell 接入真实 thread/message flow，会创建 TaskRun、发送 orchestration prompt，并 patch TaskRun / OrchestrationTask 状态。
- 2026-06-03 implementation pass 已收口 provider candidate dispatch 持久化风险：transient provider candidate 会先 upsert 到 local `OrchestrationTask` store，再创建 TaskRun / 发送 thread message。

### Scope Correction

本 change 的当前真实范围应收敛为：

- Project Map evidence / candidate 到 `OrchestrationTask` 的 local-first projection。
- 用户显式 dispatch gate 到现有 TaskRun/thread 执行路径。
- TaskRun lifecycle 到 orchestration status/review state 的投影。
- Review gate：completed run 只进入 `review_needed`，必须人工 accept 才能完成 task。
- Local archive：隐藏 task projection，不删除 Project Map、TaskRun、session 或 provider source artifacts。

以下能力应标记为 deferred 或后续 change，而不是当前已完成能力：

- 用户可见的 manual task 创建 UI。
- SpecHub / Trellis / repository signal optional providers 的 runtime UI 接入。
- provider 写回 OpenSpec/Trellis/spec-kit/agent-rule artifacts。
- autonomous scheduler 或多 agent 自动派发。

### Relationship To Understand-Anything Research

Understand-Anything 的 graph primitives 已由 Project Map 系列 completed changes 承载，包括 relation graph、guided tour、path finder、impact overlay、Evidence Files、staleness/repair 和 focused tests。

本 change 不再继续承载 Project Map graph capability expansion；它只负责把已存在的 Project Map evidence-backed understanding 接到 work queue、TaskRun 和 review gate。

## Implementation Addendum - 2026-06-03

The calibrated 8.7-8.9 pass updates the current runtime boundary:

- Provider candidates are persisted before dispatch so TaskRun lineage, review gate, and archive remain traceable.
- Manual task creation is now available in the Project Map Work Queue as a local-only task source with no invented evidence.
- SpecHub provider candidates are wired into runtime snapshots. Trellis and repository-signal candidates remain deferred because the current layout layer does not yet provide their provider input entries.
