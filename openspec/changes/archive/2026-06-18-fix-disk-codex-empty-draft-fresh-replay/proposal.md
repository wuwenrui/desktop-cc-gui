## Why

本地 Codex 磁盘配置在近期性能改造后，首轮空白 draft 命中 stale `thread not found` 时会稳定落到恢复卡，用户需要手动 Fork 才能继续。这个场景没有 durable conversation identity，应该优先 fresh replay 当前 prompt，而不是先尝试 stale fork。

## 目标与边界

- 修复 Codex disk profile 下首轮空白 draft 的 `thread not found` 自动恢复路径。
- 保持 durable Codex thread 的保守 rebind / fork 语义，不静默替换已有会话。
- 顺手统一 disk provider 的用户可见文案，使其更专业且语义仍表示本地 `.codex` 配置。

## 非目标

- 不改 Codex provider-scoped runtime key、`CODEX_HOME` 物理布局或 managed provider 行为。
- 不新增恢复卡交互能力。
- 不做跨 provider fork 语义调整。

## What Changes

- 对可证明 disposable 的 first-turn Codex draft，在 `refreshThread` 无法 rebind 后优先创建 fresh Codex thread 并 replay 当前 prompt。
- durable stale thread 仍保留现有 fork/rebind 分支。
- 将 disk provider copy 从“磁盘 .codex 配置”调整为 `codex-tui/default-config`。

## 技术方案取舍

| 方案 | 结论 | 原因 |
|---|---|---|
| A. 后端遇到 `thread not found` 直接 `thread/start` | 放弃 | 后端缺少 UI liveness facts，容易误替换 durable thread，破坏 stale recovery 契约。 |
| B. 前端在 disposable draft 判定通过后优先 fresh replay | 采用 | 前端拥有 optimistic user intent、accepted-turn marker、local durable activity，能精准区分 first-turn draft 与 durable conversation。 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `codex-stale-thread-binding-recovery`: first-turn empty Codex draft 的 fresh continuation MUST precede stale fork fallback。

## Impact

- Frontend send fallback: `src/features/threads/hooks/useThreadMessaging.ts`。
- Frontend tests: `src/features/threads/hooks/useThreadMessaging.test.tsx`。
- Provider copy constants/tests/spec notes: frontend + Rust constants、相关 UI 测试和 Trellis contract。

## 验收标准

- 本地 `.codex` 配置下首轮空白 Codex draft 失败为 `thread not found` 时，自动 fresh replay，不展示手动恢复卡。
- durable stale Codex thread 仍不会被静默 fresh replacement。
- 相关 Vitest 覆盖 fallback 顺序和 copy 文案。
