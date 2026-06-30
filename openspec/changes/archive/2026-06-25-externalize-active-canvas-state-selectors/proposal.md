## Why

上一阶段 `shell-first-lazy-runtime-isolation` 已经把 Shell control plane 和 Conversation canvas content plane 的直接资源竞争切开，用户实测有明显改善。但 `useLayoutNodes` 仍通过 React props 接收 `activeItems`、`threadItemsByThread`、`threadStatusById`、`activeTokenUsage`、`activeRateLimits` 等高频 active canvas state，再用 `useMemo` / `useDeferredValue` 做局部降频。

这说明当前瓶颈已经从“组件渲染慢”推进到“state broadcast 半径过大”：只要 active canvas state 的大对象引用变化，布局编排层仍会被唤醒并重新判断大量依赖。继续堆局部 memo 只能缓解症状，不能让无关 surface 根本收不到通知。

本变更将 active canvas state 外置为 feature-local external store，并提供 selector-based subscription，让 canvas plane 精确订阅 heavy slices，Shell plane 继续消费 narrow summary。

## What Changes

- 新增 active canvas external store contract：使用 `useSyncExternalStore` 和 selector/comparator，而不是新增 Redux/Zustand/Jotai dependency。
- 新增 selector hooks：调用方按 slice 订阅 `activeItems`、`threadItemsByThread`、`threadStatusById`、`activeTokenUsage`、`activeRateLimits`、`conversationState` 等高频数据。
- 修改 `useLayoutNodes` / conversation canvas boundary：canvas node builder 从 selector 读取 heavy active state；Shell summary 仍只接收 narrow facts。
- 增加 tests：selector 结果相等时不通知订阅者；canvas-only churn 不扩大 shell-facing invalidation。
- 保留现有 runtime/provider/ConversationItem schema，不改 Tauri backend 或 app-server protocol。

## Non-Goals

- 不引入全局状态管理框架。
- 不迁移整个 AppShell domain context。
- 不改变 message reducer、provider event schema、history persistence schema。
- 不把 Conversation canvas 物理拆成独立 WebView/process。

## Impact

- Frontend:
  - `src/features/layout/hooks/**`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - focused tests around layout/canvas boundaries
- Specs:
  - `app-shell-runtime-boundaries`
  - `conversation-realtime-client-performance`
- No Rust/backend API change expected.

## Acceptance Criteria

- Active canvas heavy state can be updated into a feature-local external store without changing provider/runtime semantics.
- Canvas consumers can subscribe to heavy slices via selector hooks.
- Selector comparator prevents notifications when selected value is referentially or shallowly equal.
- Shell-facing layout nodes do not receive full active canvas objects just to preserve canvas rendering.
- Focused Vitest coverage and `npm run typecheck` pass before closeout.
