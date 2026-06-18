## Context

当前失败只在 CI batch 或本地同批 4 文件运行时稳定复现，单文件运行通常通过。失败 DOM 停在 `runtimeReconnectRunning`，说明测试只等待了 `ensureRuntimeReady`，但没有等待 `onRecoverThreadRuntime` 返回 null 后的失败状态 commit。

同时，`RuntimeReconnectCard` 的 reset effect 依赖 `retryMessage` 对象本身。父层 `resolveRetryMessageForReconnectItem()` 返回 `{ text, images }` 新对象时，即使语义未变，也会触发 card 状态 reset。这个模式会抹掉刚写入的 `error/restored` 状态，并增加 React update depth 风险。测试中的 Markdown mock 又在 render 阶段调用 `onRenderedValueChange`，与生产 `Markdown` 的 effect-phase 调用不一致。

## Goals / Non-Goals

**Goals:**

- Runtime reconnect card 只在 raw error、workspace、thread 或 retry payload 语义改变时重置。
- Recovery failure/success 状态在 async callback 完成后稳定可见。
- Focused test 模拟生产 callback 时机，避免 render-phase update。

**Non-Goals:**

- 不改变 runtime acquire/reconnect backend contract。
- 不重写 card 为完整 reducer 状态机。
- 不扩大到 message timeline 或 Markdown runtime 重构。

## Decisions

1. 使用 stable reset signature 替代 object dependency。
   - 选项 A：把 `retryMessage` 从 dependency 删除。风险是用户切换可重发 prompt 时旧状态可能残留。
   - 选项 B：使用 `rawMessage + workspaceId + threadId + retry text/images signature`。能保留真实切换语义，同时避免等价对象重置。
   - 采用 B。

2. 测试等待完整 recovery outcome。
   - 选项 A：继续等待 `ensureRuntimeReady` 后立即断言。它只证明第一步调用，不证明 callback 与 UI commit。
   - 选项 B：`waitFor` 中等待 `onRecoverThreadRuntime` 与 failure UI。更贴近用户可见结果。
   - 采用 B。

3. Markdown mock 改为 `useEffect` 触发 `onRenderedValueChange`。
   - 选项 A：保留 render 阶段调用，测试更短但会制造 React update hazard。
   - 选项 B：按生产组件语义在 effect 阶段上报 rendered value。
   - 采用 B。

## Risks / Trade-offs

- [Risk] Stable signature 拼接遗漏 image 变化 → Mitigation：签名包含 text 与 images join 后的语义值。
- [Risk] 测试等待范围过宽掩盖实际失败 → Mitigation：等待具体 failure copy，而不是只等异步函数被调用。
- [Risk] 只修 frontend 无法覆盖真实 runtime crash 根因 → Mitigation：本变更边界明确为 reconnect card 状态与 #185 同类前端 update 风险，backend runtime stability 不在本次范围。

## Migration Plan

1. 更新 `RuntimeReconnectCard` reset dependency。
2. 更新 focused test mock 和断言等待。
3. 跑 focused Vitest 与同批复现。
4. 如失败，回滚两个源码文件与本 change artifact 即可。

## Open Questions

- 无。
