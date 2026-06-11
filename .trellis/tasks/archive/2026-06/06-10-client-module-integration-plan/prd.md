# P0: 客户端工作流运行主线全量产品化改版

## Goal

把当前客户端零散的 Home、Composer、TaskRun、Task Center、Orchestration、Conversation、Context/Evidence 能力接成一条完整、统一、有产品感的主线。P0 不做轻量修补，而是直接按全量产品化做：New Home 视觉大改版，成为 workspace cockpit；TaskRun 成为统一运行主线；Run Detail 解释进度、失败、产物和证据；Conversation 和 Task Center 都接入同一套运行体验。

## Linked OpenSpec Change

- `openspec/changes/unify-client-workflow-runtime-model/`

## What I already know

- 当前主入口是 `src/features/home/components/HomeChat.tsx`，由 `src/features/layout/hooks/useLayoutNodes.tsx` 的 `homeNode` 挂载。
- `WorkspaceHome` 已废弃，不作为本规划和 P0 实现基准。
- `HomeChat` 目前接收 `latestAgentRuns` / `isLoadingLatestAgents` / `onSelectThread`，但实现里未使用这些 props。
- `TaskRun` 类型、storage、coordinator、Task Center UI 已存在于 `src/features/tasks/**`。
- `OrchestrationTask` 已能 dispatch 到 `TaskRun`，说明统一运行主线已有基础。
- 用户明确要求：P0 要做就做完善，直接按全量方式做，包括视觉大改版。

## Requirements

- P0 必须以 New Home 为入口，做完整视觉和信息架构改版。
- New Home 从“输入框首页”升级为“Workspace Cockpit”。
- New Home 要展示 workspace identity、composer、active work、attention work、recent output、进入 Task Center 的入口。
- P0 不新增一个平行的超级面板，而是在 New Home / Task Center / Run Detail / Conversation 之间形成统一体验。
- TaskRun 作为客户端执行主线，负责统一状态、关联 conversation、产物、失败和恢复动作。
- Task Center 作为完整运行中心，和 New Home 使用同一套状态语言、优先级和详情模型。
- Run detail 使用 drawer/detail surface，展示状态、来源、对话、产物、context/evidence、恢复动作。
- Conversation 增加轻量 linked-run indicator，让用户能从对话回到 run detail。
- Context Ledger / Browser Evidence 在 P0 中作为 run detail 的解释层，不升级为新的顶级入口。
- 必须覆盖空态、加载态、错误态、无证据态、无对话态、无产物态。
- 必须覆盖桌面和紧凑布局。
- AppShell/useThreads 只做必要拆分，避免把新的业务规则继续堆进 shell。
- 本任务是 integration/umbrella work，不替代既有 `agent-task-center`、`agent-task-run-history`、`agent-task-orchestration-center`、`runtime-orchestrator` specs。
- TaskRun card/detail 展示模型优先扩展现有 `src/features/tasks/utils/taskRunSurface.ts`，不得新增平行 priority / severity truth。
- Project Map、Browser Evidence、New Home composer 等入口必须先经过明确 source routing，不得临时发明 UI-only TaskRun source。

## Acceptance Criteria

- [ ] New Home 完成全量视觉改版，用户看到的是 workspace cockpit，而不是单一输入框。
- [ ] New Home 能展示当前 workspace 的 active runs、attention runs、recent runs/recent output。
- [ ] 没有 runs 时，New Home 仍然完整、干净、creation-first，不出现空 dashboard。
- [ ] 用户从 New Home 能打开某个 run detail，也能进入完整 Task Center。
- [ ] 每个 run card 能显示状态、标题、来源、engine、更新时间、最新输出/失败原因、产物数量和主操作。
- [ ] Run detail 能显示 linked conversation、artifacts、browser/source evidence、diagnostics 和 recovery actions。
- [ ] Conversation 能显示当前 thread 关联 run 的轻量入口。
- [ ] Task Center 与 New Home 使用一致的状态文案、优先级和详情模型。
- [ ] Context/Evidence 展示必须诚实：有就显示，没有就显示空态，不推断不存在的数据。
- [ ] 桌面和紧凑布局可用。
- [ ] 实现不改废弃 `WorkspaceHome` 作为主入口。
- [ ] OpenSpec strict validation 通过。

## Definition of Done

- OpenSpec change 创建并通过 strict validation。
- P0 实现前有明确 UI/UX contract。
- 代码实现时补充 New Home、Run Detail、Task Center alignment、TaskRun linking、Conversation linked-run 的 focused tests。
- `npm run typecheck` 和 `npm run lint` 通过。
- 若实现中新增跨层 contract，同步更新 `.trellis/spec/**` 或对应 OpenSpec spec。

## Technical Approach

P0 的产品链路：

```text
New Home / Workspace Cockpit
  -> active/attention/recent run sections
  -> shared run card model
  -> run detail drawer/detail
  -> linked conversation / Task Center
  -> context/evidence explanation
```

P0 的工程边界：

- `HomeChat` 负责新的 cockpit 展示，但不自己发明 run 生命周期。
- `src/features/tasks/**` 负责 TaskRun surface projection、status priority、detail model 和 recovery action 表达。
- `src/features/agent-orchestration/**` 继续负责任务意图和派发，但派发后必须落到 TaskRun。
- `useLayoutNodes.tsx` 只装配数据和事件，不直接承载新的 run 业务逻辑。
- 需要优先抽出 `useHomeRunSummary`、扩展 `taskRunSurface.ts`、新增 `RunDetailSurface`、`useRunDetailNavigation`、`taskRunLinking`。

## Source Routing

| Entry surface | TaskRun behavior | Source contract |
|---|---|---|
| Kanban | 通过现有 Kanban execution path 创建或复用 TaskRun | `task.source = "kanban"` |
| Orchestration Center | 通过 `beginOrchestrationTaskDispatch` 创建或链接 TaskRun | `task.source = "orchestration"` |
| Project Map / Work Queue | 先创建或选择 OrchestrationTask，再派发为 TaskRun | Project Map refs 保留为 source/evidence refs |
| Browser Evidence | 作为 bounded evidence 附着到 OrchestrationTask 或 TaskRun evidence refs | 不新增 browser-specific run lifecycle source |
| New Home composer | 默认 conversation-first；只有 task-like executable work 才创建或链接 TaskRun | 不把普通聊天伪装成 TaskRun |
| Task Center recovery | 通过既有 retry/fork/resume path 创建 successor TaskRun | 使用 trigger / lineage 字段 |

## Delivery Slices

### P0.1: Home Cockpit Read-Only Integration

- 统一状态文案和 priority，并修正 `taskRunSurface.ts`。
- 新增 `useHomeRunSummary`。
- 改版 New Home 信息架构、空态、active/attention/recent sections。

### P0.2: Shared Run Detail And Task Center Alignment

- 新增或抽取 `RunDetailSurface`。
- New Home 和 Task Center 复用同一 detail model。
- 保留现有 `OPEN_TASK_RUN_EVENT` 路径。

### P0.3: Conversation And Evidence Explanation

- Conversation linked-run indicator。
- Browser Evidence / source refs / context empty states。
- 响应式、动效、focused tests。

## Decision (ADR-lite)

**Context**: 客户端已有很多强 surface，但用户感受是分散。此前规划偏轻量，用户明确要求 P0 直接按完善版本做，并包含视觉大改版。

**Decision**: P0 以 `New Home / HomeChat + TaskRun + Run Detail + Task Center + Conversation linked-run + Context/Evidence explanation` 为完整主线，执行 New Home 全量视觉和信息架构改版。不新增超级面板，不复活 WorkspaceHome。

**Consequences**: 用户会明显感知到首页变成真正工作台，能看状态、追踪执行、理解失败和证据、处理下一步。工程上必须同步抽出 view model/detail/navigation 边界，否则大改版会让 AppShell 继续膨胀。P0 范围变大，测试和验收也必须按产品级改版处理。

## Out of Scope

- 不复活或重做废弃 `WorkspaceHome`。
- 不把 Project Map、Browser Dock、Kanban、SpecHub 全部重写；P0 只要求它们派发出的任务进入统一 run 体验。
- 不把 Context Ledger 改造成全局知识库。
- 不新增后端持久化协议，除非实现中发现缺少不可替代的最小字段。
- 不解决所有历史数据迁移问题；旧数据允许通过兼容投影展示。

## Technical Notes

- OpenSpec: `openspec/changes/unify-client-workflow-runtime-model/`
- New Home: `src/features/home/components/HomeChat.tsx`
- Home mount: `src/features/layout/hooks/useLayoutNodes.tsx`
- TaskRun: `src/features/tasks/types.ts`
- Task Center: `src/features/tasks/components/TaskCenterView.tsx`
- Orchestration dispatch: `src/features/agent-orchestration/utils/dispatchTask.ts`
