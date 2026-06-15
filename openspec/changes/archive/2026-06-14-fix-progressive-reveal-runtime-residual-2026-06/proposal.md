# Proposal: Fix Progressive Reveal Runtime Residual 2026-06

## Why

`investigate-parallel-conversation-jank-2026-06` 将多 workspace / 多 session 长对话卡顿拆成 7 条 runtime residual 风险。P0 的 performance flags reset 与 Claude child process cleanup 已在 `fix-parallel-conversation-runtime-residuals-2026-06` 收口；本 change 继续处理 P1 中最窄、可测试、风险最低的一项：Markdown progressive reveal 边界扫描成本。

当前 `LiveMarkdown.tsx` 的 progressive reveal 已有短 pending 直出、长 visible/pending adaptive cadence 与极端 backlog 直出保护，但 `findProgressiveRevealBoundary()` 仍对同一段 pending text 执行 6 组 regex 扫描。长 turn 持续流式输出时，这条路径会被高频调用；即使单次成本不高，重复扫描仍会放大主线程压力。

## What Changes

- 将 `findProgressiveRevealBoundary()` 改成单次 newline scan，保留原来的边界优先级：
  1. blank paragraph boundary
  2. heading boundary
  3. list boundary
  4. quote boundary
  5. code fence boundary
  6. any newline fallback
- 保留已有短 pending 直出与 extreme backlog 直出行为。
- 补充 `LiveMarkdown.test.tsx` 回归测试，覆盖短 pending、heading/list/quote/code fence boundary、长 pending 有界输出。
- 更新 `docs/perf/jank-fix-progress.md` 的阶段 3 状态。

## Non-Goals

- 不调整 `PROGRESSIVE_REVEAL_STEP_MS` 默认值。
- 不改 `Markdown` / `Messages` prop flow。
- 不处理 handlers useMemo、long list virtualization、timer registry、image resource release。
- 不引入新依赖。

## Impact

- Affected code: `src/features/messages/components/LiveMarkdown.tsx`
- Affected tests: `src/features/messages/components/LiveMarkdown.test.tsx`
- Affected docs: `docs/perf/jank-fix-progress.md`
- Affected specs: `parallel-conversation-runtime-residuals`
