## Context

`shell-first-lazy-runtime-isolation` 建立了 summary boundary 和 hidden compute gates，使 Shell control plane 不再直接吞下完整 canvas props。现有代码仍有一个结构性弱点：`useLayoutNodes` 作为 layout composition hook，仍在 React render path 中接收并组合 active canvas heavy state。

React props/context 的默认语义是“父级 render 后子级再判断是否要更新”。当 active stream 高频追加 token、tool event 或 status pulse 时，`activeItems` / status maps 的引用变化会把整个 layout hook 唤醒。`useDeferredValue` 只能延迟消费，不能改变订阅拓扑。

> 🛠 **深度推演**：[L2/L3 分析摘要] L2 根因是 active canvas state 的订阅粒度太粗，导致布局编排层仍处在 canvas 高频广播半径内；L3 原则是高吞吐 runtime state 应该以 selector subscription 暴露，而不是以大对象 props 穿过 Shell composition boundary。

## Architecture

### Active Canvas Store

新增 feature-local external store，建议落位在 `src/features/layout/hooks/activeCanvasStore.ts` 或同级文件：

- `createActiveCanvasStore(initialSnapshot)`
- `setActiveCanvasSnapshot(nextSnapshot)`
- `subscribe(listener)`
- `getSnapshot()`
- `useActiveCanvasSelector(selector, isEqual?)`

实现基于 React 标准库 `useSyncExternalStore`。不引入新 dependency。

### Snapshot Shape

Snapshot 只覆盖 active canvas 高频数据，不承载所有 AppShell state：

- active identity：`activeWorkspaceId`、`activeThreadId`、`activeTurnId`
- heavy content：`activeItems`、`threadItemsByThread`
- live status：`threadStatusById`
- live usage：`activeTokenUsage`、`activeRateLimits`
- canvas derived state：`conversationState`

Actions/callbacks 继续通过现有 props 传递，避免 external store 变成万能 service locator。

### Selector Contract

Consumers 必须按需要订阅最小 slice：

- Messages/canvas host 订阅 `activeItems`、`conversationState`、`threadStatusById[activeThreadId]`。
- Composer 的 live advisory props 订阅 selector-derived deferred live slices，包括 `items`、`activeThreadId`、`threadItemsByThread`、`threadStatusById`、`contextUsage`、`accountRateLimits`、context compaction lifecycle 和 `userInputRequests`。
- StatusPanel 的 dock rendering props 订阅 selector-derived live slices，包括 `items`、`itemsByThread`、`threadStatusById`、`activeThreadId`、`activeTurnId` 和 `activeTokenUsage`。
- Shell summary 不订阅 full `activeItems`，只订阅 summary 所需 facts；如必须判断 can-copy，可用 `activeItems.length` selector，而不是完整 array。

Selector equality：

- 默认 `Object.is`。
- 提供 `shallowEqual` 给小对象 selector。
- Store update 时如果 selected value 未变，subscriber 不应触发 React render。

## Migration Strategy

1. 建立 external store 和 selector tests。
2. 在 `useLayoutNodes` 内同步 active canvas snapshot，但不改变外部 API。
3. 把 `buildConversationCanvasNode` 包装为小型 React component，使 heavy canvas props 在 component 内通过 selectors 读取。
4. 把 Composer live advisory props 和 StatusPanel dock live props 迁入同一个 selector store boundary。
5. 保留 Shell summary boundary；只把必要 summary facts留在 layout hook。
6. 跑 focused tests 和 typecheck。

## Risks

- Snapshot 同步时机错误可能让 canvas 看到旧 thread。Mitigation：snapshot 包含 active ids，并在 selector 中按 active id 读取；thread switch 测试覆盖。
- External store 变成全局垃圾桶。Mitigation：只允许 active canvas runtime state，不放 actions、不放 settings、不放 persistent state。
- Selector API 过度抽象。Mitigation：feature-local、少量 exported helper，先覆盖当前高频路径。

## Rollback

外部 layout API 不变。若出现回归，可删除 selector component 包装，恢复 `buildConversationCanvasNode` 直接接收 props。Store 文件本身无 backend schema 或 persistence 影响。

## Verification

- Unit tests:
  - active canvas store selector equality
  - thread switch snapshot consistency
  - shell-facing boundary does not need full canvas objects
- Commands:
  - `npm run typecheck`
  - focused Vitest suites for new store and layout boundary
  - `openspec validate externalize-active-canvas-state-selectors --strict --no-interactive`
