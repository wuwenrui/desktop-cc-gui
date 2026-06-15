## Why

`app-shell.tsx`、`useThreads` runtime、核心 `@ts-nocheck` 已经成为后续 P0 运行态治理的安全门。上一轮 P0 已把用户感知的 runtime visibility 收口，但底层编排仍然把 runtime、task/run、navigation、context、thread lifecycle 混在大型入口里，继续叠功能会放大回归风险。

## 目标与边界

目标：

- 让 `app-shell.tsx` 收敛为 app assembly 和 layout wiring，而不是业务 action controller。
- 将 AppShell action 按 runtime、task/run、navigation、context 四类边界拆分到明确模块。
- 将 `useThreads` runtime 的 lifecycle 与 message send/realtime 责任拆开，形成 `sessionLifecycleController` 与 `messageRuntimeController` 或等价边界。
- 消除核心 `@ts-nocheck`：优先 `app-shell.tsx`、`app-shell-parts/useAppShellSections.ts`、`app-shell-parts/renderAppShell.tsx`。
- 为后续 runtime/task/run 能力提供可测试、可回滚、可类型约束的架构底座。

边界：

- 本提案是架构安全门，不改变上一轮 P0 的 HomeChat / Run Detail / Task Center deferral 产品结论。
- 拆分必须保持现有用户行为等价，优先移动和类型收敛，不重写产品功能。
- 每个阶段必须能独立提交、独立回滚。

## 非目标

- 不重新设计 HomeChat、Task Center、Project Map 或 Orchestration 的用户体验。
- 不新增后端命令、存储迁移或 TaskRun 生命周期模型。
- 不把 `useThreads` 全量重写为新状态管理框架。
- 不一次性清除全仓所有 `@ts-nocheck`。
- 不借拆分机会重命名大量 public props 或改变外部调用契约。

## What Changes

- Introduce an AppShell boundary plan that separates four action families:
  - runtime actions
  - task/run actions
  - navigation actions
  - context actions
- Extract thread runtime responsibilities into lifecycle and message runtime boundaries while keeping existing hooks as compatibility facades during migration.
- Remove `@ts-nocheck` from the three highest-risk shell files by replacing `any` bags with typed section contexts and render contracts.
- Add focused regression tests for action routing, lifecycle/message runtime separation, and typed shell contracts.
- Keep existing feature behavior equivalent while reducing shell/runtime coupling.

## 技术方案对比

| Option | Approach | Pros | Cons | Decision |
|---|---|---|---|---|
| A. Big-bang rewrite | Rewrite AppShell and useThreads into new orchestrators in one pass | Clean final shape quickly | High regression risk, hard to review, hard to rollback | Reject |
| B. Compatibility-facade extraction | Keep public hooks/components stable, extract typed controllers behind existing facades | Incremental, testable, preserves behavior, easy rollback | Takes more steps and temporary adapters remain | Choose |
| C. Type-only cleanup first | Remove `@ts-nocheck` before changing boundaries | Exposes hidden type debt early | Types are hard to express while responsibilities remain tangled | Use after boundary extraction |

Chosen path: Option B first, then targeted Option C. This keeps P0 architecture work reviewable without changing the user-facing runtime model.

## Capabilities

### New Capabilities

- `app-shell-runtime-boundaries`: Defines AppShell action boundaries, thread runtime controller boundaries, and type-safety gates for shell orchestration.

### Modified Capabilities

- `shell-orchestration-hardening`: This change tightens the shell orchestration boundary so shell files assemble sections instead of owning cross-feature business rules.
- `runtime-session-lifecycle-extraction-compatibility`: This change requires session lifecycle extraction to remain compatible with existing thread/session behavior.
- `thread-actions-session-runtime-compatibility`: This change requires thread actions and message runtime extraction to preserve existing action contracts.
- `app-shell-exhaustive-deps-stability`: This change uses type-safe boundaries to reduce hook dependency drift in AppShell sections.

## Impact

Affected areas:

- `src/app-shell.tsx`
- `src/app-shell-parts/useAppShellSections.ts`
- `src/app-shell-parts/renderAppShell.tsx`
- `src/app-shell-parts/**`
- `src/features/threads/hooks/useThreads.ts`
- `src/features/threads/hooks/useThreadMessaging.ts`
- `src/features/threads/hooks/useThreadActionsSessionRuntime.ts`
- Existing thread/action/message tests under `src/features/threads/hooks/**`
- Existing AppShell section tests under `src/app-shell-parts/**`

No backend API, storage, or dependency impact is expected.

## Acceptance Criteria

- `app-shell.tsx` no longer owns runtime/task-run/navigation/context business action bodies directly; it composes typed sections and passes typed callbacks.
- Runtime, task/run, navigation, and context action families have explicit modules or hooks with focused tests.
- `useThreads` keeps its public hook compatibility while lifecycle and message runtime responsibilities are split behind smaller controllers.
- `app-shell.tsx`, `useAppShellSections.ts`, and `renderAppShell.tsx` no longer use `@ts-nocheck`.
- No user-facing behavior regresses in existing thread messaging, session lifecycle, HomeChat, Conversation, Project Map, or Orchestration paths.
- `openspec validate split-app-shell-runtime-boundaries --strict --no-interactive` passes.
- Focused Vitest suites for touched AppShell/thread runtime paths pass.
- `npm run typecheck` passes.
- `npm run lint` passes without adding new errors.
