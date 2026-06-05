## Why

客户端再次出现后台启动多个 `node` / `codex` / `claude` 进程并拖慢 UI，根因与之前修过的 session leak 同类：被动读取路径重新跨过了 runtime acquisition 边界。

这次不只是历史加载；`model_list`、`account_rate_limits`、workspace restore/focus refresh/background hydration 等 passive path 都可能间接触发 `ensure_codex_session_for_workspace` 或 runtime reconnect，导致多个 workspace 被批量拉起 Codex runtime。

## 目标与边界

- 阻止 passive read / background hydration / focus refresh 为非显式用户动作启动 Codex runtime。
- 保留真正需要 runtime 的动作：send、resume active conversation、manual reconnect/retry、fork、用户明确触发的 refresh。
- 对无 runtime 的 helper read 返回 cached / degraded / empty fallback，而不是隐式 spawn。
- 不改变 Codex CLI 启动参数、不改变用户显式打开 workspace 后的正常对话能力。

## 非目标

- 不重写 workspace/session 管理架构。
- 不隐藏或杀掉已经存在的进程；本变更只修复新的隐式拉起来源。
- 不引入新的全局调度器或复杂队列。
- 不调整 Claude/Codex/Gemini 的业务功能语义。

## What Changes

- Background thread-list hydration、workspace restore、focus refresh 等被动列表刷新必须显式传入 no-runtime-reconnect 语义。
- Frontend helper hooks 不应把模型列表、account rate limits 等 passive refresh 当成 runtime-required action。
- Daemon helper commands must support no-spawn reads：没有现存 Codex session/runtime 时，不调用 `ensure_codex_session_for_workspace`。
- Runtime-required actions 保持可 acquire runtime，但 acquisition source 必须可追踪，避免把 passive source 伪装成 live user action。
- 添加 focused regression coverage 或 contract checks，锁住 passive read 不 spawn 的行为。

## 方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 只在 frontend 禁掉 background reconnect | 给 hydration/focus/restore 传 `allowRuntimeReconnect: false` | 改动小，快速止血 | daemon helper read 仍可能由 `model_list` / `rate_limits` 拉起 runtime | 只作为第一层防线，不够完整 |
| B. 只在 daemon 去掉 helper read 的 ensure | `model_list` / `account_rate_limits` 无 session 时 fallback | 修住最明显 spawn 源 | thread-list hydration 仍可能通过 recovery reconnect 多 workspace | 只作为第二层防线，不够完整 |
| C. 前后端双边界修复 | frontend passive path no reconnect；backend passive helper no spawn | 与历史提案一致，能覆盖多源触发 | 需要跨层改动与 focused tests | 采用 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-lifecycle-contract`: passive history/list/helper reads must not force Codex runtime acquisition, and background recovery must not reconnect non-active workspaces without explicit user intent.

## Impact

- Frontend hooks:
  - `src/app-shell-parts/useWorkspaceThreadListHydration.ts`
  - `src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.ts`
  - `src/features/workspaces/hooks/useWorkspaceRestore.ts`
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/models/hooks/useModels.ts`
  - `src/features/threads/hooks/useThreadRateLimits.ts`
- Frontend service bridge:
  - `src/services/tauri.ts`
- Backend daemon/runtime:
  - `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`
  - shared Codex helper paths if command signatures require no-spawn parameters.
- Specs/tests:
  - OpenSpec delta under `conversation-lifecycle-contract`
  - focused regression tests for passive no-spawn behavior.

## 验收标准

- Passive workspace hydration / focus refresh for background or non-active workspaces never calls runtime reconnect.
- `model_list` and `account_rate_limits` can return fallback data without spawning Codex when no existing session exists.
- Existing explicit user actions that need Codex runtime still start or reuse runtime.
- Process pressure should no longer scale with number of visible/restored workspaces during idle startup.
- Regression coverage documents at least one frontend passive no-reconnect case and one backend helper no-spawn case, unless implementation reveals existing equivalent coverage.
