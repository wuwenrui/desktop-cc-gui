# Proposal: Unify Sidebar List Timeout Fallback Across Engines

## Summary

`harden-claude-sidebar-list-timeout-fallback` 已修复 Claude 子源 timeout / reject 时侧边栏列表"消失"的 bug，但 OpenCode 子源走的是**完全对称的代码路径**——同样 `withTimeout` → `null` → `Array.isArray(...) ? ... : []` → 空数组参与 mergedById 投递，却**没有**对称的 `seedLastGoodOpenCodeIntoMerged` 调用，因此 OpenCode 历史会话仍可能在 30 秒后从侧边栏"消失"。Codex 因走 catalog 路径而 `mergeCodexCatalogSessionSummaries` 在 sessions 为空时早退，天然安全；Gemini 因走异步 fire-and-forget 路径、timeout 时直接 return 不参与主合并，也不会污染主列表。

本变更只做一件事：**把 last-good seed 兜底机制从 Claude 单引擎提升到引擎无关的通用工具，并补齐 OpenCode 的 timeout / reject 兜底分支**。Gemini / Codex 因失败模式语义不同，**不纳入主链路 seed**，但通过 helper 层的统一签名让"为什么不纳入"成为可读的设计契约。

## Problem

- `useThreadActions.ts:1932-1983` OpenCode 子结果处理分支与 Claude 完全对称（fulfilled+null → rememberPartialSource + onDebug），但**缺少** `seedLastGoodOpenCodeIntoMerged` 调用；且**整个分支没有 else 处理 rejected**，OpenCode 子源抛出异常时直接跳过该子源，等同空数组参与下游 catalog merge。
- 这两个缺陷叠加导致：
  1. OpenCode 列表会在 `withTimeout(30s)` 触发后从侧边栏"消失"；
  2. OpenCode `getOpenCodeSessionListService` reject 时同样"消失"，且**没有可观测的 partial-source 诊断**（连 timeout 都不如，至少 timeout 还有 `opencode-session-timeout` 标记）。
- 现有 `claude-session-sidebar-state-parity` capability 的契约只覆盖 Claude；OpenCode 没有对应的 sidebar listing 兜底契约，意味着即使本次修了，未来重构仍可能再次回退。
- `seedLastGoodClaudeIntoMerged` 与 `isRetainableClaudeContinuitySummary` 是引擎硬编码的，没有归一化抽象——下次再要给任何新引擎做兜底，都要复制粘贴一份。

## Goals

- OpenCode 子源 timeout / reject 时，侧边栏列表 MUST 保留上一轮可见的 OpenCode 会话条目。
- OpenCode 子源 reject 路径 MUST 显式 `rememberPartialSource("opencode-session-error")` + `onDebug` 上报，保持与 Claude 路径对称的可观测性。
- `seedLastGoodEngineIntoMerged(engine, ...)` 与 `isRetainableEngineContinuitySummary(engine, summary)` MUST 作为引擎无关的通用工具存在，未来扩展任何新引擎只需配置 engine 参数即可。
- 既有 `seedLastGoodClaudeIntoMerged` MUST 保留为薄包装，确保 `useThreadActions.timeout-fallback.test.tsx` 4 个 case 零退化。
- 新增 capability `sidebar-list-timeout-fallback`，把跨引擎的兜底契约（含"Gemini/Codex 为何不纳入主链路 seed"的设计契约）成文。

## Non-Goals

- **不改 Gemini 行为**：Gemini 走异步 fire-and-forget（`void (async () => {...})()`），timeout 时直接 `return` 不参与主链路 mergedById，本身不会"洗掉"既有 Gemini 列表；强塞 seed 会破坏其"不阻塞主链路"的并发模型。本次仅在 helper 签名层让 Gemini 也可调用通用判定函数，不引入新调用点。
- **不改 Codex 行为**：Codex catalog merge 在 `codexSessions.length === 0` 时早退（`useThreadActions.helpers.ts:768-770`），是契约级别的兜底；本次不动 catalog merge 逻辑。
- 不重写引擎级独立快照（`evolve-thread-list-per-engine-snapshot` 仍为未来变更）。
- 不调整三层超时对齐（orchestrator 20s / withTimeout 30s / Rust 60s）。
- 不动 Rust 端 native list 扫描性能。
- 不收口或归档 `harden-claude-sidebar-list-timeout-fallback`（独立动作，单独 PR 由维护者执行）。

## Scope

### In Scope

- `src/features/threads/hooks/useThreadActions.helpers.ts`
  - 新增 `seedLastGoodEngineIntoMerged(engine, mergedById, lastGood, excluded)` 通用版本
  - 新增 `isRetainableEngineContinuitySummary(engine, summary)` 通用版本
  - 既有 `seedLastGoodClaudeIntoMerged` / `isRetainableClaudeContinuitySummary` / `isRetainableCodexContinuitySummary` 改写为薄包装（参数 fix 为对应 engine）
  - 新增 `seedLastGoodOpenCodeIntoMerged` / `isRetainableOpenCodeContinuitySummary`（薄包装）
- `src/features/threads/hooks/useThreadActions.ts`
  - OpenCode timeout (`opencodeResult.value === null`) 分支补 `seedLastGoodOpenCodeIntoMerged(...)`
  - OpenCode 缺失的 `else` (rejected) 分支补全：`rememberPartialSource("opencode-session-error")` + `onDebug` + `seedLastGoodOpenCodeIntoMerged(...)`
- 测试
  - 新增 `src/features/threads/hooks/useThreadActions.opencode-timeout-fallback.test.tsx`（4 case 对称 Claude：timeout 保留 last-good / reject 保留 last-good / 自污染防御 / 连续两次 timeout 不递减）
  - 既有 `useThreadActions.timeout-fallback.test.tsx` MUST 零退化
- Spec
  - 新增 `openspec/specs/sidebar-list-timeout-fallback/spec.md`（通过本 change 的 ADDED Requirements 生成）

### Out of Scope

- Claude 既有 seed / fallback 逻辑（已在 1f2f87f1 修复，仅通过薄包装兼容）
- Gemini fire-and-forget 链路改动
- Codex catalog 路径改动
- Settings / 用户偏好 / UI 层呈现
- `harden-claude-sidebar-list-timeout-fallback` 的归档动作
- 后端 Rust 扫描器

## Impact

- Frontend behavior
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/hooks/useThreadActions.helpers.ts`
- Tests
  - 新增 `src/features/threads/hooks/useThreadActions.opencode-timeout-fallback.test.tsx`
  - 既有 `src/features/threads/hooks/useThreadActions.timeout-fallback.test.tsx` 零退化
- Specs
  - 新增 capability `sidebar-list-timeout-fallback`（归档时进入 `openspec/specs/sidebar-list-timeout-fallback/spec.md`）
  - 既有 `claude-session-sidebar-state-parity` 不动

## Acceptance Criteria

1. 启动应用 → 等待 60 秒 → OpenCode 历史会话不消失（即使前端 `withTimeout` 触发）。
2. 模拟 `getOpenCodeSessionListService` 返回 `null`（withTimeout 超时）+ Claude / Codex 仍返回数据 → 侧边栏最终列表 MUST 包含上一轮的所有 OpenCode 条目 + Claude / Codex 数据。
3. 模拟 `getOpenCodeSessionListService` 抛出异常（rejected）→ 侧边栏 MUST 保留 last-good OpenCode 条目，且 Debug 面板 MUST 出现 `opencode-session-error` 诊断事件。
4. 连续触发两次 `listThreadsForWorkspace` (full-catalog) 都让 OpenCode null → 第二次的 last-good MUST 仍是首次 first-page 的完整 OpenCode 列表（不自污染）。
5. 既有 Claude timeout-fallback 4 case 全绿，零退化。
6. `openspec validate unify-sidebar-list-timeout-fallback-across-engines --strict --no-interactive` 通过。
7. `npm run typecheck && npm run lint` 0 error。
8. 受影响模块的 Vitest 全绿（含 `src/features/threads/` 周边）。
