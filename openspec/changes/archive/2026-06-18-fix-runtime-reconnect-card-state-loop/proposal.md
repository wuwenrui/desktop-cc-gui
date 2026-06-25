## Why

Runtime reconnect card 在 CI 同批 Vitest 中再次出现状态未落地的问题：`ensureRuntimeReady` 已被调用，但恢复 callback 的失败 UI 没有稳定呈现。生产截图同时显示 React #185，说明 reconnect/recovery 表面存在被不稳定依赖或 render-phase callback 放大的 update depth 风险。

## 目标与边界

- 目标：让 runtime reconnect / recover card 的 `error/restored/fresh/forked` 状态只因真实上下文切换重置，不因父层重新派生等价对象而被抹掉。
- 目标：让相关测试等待完整 async recovery flow，并避免测试 mock 在 render 阶段触发 React update。
- 边界：本变更只处理前端 reconnect card 状态与 focused test，不修改 runtime acquire、thread rebind、Tauri command 或 Rust backend contract。

## 非目标

- 不改变 `ensureRuntimeReady` 的 backend 语义。
- 不新增 runtime recovery policy 或自动重试策略。
- 不调整 streaming Markdown 渲染策略、timeline virtualization 或 message row 样式。

## What Changes

- Runtime reconnect card 的 reset dependency 从对象引用收敛为稳定 signature。
- Runtime recovery failure UI 保留 recover-specific detail，不被同值 `retryMessage` 新对象重置。
- `Messages.runtime-reconnect.test.tsx` 的 Markdown mock 改为 effect-phase report，匹配生产 `Markdown` 的 `onRenderedValueChange` 调用时机。
- 同批 CI 复现文件增加 focused 验证，覆盖原始失败 batch。

## 技术方案选项

| 选项 | 做法 | 取舍 |
|---|---|---|
| A | 只把失败断言包进 `waitFor` | 最小改动，但无法修复 card reset 与 render-phase mock 风险 |
| B | 稳定 reset signature + effect-phase test mock | 同时修复直接 CI flake 与 React #185 同类风险，改动小且不碰 backend |
| C | 重构 reconnect card 为 reducer 状态机 | 结构更强，但当前问题不需要扩大抽象，风险和回归面更大 |

采用选项 B。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `conversation-runtime-stability`: 补充 conversation surface 的 runtime reconnect card 状态稳定要求。

## Impact

- 影响代码：
  - `src/features/messages/components/RuntimeReconnectCard.tsx`
  - `src/features/messages/components/Messages.runtime-reconnect.test.tsx`
- 影响验证：
  - focused Vitest 单文件
  - CI 同批 4 文件复现
  - TypeScript typecheck
- 无新增依赖、无 API breaking change。

## 验收标准

- 同批运行 `Messages.reasoning-exit-plan`、`Messages.reasoning-render`、`Messages.rich-content`、`Messages.runtime-reconnect` 必须通过。
- Runtime resumes but thread recovery returns null 时，UI 必须显示 `runtimeReconnectFailed` 与 `runtimeReconnectRecoverFailed`。
- 测试 mock 不得在 render 阶段调用会导致父组件 state update 的 callback。
