## Why

最新热启动实测显示第一阶段流式可见延迟修复后，`visible-output-stall-after-first-delta=0`，但仍出现一次 `stream-latency/render-amplification`，最高 `lastRenderLagMs=4955ms`。同时 `perf.messages.row-render-budget` 显示旧 completed message row 在 live turn 中反复 render，例如 user row renderCount 到 234，旧 assistant row 到 216/196/164。

本变更要把优化焦点从 reducer / visible-stall 转到 message row render amplification：旧 history rows 在 live assistant row 增长时必须保持 memo boundary 稳定，避免历史行被流式尾部更新放大重渲染。

## 目标与边界

- 降低 live turn 期间旧 completed message rows 的重复 render。
- 只触碰 frontend message timeline / row memoization / diagnostics / focused tests。
- 保留 live assistant row 即时更新、visible text diagnostics、Markdown progressive reveal 语义。
- 用现有 `message-row-render-stability` capability 承接行为 contract。

## 非目标

- 不做 Markdown worker 化、backend event batching、composer input isolation 或 app shell context split。
- 不改变 message row visual layout、copy action、file link menu、runtime reconnect card 或 final boundary 语义。
- 不用全局禁用 diagnostics 的方式掩盖 render count。

## What Changes

- Identify unstable props or parent-derived references that cause non-live `MessageRow` memo boundaries to miss during live assistant updates.
- Add focused regression tests proving unchanged completed rows do not rerender when only the live assistant row text changes.
- Apply the smallest fix to stabilize row-level props or comparator behavior without weakening correctness for copied state, file links, recovery cards, or suppression flags.
- Keep content-safe row render diagnostics so future runtime evidence can distinguish live row renders from history row amplification.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-row-render-stability`: message row memoization must prevent unchanged completed rows from rerendering during live assistant updates while keeping render budget diagnostics content-safe.

## 技术方案选项与取舍

- 选项 A：在 `MessagesTimeline` 把所有 row props 包进 `useMemo`。这会制造大量局部 memo 对象，且仍可能因为 callback / Set / profile 引用变化失效。
- 选项 B：只调整 `MessageRow` memo comparator，识别对 non-live completed rows 无影响的 streaming-only props。实现小，但如果忽略错误 prop 会隐藏真实 UI 更新。
- 选项 C：拆出 `HistoryMessageRow` / `LiveMessageRow` 两个组件边界。结构更清晰，但改动较大，容易牵动 deferred image、memory/note card、runtime reconnect 等复杂路径。

采用“先证据后最小修复”：先用测试定位具体失效 prop，再在 B 或局部 A 中选择最小改动。只有测试证明 comparator 无法安全表达时，才升级到 C。

## 验收标准

- Focused test 能复现并锁定：旧 completed message row 在 live assistant text 更新时不 rerender。
- Live assistant row 仍会随 text delta rerender，并继续上报 visible text。
- `MessagesRows.stream-mitigation.test.tsx` 继续覆盖 Codex lightweight Markdown path。
- `npm run typecheck`、`npm run lint`、OpenSpec strict validation 通过。

## Impact

- Affected frontend code:
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/features/messages/components/MessagesTimeline.tsx` if parent prop stabilization is required
  - focused tests under `src/features/messages/components/`
- Affected specs:
  - `message-row-render-stability`
- No backend/Rust/API change, no new dependency.
