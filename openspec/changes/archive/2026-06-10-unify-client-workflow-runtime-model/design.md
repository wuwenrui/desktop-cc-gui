## Design Goals

- HomeChat 保持 creation-first：workspace identity、engine identity、composer、recent conversations。
- Runtime visibility 放在用户真正停留的位置：Sidebar session rows、Conversation linked-run indicator、Run Detail。
- 所有执行入口最终落到同一种 `TaskRun` truth，避免 Project Map、Kanban、Orchestration、Composer 各自发明运行状态。
- Run Detail 成为可信解释层：进度、失败、产物、对话、上下文、证据都从这里串起来。
- Task Center / task draft 入口在任务模块重构前隐藏，避免用户进入未成熟模块。
- AppShell/layout 只做 wiring，不承载新增 run business rules。

## Current Code Facts

- 当前 New Home 是 `src/features/home/components/HomeChat.tsx`，由 `src/features/layout/hooks/useLayoutNodes.tsx` 的 `homeNode` 挂载。
- `HomeChat` 应只消费 workspace / recent conversation / composer props，不直接展示 workspace-level TaskRun summaries。
- `TaskRun` 类型、storage、coordinator、Task Center UI 已存在于 `src/features/tasks/**`。
- `src/features/tasks/utils/taskRunSurface.ts` 已存在 `describeTaskRunSurface` / `compareTaskRunSurfacePriority`，是 P0 应扩展或复用的 canonical run surface helper。
- `TaskCenterView` 已支持 run 列表、状态筛选、detail、恢复动作和打开 conversation，但入口暂时隐藏。
- Conversation 已是用户查看输出和继续协作的主要界面，适合放 lightweight linked-run indicator。
- `WorkspaceHome` 仍在代码中存在，但本 change 不以它作为产品入口。

## User Mental Model

P0 面向用户只暴露五个词：

- `对话`: 和 agent 沟通、查看输出的地方。
- `运行`: 一次执行，有状态、有失败、有产物。
- `产物`: 文件、patch、summary、链接等结果。
- `证据`: 这次运行用到的上下文、浏览器快照、Project Map 引用、文件引用等。
- `任务`: 未来任务模块重构后的组织对象；P0 不主动把用户送进未成熟任务入口。

内部可以继续使用 `TaskRun`、`OrchestrationTask`、`thread`、`session`，但 UI 不应要求用户理解这些词的区别。

## P0 Product Structure

```text
HomeChat / New Home
  - Workspace identity
  - Engine identity
  - Composer / create entry
  - Recent conversation shortcuts
  - No run dashboard
  - No Task Center entry

Sidebar session rows
  - Existing thread processing/review state as low-noise badges
  - No inferred workspace TaskRun summaries

Conversation
  - Lightweight linked-run indicator when active thread has explicit linked TaskRun
  - Open run detail action
  - Conversation output remains primary; run metadata stays secondary

Run Detail Surface
  - Status and latest step
  - Source: manual / orchestration / kanban / project-map / browser evidence
  - Linked conversation
  - Artifacts
  - Context and evidence references
  - Recovery actions: open conversation / retry / resume / cancel / fork

Task Center / Task Draft
  - Code can remain
  - User entrypoints hidden until task module redesign
```

## HomeChat Creation-First Design

Recommended structure:

- `Hero / Identity`: selected engine, current workspace, branch/worktree.
- `Composer Zone`: primary creation entry; visually central.
- `Recent Conversations`: lightweight shortcuts only when available.

Rules:

- Do not render active/attention/recent run lanes on HomeChat.
- Do not render recent artifacts/output on HomeChat.
- Do not embed `RunDetailSurface` in HomeChat.
- Do not pass TaskRun store data to HomeChat for workspace-level summaries.
- Do not show `View all runs` / Task Center entry.

Rationale:

- HomeChat has low dwell time.
- Workspace-level runtime summaries are incomplete and can be misleading.
- Runtime status is more valuable next to the conversation or object it belongs to.

## Contextual Runtime Visibility

Sidebar:

- Show only existing thread activity state, such as processing or reviewing.
- Keep badges small and secondary.
- Do not infer TaskRun status for threads without explicit links.

Conversation:

- If active thread has a linked TaskRun, show a lightweight linked-run banner.
- The banner should include run title, status, brief summary, and open-detail action.
- If there is no linked run, render nothing rather than an empty state.

Run Detail:

- Use shared `RunDetailSurface` for contextual detail.
- Detail can be opened via existing `OPEN_TASK_RUN_EVENT` path.
- Detail must not invent evidence, artifacts, or recovery actions.

## Source Routing / Truth Rules

P0 should make context/evidence visible enough to build trust, but must not overclaim.

Rules:

- If Browser Evidence exists on a run, show it in run detail with state and diagnostics.
- If source refs exist on an OrchestrationTask, show them as evidence/source refs.
- If artifacts exist, show artifact labels and safe open actions.
- If no context/evidence exists, show an honest empty state like “No linked evidence yet”.
- Do not infer hidden context usage that is not represented in data.
- `TaskRun` remains the execution truth; no parallel run lifecycle store.

## AppShell / useThreads Boundary

P0 boundary target:

1. Keep HomeChat creation-first and free of TaskRun dashboard logic.
2. Extend existing `taskRunSurface.ts` for shared detail display fields and status priority.
3. Keep `RunDetailSurface` reusable for Conversation/Task Center/contextual open paths.
4. Encapsulate run detail navigation in a small hook if local state is needed.
5. Keep TaskRun -> Orchestration projection idempotent and avoid repeated store writes.
6. Sidebar session rows may show only existing thread activity state.
7. Only if needed, extract thread/run link projection from `useThreads` or `useThreadMessaging` into a feature-local utility.

AppShell/layout should wire props and navigation only. New run business rules should live under `src/features/tasks/**`, `src/features/messages/**`, or `src/features/home/**` boundaries.

P0 does not claim the broader architecture refactor is done. The following note-card items are follow-up architecture work:

- Split AppShell orchestration so `app-shell.tsx` becomes assembly/layout only, with runtime, task/run, navigation, and context actions separated.
- Split `useThreads` runtime into lifecycle and message runtime controllers, because the current hook spans realtime, history, send, memory capture, shared session, and recovery.
- Remove core `@ts-nocheck` from `app-shell.tsx`, `useAppShellSections.ts`, and `renderAppShell.tsx` after the action boundaries are narrower.

Recommended follow-up: create a separate architecture change after P0 acceptance. That change should be treated as a safety-door refactor, not a user-facing runtime visibility enhancement.

## Workspace Home Terminology Migration

Older main specs still use `Workspace Home` as a product term. P0 treats that product term as the Home entry experience, but the implementation target is the current `HomeChat` mounted through `useLayoutNodes.tsx`.

Rules:

- Do not add new primary behavior to deprecated `WorkspaceHome`.
- Preserve existing home-entry contracts such as engine selection and primary composer affordance in `HomeChat`.
- Do not add HomeChat run cockpit/dashboard sections.
- When updating older specs later, clarify that `Workspace Home` maps to the current New Home / `HomeChat` entry unless explicitly referring to the deprecated component.

## Responsive Behavior

Desktop:

- New Home stays composer-first and avoids run dashboard panels.
- Runtime detail opens from contextual surfaces such as Conversation linked-run indicators or future run center entrypoints.

Compact/narrow:

- Composer remains first.
- Runtime status remains ambient or contextual, not a stacked dashboard.
- Run detail becomes a full-height overlay/sheet when opened from a linked surface.
- Task Center remains hidden until the task module is redesigned.

## Rollout Strategy

### P0.1: HomeChat Creation-First Cleanup

- Remove HomeChat run cockpit/dashboard sections.
- Keep workspace identity, engine identity, composer, and recent conversations.
- Do not pass TaskRun store data into HomeChat for workspace-level summaries.
- Update HomeChat tests to assert absence of run dashboard UI.

### P0.2: Contextual Runtime Visibility

- Keep `RunDetailSurface` shared for contextual run detail.
- Preserve existing `OPEN_TASK_RUN_EVENT` path.
- Keep Conversation linked-run indicator for threads with explicit linked TaskRuns.
- Add low-noise Sidebar session row status only from existing thread activity state.

### P0.3: Truthful Runtime Wiring And Evidence Explanation

- Keep Conversation linked-run indicator.
- Backfill evidence/context refs where current models already provide them.
- Add honest empty states for missing evidence, conversation, and artifacts.
- Make TaskRun -> Orchestration projection idempotent and avoid repeated store writes.
- Keep Task Center / task draft entrypoints hidden until the task module is redesigned.

## Risks

- If New Home shows too much, it becomes a noisy dashboard and weakens creation-first behavior.
- If Sidebar badges become too rich, the session list turns into a second dashboard.
- If TaskRun is treated as a replacement for thread/session, implementation will duplicate runtime truth.
- If AppShell absorbs new logic directly, the product improvement will create engineering debt.
- If the AppShell/useThreads deep refactor is bundled into P0, the release risk grows without improving the immediate user-facing runtime model.
- If context/evidence UI overclaims, users may trust explanations that are not backed by data.

## Rollback

- HomeChat cleanup is contained in `HomeChat` and related styles/tests.
- Sidebar badges can be removed without touching TaskRun storage.
- Conversation linked-run indicator can be reverted without changing run storage.
- Run detail surface should be removable without changing TaskRun storage.
- No backend migration rollback is expected in P0 unless implementation adds minimal fields.
