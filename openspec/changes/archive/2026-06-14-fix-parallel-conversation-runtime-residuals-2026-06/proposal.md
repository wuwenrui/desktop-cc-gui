# Proposal: Fix Parallel Conversation Runtime Residuals 2026-06

## Why

`investigate-parallel-conversation-jank-2026-06` 已把「多 workspace / 多 session 长时间并行对话后客户端变卡」校准为 7 条 runtime residual 风险。本 change 开始实施 P0 修复,先处理两个放大面最大的入口:

1. `ccgui.perf.*` 开关缺少可观测与 reset path,导致 realtime batching / reducer no-op guard / incremental derivation 等保护可能被 localStorage 长期关闭。
2. Claude child process lifecycle 缺少 `Drop` 兜底与 workspace-level diagnostics,导致 session 最终释放时如果仍有 child 句柄,没有最后一道 kill 防线。

## What Changes

- `src/features/threads/utils/realtimePerfFlags.ts`
  - 增加 8 个 perf flag 的 source-of-truth registry。
  - 导出 `getActiveRealtimePerfFlags()` 和 `resetRealtimePerfFlags()`。
  - 保留 production default 与 test default 语义。
- Settings UI
  - 增加 "Reset performance flags" 操作,清理所有 `ccgui.perf.*` keys 并提示 reload。
- Rust engine diagnostics
  - 给 `ClaudeSession` 增加 non-blocking `Drop` 兜底 kill。
  - 增加 workspace-level active child process diagnostics command。
  - 通过 `src/services/tauri.ts` 暴露 frontend service wrapper。

## Scope

本轮只实现 P0:

- 包含:perf flags self-check/reset、Claude child process Drop 兜底、Claude active process diagnostics。
- 不包含:P1/P2 的 Markdown scan、handler split、long-list virtualization、image release、timer idle scheduling。
- OpenCode/Gemini child process Drop 兜底作为后续审计任务保留,不在本轮混改。

## Impact

- Affected specs:`parallel-conversation-runtime-residuals`
- Affected code:`src/features/threads/utils/realtimePerfFlags.ts`,`src/features/settings/**`,`src/services/tauri.ts`,`src-tauri/src/engine/**`,`src-tauri/src/command_registry.rs`
- Affected tests:frontend perf flag tests、Settings UI test、Rust engine lifecycle/diagnostics tests where feasible。
