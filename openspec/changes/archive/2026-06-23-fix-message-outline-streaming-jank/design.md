## Overview

本修复把 messages outline 从 live assistant streaming hot path 中“降噪”：目录仍由当前 live assistant Markdown 生成，但 callback、state 与 extraction 必须满足稳定性和幂等性。核心判断是：outline 是导航辅助状态，不应该因为 parent render 或同内容 callback 重放，让 `MessageRow` / `Markdown` 的 memo boundary 失效。

## Root Cause

当前实现有三处组合风险：

1. `MessagesTimeline` 在 JSX 中调用 `handleOutlineReady(renderItem.id)`，每次 render 都返回新函数。
2. `Markdown` 的 outline effect 依赖 `[throttledValue, onOutlineReady]`，即使 `throttledValue` 未变，新的 callback identity 也会触发 `extractOutlineFromMarkdown(throttledValue)`。
3. `MessagesTimeline` 收到 outline 后直接 `setCurrentOutline({ messageId, outline })`，即使 outline 内容等价，也会提交新 object，推动 floater 和 timeline root 再渲染。

这不是 engine output cadence 的问题，也不是 Markdown parser 单点慢，而是 auxiliary outline state 反向污染了 streaming render loop。

## Design Decisions

### Decision 1: Use one stable outline callback for the timeline

`MessagesTimeline` should pass a stable callback to the live assistant `MessageRow`. The callback must receive enough identity to know which message produced the outline.

Preferred shape:

```ts
type MessageOutlineReadyPayload = {
  messageId: string;
  outline: MarkdownOutlineEntry[];
};
```

`MessageRow` can adapt its existing `onOutlineReady?: (outline) => void` prop locally, but the parent-owned callback identity must not change because a row rendered again.

### Decision 2: Make outline state updates idempotent

`MessagesTimeline` should compare the next `{ messageId, outline }` with the previous snapshot. If `messageId` and outline entries are semantically equal, return the previous state reference.

Comparison fields:

- `id`
- `anchor`
- `title`
- `depth`
- `startLine`
- `endLine`
- `ordinal`

This deliberately avoids deep object identity comparison and tracks the fields that affect floater rendering and jump behavior.

### Decision 3: Cache outline extraction by visible source identity

`Markdown` should cache the last extracted outline for the exact `throttledValue`. If a parent rerender repeats the same visible source, the component should reuse the cached outline instead of rescanning the markdown string.

This is intentionally a one-entry cache, not an LRU. Streaming only needs the latest visible source; adding a larger cache would be unnecessary state.

## Alternatives Considered

| Option | Summary | Trade-off |
|---|---|---|
| Disable outline during streaming | Only compute after final message | Low risk for performance but breaks the live outline contract |
| Stable callback + idempotent state + one-entry extraction cache | Keeps behavior and removes avoidable churn | Small code change, precise test coverage needed |
| Lower realtime batch windows | Treat perceived stutter as event cadence | Global runtime risk and does not address callback/state churn |

Chosen option: stable callback + idempotent state + one-entry extraction cache.

## Data Flow

1. `MessagesTimeline` owns one stable `handleLiveOutlineReady(payload)` callback.
2. The live assistant row receives a memoized/adapted callback only when it is the active live assistant message.
3. `Markdown` extracts outline from `throttledValue`, using a one-entry cache for repeated source.
4. `MessagesTimeline` writes `currentOutline` only when the semantic snapshot changes.
5. `MessagesOutlineFloater` receives the latest outline and still resets when the outline identity actually changes.

## Error Handling

- `Markdown` keeps the existing defensive `try/catch` around the consumer callback.
- Outline extraction remains best-effort; empty/malformed headings simply produce an empty outline.
- The state guard must not suppress real changes such as a heading title changing from partial to final.

## Test Plan

- `Markdown.outline-streaming.test.tsx`
  - Same `throttledValue` rerender with a new callback should not rescan outline.
  - High-frequency partial values remain throttled and final outline converges.
- `MessagesTimeline.outline-state.test.ts`
  - Same message + same outline returns previous state reference.
  - Same message + changed heading title/depth/line updates state.
  - Different message id updates state even if outline entries match.
- Existing streaming presentation tests continue to pass.

## Rollback

Rollback is limited to the outline path:

- Revert stable callback/idempotent update/cache changes.
- Keep engine event batching and lifecycle settlement untouched.

No data migration or backend rollback is required.
