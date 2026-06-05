## Context

当前客户端已经具备五块相邻能力：

- `Project Map / Project X-Ray`：从项目证据生成知识节点、风险节点、候选节点和 evidence-backed inspector。
- `Task Center / TaskRun`：表达一次 AI 执行记录、运行状态、诊断与恢复动作。
- `workspace session catalog`：按 workspace 聚合会话事实，并维持 session membership 的真值边界。
- `SpecHub`：以 provider abstraction 方式支持 OpenSpec / spec-kit / unknown provider。
- `governance evidence adapters`：按 workspace profile 检测 OpenSpec、Trellis、scripts、workflows 等可选治理信号。

设计原则必须反过来：不是因为当前 mossx 仓库有 OpenSpec/Trellis，所以任务中心默认围绕它们建模；而是任务中心先是通用客户端能力，再通过 optional providers 接入 OpenSpec、spec-kit、Trellis 或其他项目工作流。普通用户打开一个没有任何规范目录的项目，也必须能创建 manual task、从 Project Map 派生任务、运行 AI、审查结果。

## Goals / Non-Goals

**Goals:**

- 定义 provider-based `OrchestrationTask`，统一表达来自 Project Map、manual input、TaskRun/session 和 optional providers 的工作项。
- 新增独立任务编排中心 UI，支持 queue/detail/action 三段式工作流。
- 提供 Project Map node -> task draft bridge，保留证据链、confidence 和 stale marker。
- 提供 manual task draft 入口，保证无 spec/workflow provider 的普通项目可用。
- 通过 SpecHub provider abstraction 读取 OpenSpec/spec-kit candidates；通过 workflow provider abstraction 读取 Trellis 等可选任务。
- 将 OrchestrationTask 与 TaskRun/session 双向导航打通，但不改变 TaskRun 和 session catalog 的真值归属。
- 增加 review gate：执行完成后必须进入人工验收状态，不能自动宣称任务完成。

**Non-Goals:**

- 不做 autonomous scheduler。
- 不新增 remote worker / cloud queue。
- 不做 OpenSpec/Trellis/spec-kit 双向同步 watcher。
- 不重写 Kanban、Task Center、Project Map 或 SpecHub。
- 不把本仓库 `.trellis`、OpenSpec archive、release gate、中文提交规范或 session record 流程做成客户端默认行为。

## Decisions

### 1. Source model 采用 provider-based abstraction

#### 决策

新增 `OrchestrationTask`，source 不硬编码具体工具目录，而是通过 provider/kind/capabilities 扩展：

```ts
type OrchestrationTaskStatus =
  | "candidate"
  | "planned"
  | "ready"
  | "running"
  | "waiting_input"
  | "blocked"
  | "review_needed"
  | "completed"
  | "archived";

type OrchestrationSourceKind =
  | "project_map_node"
  | "manual"
  | "task_run"
  | "spec_change"
  | "workflow_task"
  | "repository_signal"
  | "file";

type OrchestrationProviderId =
  | "core:manual"
  | "core:task-run"
  | "project-map"
  | "spec:openspec"
  | "spec:speckit"
  | "workflow:trellis"
  | "repo:generic"
  | (string & {});

type OrchestrationProviderCapability =
  | "read_candidates"
  | "open_source"
  | "create_task"
  | "dispatch"
  | "write_back";

type OrchestrationSourceRef = {
  providerId: OrchestrationProviderId;
  kind: OrchestrationSourceKind;
  id: string;
  label: string;
  path?: string;
  workspaceRelativePath?: string;
  confidence?: "high" | "medium" | "low" | "unknown";
  stale?: boolean;
  capabilities: OrchestrationProviderCapability[];
};

type OrchestrationTask = {
  taskId: string;
  workspaceId: string;
  title: string;
  status: OrchestrationTaskStatus;
  sourceRefs: OrchestrationSourceRef[];
  evidenceRefs: OrchestrationSourceRef[];
  scopeSummary: string;
  acceptanceSummary: string;
  promptSummary?: string;
  preferredEngine?: "codex" | "claude" | "gemini";
  threadStrategy: "new_thread" | "reuse_active_thread" | "choose_thread";
  linkedRunIds: string[];
  linkedSessionIds: string[];
  parentTaskId?: string;
  createdAt: string;
  updatedAt: string;
  reviewState?: "not_started" | "needs_review" | "accepted" | "changes_requested";
};
```

#### 原因

- `openspec_change` / `trellis_task` 作为 source kind 会把客户端锁死到当前仓库工作流。
- 现有代码已经有 `SpecProvider` 和 profile-aware governance adapters，Orchestration Center 应复用这个方向。
- provider-based model 允许普通项目、spec-kit 项目、OpenSpec 项目、Trellis 项目都走同一个 UI/状态模型。

#### 备选方案

- 硬编码 OpenSpec/Trellis source：对 mossx 高效，但产品不可通用，不采用。
- 只支持 manual task：通用但浪费 Project Map/TaskRun/SpecHub 底座，不采用。

### 2. P0 输入源限定为通用核心，OpenSpec/Trellis 降级为 optional providers

#### 决策

P0 MVP 输入：

- manual task draft
- Project Map node draft
- existing TaskRun/session links

P1/P2 optional provider：

- SpecHub provider candidates：OpenSpec、spec-kit、unknown/degraded。
- Workflow provider candidates：Trellis、repo scripts、CI workflows、agent-rule files。

Provider 缺失时，中心正常工作；provider 可用时，显示 candidates 和 source navigation。

#### 原因

通用客户端不能要求所有用户项目都有 `.trellis` 或 `openspec`。这些是能力增强，不是启动条件。

### 3. UI 采用 queue / detail / action rail

#### 决策

MVP UI 采用三段式：

- Queue：任务列表、source provider、source kind、status、engine、workspace、risk filters。
- Detail：目标、scope、acceptance、source evidence、linked runs、linked sessions、activity。
- Action rail：create manual task、dispatch、open conversation、open source、open map node、create follow-up、archive。

#### 原因

任务编排中心解决“下一步该推进什么”，列表和详情比 board/graph 更适合跨来源聚合。Kanban 继续承担 planning，Project Map 继续承担 graph。

### 4. Provider ingestion 默认 read-only，写入必须声明能力

#### 决策

所有 provider reader 都必须满足：

- 缺失或 malformed artifact 返回 degraded candidate。
- 不写 provider source artifacts。
- 不把 provider 不存在当成错误。

写入类 action 必须满足：

- provider 显式声明 `write_back` capability。
- UI 展示将写入的 provider、文件或目标。
- 用户确认后才执行。

MVP 不实现 OpenSpec/Trellis 写回，只提供 disabled/future action 或打开对应工作流。

#### 原因

OpenSpec/Trellis/agent-rule 文件是项目治理资产，后台自动写入会制造漂移和误操作。

### 5. TaskRun 需要从 Kanban-only 扩展到 orchestration linkage

#### 决策

当前 TaskRun 的 `TaskRunDefinitionRef.source` 只有 `"kanban"`。本变更实现前必须新增兼容扩展：

- 保留 existing Kanban runs。
- 新增 `source: "orchestration"` 或更通用 `source: "kanban" | "orchestration"`。
- 新增 optional `orchestrationTaskId`。
- normalization 必须兼容旧记录。

#### 原因

否则从 Orchestration Center dispatch 的 run 会被伪装成 Kanban task，破坏模型语义。

### 6. Review gate 是闭环核心

#### 决策

TaskRun terminal status 映射：

- run `completed` -> orchestration task `review_needed`
- run `failed` -> task `blocked`
- run `canceled` -> task `planned` 或 `blocked`
- run `waiting_input` -> task `waiting_input`

用户验收：

- `Accept result` -> task `completed`
- `Request changes` -> 创建 follow-up task 或 successor run
- `Archive` -> task `archived`

#### 原因

LLM run 完成不等于需求完成。通用客户端必须把“执行结束”和“人类验收”分开。

### 7. Storage 采用 workspace-scoped local-first projection

#### 决策

MVP 优先使用 workspace-scoped local projection：

- orchestration task records 按 workspace identity 分桶。
- source ingestion cache 可重建，不作为真值。
- linked run/session ids 只保存稳定 id，不复制完整 run/session payload。
- path 保存 workspace-relative 或 normalized ref，不以个人绝对路径作为展示主键。

若后续需要跨进程稳定性，再拆 Phase 2 Rust/Tauri store。

#### 原因

0.5.5 MVP 的核心价值在 projection/UX/flow，不在新 backend store。workspace-scoped 能避免不同项目之间串任务。

## Risks / Trade-offs

- [Risk] provider abstraction 增加第一期设计复杂度。
  → Mitigation：P0 只实现 manual/project-map/task-run providers，SpecHub/Trellis 作为 optional adapters 分阶段接入。

- [Risk] projection model 可能和现有 Task Center 概念重叠。
  → Mitigation：明确 OrchestrationTask 是“工作项”，TaskRun 是“执行记录”；UI 文案也按此区分。

- [Risk] 多 provider ingestion 会带来 schema drift。
  → Mitigation：每个 provider 独立 degraded；中心允许 partial source，不阻塞整体加载。

- [Risk] 用户误以为 task completed 等于 spec archived。
  → Mitigation：引入 `review_needed` gate，并明确 provider write-back 需要单独 action。

- [Risk] 从 Project Map 创建任务时把低置信推断变成执行目标。
  → Mitigation：source confidence/stale 必须进入 task draft 和 UI chip；low/unknown 禁止默认进入 ready。

## Migration Plan

1. 新增 provider-based OrchestrationTask types 和 workspace-scoped store。
2. 实现 manual/project-map/task-run P0 providers。
3. 新增 Orchestration Center UI shell。
4. 接入 dispatch confirmation，并扩展 TaskRun non-Kanban linkage。
5. 接入 review gate 和 follow-up action。
6. 接入 SpecHub optional provider candidates。
7. 接入 Trellis/workflow optional provider candidates。
8. 完成 focused tests、typecheck、OpenSpec strict validation。

Rollback：

- UI 入口可 feature-flag 或隐藏。
- local orchestration store 可保留但不读取，不影响 Project Map、SpecHub、TaskRun 或 session 真值。
- 因 MVP 不自动写 provider artifacts，回滚不会污染项目文件。

## Open Questions

- 入口放在 Workspace Home、right panel toolbar，还是沿用现有 Task Center 入口升级文案？建议实现前做一次 UI inventory。
- OrchestrationTask store 是否直接复用 `clientStorage("app")` 的 workspace partition，还是放到 project-scoped storage？建议 MVP 选择 workspace-scoped app storage。
- SpecHub candidate summary 是否已有足够 provider-neutral 字段，还是需要新增 narrow export API？实现前需要代码级确认。

## 2026-06-03 Scope correction: simplify to Project Map work queue

Manual QA showed the original Orchestration Center surface was too close to an execution backend while the real TaskRun/session runtime path was not fully observable. The surface must not expose internal provider lifecycle states as user-facing workflow.

Decision:

- Present the surface as a Project Map work queue, not a full AI orchestration backend.
- Collapse user-facing status around operator-visible work states: `todo`, `queued`, `running`, `failed`, `dispatched`, `review`, `done`, and `archived`.
- Treat active internal states without `linkedRunIds` as `todo` and show a missing-run warning instead of `running`.
- Render only actions with real targets. Do not show disabled `open run`, `open session`, or provider write-back placeholders.
- Dispatch action sends the item to Task Center through the existing TaskRun path directly; configuration UI is removed until a real runtime/session selection contract exists.
- Keep Project Map as the evidence/navigation source. Task Center remains the execution surface.

This correction aligns the work with the Understand-Anything study: Project Map should prioritize search, node focus, evidence files, guided tour, typed relations, path finding, and impact overlays over premature execution-center complexity.

### Queue selection contract

The queue list and the detail pane have different ownership:

- Queue list visibility is filter-driven.
- Detail selection is user-intent-driven.

After dispatch confirmation, the selected task MUST remain selected in the detail pane. If the selected task leaves the current filter because its status changed, the UI SHOULD show an inline "selection preserved" notice instead of silently selecting the first visible queue item.

### TaskRun-derived status contract

The queue MUST derive dispatch state from linked TaskRun records when available:

- latest linked run `queued` or `planning` -> queue status `queued`
- latest linked run `running`, `waiting_input`, or `blocked` -> queue status `running`
- latest linked run `failed` -> queue status `failed`
- latest linked run `completed` -> queue status `review`
- latest linked run `canceled` -> queue status `todo`

Task intent fields such as `review_needed` are not enough to show Review Gate. They are hints only unless backed by a completed linked run.

### Review Gate evidence contract

Review Gate is only valid when there is a completed linked TaskRun. A task that says `review_needed` but has no linked run/session is an orphan review intent. The UI MUST show a diagnostic and MUST NOT expose accept/request-changes/create-follow-up actions for that task.

Lifecycle projection MUST correct orphan review intent to `planned` / `not_started` so stale local records do not keep reappearing as reviewable work. Archived tasks are excluded from this correction.

### Cancellation contract

Queued dispatch cancellation is a local lifecycle action before runtime start:

- TaskRun becomes `canceled`.
- Orchestration task returns to `planned`.
- Historical linked run id remains readable for traceability.
- The selected task remains selected and can be dispatched again.

## 2026-06-03 Navigation correction: inline Run/session management

Manual QA showed that opening a linked Run by navigating to Workspace Home / Task Center breaks the Project Map work-queue mental model and exposes a separate page that feels clipped and unrelated.

Decision:

- Do not navigate away from the Project Map work queue when inspecting linked Runs.
- Render linked TaskRun records inline inside the selected queue item's detail panel.
- Put session actions inside the inline Run card. If the TaskRun has no `linkedThreadId`, show a clear "no linked session" state instead of a disabled button.
- Keep Task Center available as a separate workspace surface, but do not use it as the default Project Map queue Run inspector.

This keeps the flow aligned with the Understand-Anything-inspired interaction model: stay in the graph/detail context, inspect related execution evidence locally, and only jump to a real conversation when a real session exists.

## 2026-06-03 Code reality calibration

当前代码事实要求继续收窄 design 边界。

### Actual surface

当前实现应被视为 `Project Map Work Queue`，不是完整独立的通用 agent orchestration backend。它从 Project Map context 进入，以 Project Map candidates 和 persisted orchestration tasks 为主要工作项来源。

### Manual task UI is implemented locally

`createManualOrchestrationTaskDraft` 已存在；2026-06-03 implementation pass 已在 Work Queue 中补上用户可见 manual task creation control。该入口只创建 local manual `OrchestrationTask`，不写 Project Map、OpenSpec、Trellis、spec-kit 或 repository artifacts，也不伪造 evidence refs。

Design decision:

- 保留 manual provider utility。
- 将 manual task UI 视为当前 Work Queue 的 local-only input source。
- Plain workspace 可以通过 manual UI 创建 local task draft，但仍必须通过 explicit dispatch gate 才能启动 TaskRun。

### Optional providers are partially wired

SpecHub、Trellis、repository-signal provider readers 已实现。2026-06-03 implementation pass 已将 SpecHub snapshot 注入 `OrchestrationCenterView.providerSnapshots`；Trellis 与 repository-signal 仍缺少明确 runtime entries，因此保持 deferred。

Design decision:

- 保留 optional provider readers 和 focused tests。
- 将 SpecHub runtime wiring 视为当前完成能力。
- 将 Trellis / repository-signal runtime provider wiring 标记为 deferred，除非后续任务显式提供 runtime inputs。
- 文档不得宣称用户当前能在 UI 中看到 Trellis/repository-signal candidates。

### Provider candidate dispatch persistence

Provider snapshots 派生出的 candidates 可能是 transient objects，并不一定存在于 local `OrchestrationTask` store。Dispatch 前必须先 upsert candidate projection，否则 `patchOrchestrationTask` 可能找不到 task，导致 TaskRun 已创建但 OrchestrationTask review/closure 链路断开。

Design decision:

- Dispatch confirmation 不得只依赖 transient candidate object。
- Dispatch flow MUST persist/upsert selected provider candidate before TaskRun creation or thread message send.
- Persist failure MUST abort dispatch before agent execution starts.
- Persisted projection 仍不得写回 Project Map、OpenSpec、Trellis、spec-kit 或 agent rule artifacts。

### Understand-Anything borrowed graph capabilities are out of this change

Relation graph、guided tour、path finder、impact overlay、Evidence Files、staleness/repair 和 Project Map focused tests 已由独立 Project Map changes 承载并完成。本 change 只负责 execution bridge：Project Map evidence/candidate -> OrchestrationTask -> TaskRun/session -> review gate。

## 2026-06-03 Implementation addendum for 8.7-8.9

This pass implements the calibrated scope as follows:

- Provider candidate dispatch is hardened at the dispatch boundary: the selected task projection is upserted into the local OrchestrationTask store before TaskRun creation and before app-shell status patching.
- Manual task UI is now in scope for the Project Map Work Queue. The form creates a local manual OrchestrationTask with title, scope, acceptance, optional prompt, and preferred engine. It does not create evidence refs and does not write provider artifacts.
- SpecHub optional provider runtime wiring is now in scope: layout builds a SpecHub workspace snapshot and passes the resulting provider snapshot into the Work Queue. Trellis and repository-signal providers remain implemented utilities/tests only until a future runtime input source is wired.
