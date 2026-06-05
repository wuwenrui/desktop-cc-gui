## Context

历史修复已经禁止 passive Codex history selection 通过 `resumeThreadForWorkspace` 拉起 runtime，但当前问题扩大到了更泛的 passive path：workspace restore、focus refresh、background hydration、model list、account rate limits 等读状态操作会在无 session 时触发 reconnect 或 `ensure_codex_session_for_workspace`。

这违反了 conversation lifecycle 的核心边界：读取缓存/列表/元信息不能等价于启动 AI runtime。否则一旦侧边栏恢复多个 workspace 或页面进入 visible/focus，就会批量生成 `node` / `codex` 子进程。

## Goals / Non-Goals

**Goals:**

- Passive list/history/helper reads 不启动 Codex runtime。
- Background/non-active workspace refresh 不触发 automatic runtime recovery。
- Active user action 仍可 acquire runtime。
- No-spawn fallback 可被诊断：返回 degraded/cached/empty，而不是 silent failure。

**Non-Goals:**

- 不重构 session registry。
- 不新增 runtime scheduler。
- 不改变 explicit send/resume/manual reconnect 的启动能力。
- 不实现进程清理器；已有进程生命周期由既有 runtime 管理负责。

## Decisions

### Decision 1: Frontend passive sources must opt out of runtime reconnect

`listThreadsForWorkspace` 默认保留 `allowRuntimeReconnect = true`，避免破坏手动/live thread list 路径；但以下 passive source 必须显式传 `false`：

- background hydration / idle prewarm
- focus refresh for non-active or background workspaces
- workspace restore when not explicitly restoring a live active runtime

Alternative considered: flip default to `false` globally. Rejected because it risks breaking active/live flows and requires a larger audit of all callers.

### Decision 2: Daemon helper reads use no-spawn semantics

`model_list` and `account_rate_limits` must not call `ensure_codex_session_for_workspace` when invoked as passive reads. They should use cached/static fallback or return degraded data if no existing session is available.

Alternative considered: add frontend parameters such as `{ allowRuntimeAcquire: false }`. Rejected for the immediate fix because the most dangerous behavior is backend-side ensure; making daemon commands safe by default prevents future frontend callers from reintroducing the bug.

### Decision 3: Keep explicit runtime acquisition paths narrow and named

Send/resume/manual retry/reconnect/fork remain runtime-required. Automatic recovery sources must not be used for passive background work unless the source is an active user-driven source.

Alternative considered: global process count cap. Rejected because it masks the bug and creates starvation/ordering complexity.

## Risks / Trade-offs

- [Risk] Some UI surfaces may temporarily show stale model/rate-limit data when no runtime exists. → Mitigation: return cached/degraded fallback and allow explicit manual refresh or active runtime action to update live data.
- [Risk] Background workspace list may not self-heal disconnected runtime state. → Mitigation: active workspace/user-triggered paths keep reconnect ability.
- [Risk] Existing tests may assume helper reads always start runtime. → Mitigation: update tests to assert the intended no-spawn contract and keep explicit-runtime tests separate.

## Migration Plan

1. Add OpenSpec delta requirements for passive no-spawn behavior.
2. Update passive frontend callers to pass no-runtime-reconnect flags.
3. Update daemon helper read paths to avoid `ensure_codex_session_for_workspace` on model/rate-limit reads.
4. Add focused regression coverage or document skipped validation if not run in this session.
5. Rollback: revert the change files and restore previous reconnect/ensure behavior if a release-blocking explicit-runtime regression appears.

## Open Questions

- Should the UI label stale model/rate-limit data as degraded? This is useful but not required for the hotfix.
