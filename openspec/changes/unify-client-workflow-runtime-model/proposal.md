## Why

客户端已经有 New Home、Composer、Messages、TaskRun、Task Center、Orchestration Center、Project Map、Browser Evidence、Context Ledger 等能力，但此前 P0 把“运行态可见性”放到 HomeChat 上，产品假设不成立。

HomeChat 是低留存入口：用户通常从这里发起对话，随后停留在 Sidebar 会话列表、Conversation、Project Map 或具体执行上下文里。把 workspace-level active runs / recent runs / artifacts 放到 HomeChat，会带来三个问题：

- 信息太多，削弱创建入口；
- 数据不完整时容易不准确；
- 用户很少停留在这个页面，dashboard 投入产出低。

因此 P0 改为：

```text
HomeChat 保持 creation-first
  -> 用户发起对话
  -> Sidebar/Conversation 在真实会话上下文里显示运行态
  -> Run Detail 解释进度、失败、产物、证据
  -> Task Center / task draft 入口等任务模块重构后再开放
```

P0 的目标不是在首页做一个大 dashboard，而是让运行态出现在用户真正工作的地方。

## What Changed

- 将 New Home (`HomeChat`) 收敛为 creation-first 入口：workspace identity、engine identity、composer、recent conversations。
- 移除 HomeChat 的 run cockpit/dashboard：不在首页展示 active runs、attention runs、recent runs 或 artifacts。
- Sidebar 会话行只展示已有 thread activity state 的低噪状态提示，不推断 unlinked TaskRun。
- Conversation 保留 linked-run indicator：只有 active conversation 明确 linked 到 TaskRun 时才显示。
- `RunDetailSurface` 保留为共享解释面：状态、步骤、输出、诊断、产物、证据、关联对话。
- Task Center / task draft / Project Map create-task / Orchestration dispatch 入口继续隐藏，等待任务模块重构。
- TaskRun 仍是客户端执行 truth source；不得新增第二套 run lifecycle store 或 status enum。
- AppShell/layout 只做接线，业务推导留在 feature-local helpers/components。

## Capability Positioning

This change is an umbrella integration change. It does not replace existing TaskRun, Task Center, Orchestration, runtime telemetry, or browser evidence capabilities.

Existing capability truth remains in:

- `agent-task-center`
- `agent-task-run-history`
- `agent-task-orchestration-center`
- `runtime-orchestrator`

This change owns the cross-surface product integration:

- HomeChat creation-first composition.
- Contextual runtime visibility in Sidebar and Conversation.
- Shared run detail experience across Conversation, Task Center internals, and Orchestration links.
- User-facing status language and visual hierarchy.
- Source routing rules that decide how each entry surface reaches existing TaskRun truth.
- Workspace Home terminology migration from older specs to current `HomeChat` implementation entry.

## User-Facing Outcome

P0 完成后，用户应该有明显感知：

- 打开 New Home 后看到的是干净的创建入口，而不是噪音 dashboard。
- Sidebar 会话行能提示当前会话是否正在运行或复核。
- Conversation 能显示它与某次明确 linked run 的关系。
- 每个 linked run 能打开详情，看清状态、失败原因、产物、关联对话、上下文和证据。
- Task Center/task draft 不再以未成熟入口打断用户；相关能力等任务模块重构后再开放。
- 用户不需要理解 `TaskRun`、`OrchestrationTask`、`thread`、`session` 这些内部词，只看到对话、运行、产物、证据。

## Scope

### In Scope

- HomeChat 降噪和 creation-first 信息架构收敛。
- 移除 HomeChat run cockpit/dashboard、recent artifacts、run detail embedding。
- Sidebar 会话行的低噪运行态提示，来源仅限已有 thread activity state。
- Conversation 与 run 的互链：从对话能看到关联 run，从 run 能打开对话。
- Run Detail surface 的信息结构和视觉设计。
- Context Ledger / Browser Evidence / source refs 在 run detail 中的解释层设计。
- 状态视觉体系：queued、planning、running、waiting_input、blocked、failed、completed、canceled。
- 空态、加载态、错误态、无证据态、无对话态、无产物态。
- P0 级 AppShell/layout 边界收敛：避免新增业务规则继续集中膨胀，但不在本提案内完成 AppShell 深拆。
- Focused tests、typecheck、lint 和 OpenSpec validation。

### Out Of Scope

- 不复活或重做废弃 `WorkspaceHome`。
- 不在 HomeChat 上做 workspace-level run dashboard。
- 不把 Project Map / Browser Dock / Kanban / SpecHub 全部重写。
- 不把 Context Ledger 改造成全局知识库；P0 只要求作为 run/session 级解释层出现。
- 不强制新增后端持久化协议。
- 不在 P0 内解决所有历史数据迁移问题。
- 不新增一套平行的 TaskRun view model；应优先扩展现有 `src/features/tasks/utils/taskRunSurface.ts`。
- 不在 P0 内完成 AppShell 编排深拆；runtime、task/run、navigation、context 四类 action 的系统化拆分应新开架构提案。
- 不在 P0 内拆分 `useThreads` runtime；`sessionLifecycleController`、`messageRuntimeController` 属于后续线程运行时治理提案。
- 不在 P0 内消除核心 `@ts-nocheck`；`app-shell.tsx`、`useAppShellSections.ts`、`renderAppShell.tsx` 的类型化清理应作为独立安全门提案推进。

## Impact

### Affected frontend areas

- `src/features/home/components/HomeChat.tsx`
- `src/styles/home-chat.css`
- `src/features/app/components/ThreadList.tsx`
- `src/features/app/components/PinnedThreadList.tsx`
- `src/styles/sidebar.css`
- `src/features/tasks/**`
- `src/features/agent-orchestration/**`
- `src/features/layout/hooks/useLayoutNodes.tsx`
- `src/features/messages/**`

### Product impact

- New Home 回归为更干净、更明确的 creation-first surface。
- Sidebar 和 Conversation 成为 P0 运行态的主要用户感知位置。
- Task Center 保留内部能力，但不作为 P0 用户入口。
- Conversation 从单纯聊天界面升级为可关联运行状态的执行界面。
- Context/Evidence 从专家面板能力变成运行详情里的可信解释层。

### Backend impact

- P0 默认不要求新增后端 command。
- 若现有 TaskRun store 无法表达必要的 linked thread/session/evidence/artifact 关系，允许补最小前端数据结构。
- 不允许新增第二套运行状态模型。

## Acceptance Criteria

- New Home 呈现为 creation-first surface。
- New Home 不展示 active runs、attention runs、recent runs、recent artifacts 或 run detail dashboard。
- 用户不能从 New Home 进入 Task Center；完整 Task Center 入口待任务模块重构后再开放。
- Sidebar 会话行只展示已有 thread activity 的低噪运行态提示，不推断 unlinked TaskRun。
- Conversation 中能识别当前对话关联的 run，并能跳回 run detail。
- Run detail 至少展示：当前状态、来源、关联对话、产物、context/evidence、diagnostics、recovery actions。
- Context/Evidence 展示必须诚实：有就显示，没有就显示空态，不能推断不存在的数据。
- 响应式布局在桌面主窗口和紧凑宽度下可用。
- P0 不继续扩大 AppShell 的 run 业务职责；新增业务逻辑应进入 feature-local hook/util/component。
- 废弃 `WorkspaceHome` 不作为 P0 入口或验收对象。

## Follow-up Architecture Decision

便签上下文中的规划尚未完成，且不应塞进当前 P0：

- `AppShell` 编排深拆：让 `app-shell.tsx` 只做装配和 layout，并把 runtime、task/run、navigation、context 四类 action 分开。
- `useThreads` runtime 拆分：从同时处理 realtime、history、send、memory capture、shared session、recovery，拆出 `sessionLifecycleController` 和 `messageRuntimeController`。
- 核心 `@ts-nocheck` 消除：优先处理 `app-shell.tsx`、`useAppShellSections.ts`、`renderAppShell.tsx`。

Decision: 这些是架构安全门，不是当前 P0 用户感知闭环的补丁任务。它们应新开独立 OpenSpec change，避免把 P0 从产品运行态校准扩大成大型 shell/runtime 重构。

## Validation Plan

- `openspec validate unify-client-workflow-runtime-model --strict --no-interactive`
- Focused component tests for HomeChat creation-first structure and absence of runtime dashboard.
- Focused component tests for run detail, Task Center/detail reuse, and Conversation linked-run indicator.
- Focused tests for TaskRun projection/linking utilities.
- `npm run typecheck`
- `npm run lint`
