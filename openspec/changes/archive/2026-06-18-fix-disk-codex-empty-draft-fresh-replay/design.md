## Context

现有 `retryCodexSendAfterThreadRefresh` 已能识别 `thread not found` / `session not found`，并且有 first-turn draft fresh replacement 的能力。但执行顺序是：

1. refresh stale thread
2. fork stale thread
3. fork 失败后才 fresh replacement

对本地 `.codex` disk profile 的空白 draft 来说，fork 可能创建一个仍不可继续的 stale child，并消耗 `codexInvalidThreadRetryAttempted`，最终让用户看到恢复卡。

## Decision

把 first-turn disposable draft 的 fresh replacement 提前到 fork 之前：

```text
on recoverable Codex stale error:
  refresh stale binding
  if rebound:
    retry on rebound
  if current source is disposable first-turn draft:
    start fresh Codex thread
    move optimistic user intent
    retry once on fresh thread
  otherwise:
    fork stale thread
    retry once on forked continuation
```

后端 `turn/start` 对 `thread not found` 采用 cold-start readiness recovery：先在同一个 `WorkspaceSession` 内 `thread/resume`，再用短暂 bounded backoff 重试原 `turn/start`；如果仍是 `thread not found`，最多再重试一次，然后把失败交给前端 first-turn fresh replay。

## Durable Safety

Fresh replacement 仍由 `canUseLocalFirstSendCodexDraftReplacement` 控制，必须满足以下之一：

- authoritative `empty-draft` marker；或
- 当前本地 optimistic user intent 存在、accepted-turn fact unknown、且本地没有 durable activity。

已有 durable activity 或 accepted turn 的 thread 继续走 rebind/fork，不会被 silent replacement。

`refreshThread` 返回原 `threadId` 不算 verified rebind。对 first-turn missing-thread draft，这说明没有产生可用 replacement，前端 MUST fresh replay，而不是 retry 同一个 missing id。

## Copy Update

Disk profile 名称统一为 `codex-tui/default-config`。该文案直接表达默认 codex-tui 配置入口，同时仍对应本机 `.codex` / `CODEX_HOME` 行为。

## Rollback

回滚方式是恢复 fallback 顺序：将 fresh replacement 重新放回 fork 失败之后，并恢复 provider copy 常量。该回滚只影响首轮 draft 的自动恢复体验，不改变后端 runtime state。
