## Why

生产客户端在消息幕布使用期间出现 React `#185` 崩溃，本质是 `Maximum update depth exceeded`。消息渲染面在 streaming / layout / overlay 状态同步时必须避免提交语义等价的 state update，否则一次高频 rerender 就可能升级成整屏 ErrorBoundary。

## 目标与边界

- 修复 `Messages` render surface 中可能反复提交等价 state 的同步链路。
- 保持 live assistant / reasoning streaming 的现有可见行为，不改变 runtime、history、provider contract。
- 通过聚焦测试锁定同一消息输入在重复 rerender 下不会触发 React update-depth 崩溃。

## 非目标

- 不重构 AppShell layout。
- 不调整 streaming throttle、Markdown 渲染策略或 timeline snapshot contract。
- 不引入新依赖。

## What Changes

- 为消息幕布的同步 state 写入补充 idempotent guard，确保目标状态与当前状态一致时返回 previous reference。
- 增加回归测试覆盖 repeated render / same semantic message state 的稳定性。
- 保留现有 live row override、deferred timeline snapshot 与 working-set 行为。

## 技术方案对比

- 方案 A：在出问题的 state updater 处增加等价判断。
  - 优点：diff 最小，不改变数据流；符合现有 `messagesRenderLoopGuards` 的局部幂等策略。
  - 缺点：只能修复本次识别到的同步写入点。
- 方案 B：重构 `Messages` 的 expanded/anchor/finalizing state 为 reducer。
  - 优点：可集中治理所有 render-loop 风险。
  - 缺点：改动大，容易误伤 streaming render contract，本次崩溃不需要。

选择方案 A。本次问题是局部状态提交没有足够幂等性，微创修复比重排状态模型更稳。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-render-surface-stability`: 消息渲染面的同步状态提交必须保持幂等，避免 React update-depth 崩溃。

## Impact

- Affected code: `src/features/messages/components/Messages.tsx`
- Affected tests: `src/features/messages/components/Messages.test.tsx`
- No API, IPC, storage, dependency, or Rust backend changes.

## 验收标准

- 重复渲染同一 active streaming conversation 不触发 React `Maximum update depth exceeded`。
- `Messages` 仍保持 latest reasoning 自动展开和 live assistant row 即时更新。
- 聚焦 Vitest 通过。
