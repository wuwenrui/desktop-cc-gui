# Spec Delta: codex-message-recovery-hook

## Purpose

定义 `useCodexMessageRecovery` 子 hook 的契约,作为 Codex stale thread binding recovery / fresh continuation / fork 路径的对外接口,使 `useThreadMessaging` 主 hook 与恢复逻辑解耦,便于后续 Gemini / Claude 接入同款 liveness 抽象。

## ADDED Requirements

### Requirement: useCodexMessageRecovery MUST expose recovery entry points

The hook SHALL export `useCodexMessageRecovery` as a top-level React hook returning `createRecoveryAttempt(deps)`. Each attempt SHALL expose at least `tryFreshDraftReplacement(fallbackReason)`, `tryForkFromMessage(reason)`, `canUseFreshDraftReplacement`, and `isUnverifiedSameThreadMissingRebind`.

#### Scenario: Hook obeys React Rules of Hooks
- **WHEN** `useThreadMessaging` needs Codex recovery for a single send attempt
- **THEN** it SHALL call `useCodexMessageRecovery()` at hook top-level
- **AND** it SHALL call `createRecoveryAttempt(deps)` inside the send path as an ordinary function
- **AND** it SHALL NOT call `useCodexMessageRecovery(deps)` from inside the async send callback

#### Scenario: Fresh continuation with optimistic intent
- **WHEN** `createRecoveryAttempt(deps).tryFreshDraftReplacement("refresh failed: …")` is called
- **AND** `staleRecoveryClassification.reasonCode` is `malformed-thread-id` or `missing-thread-binding`
- **AND** `optimisticUserItem` exists
- **AND** `workspace` is available in `CodexMessageRecoveryDeps`
- **THEN** the hook SHALL call `startThreadForMessageSend(workspace, "codex")` to obtain a fresh thread id
- **AND** dispatch `setActiveThreadId` with the fresh id
- **AND** call `moveOptimisticUserIntentToThread(freshThreadId)`
- **AND** call `retrySendOnThread(freshThreadId)`
- **AND** return `true`

#### Scenario: Fork and retry path
- **WHEN** fresh continuation is not available
- **AND** `tryForkFromMessage(reason)` is called
- **AND** `reboundThreadId` is absent or points to the same missing thread
- **THEN** the hook SHALL call `forkThreadForWorkspace(workspace.id, threadId, { activate: true })`
- **AND** dispatch `setActiveThreadId` with the fork id when fork succeeds
- **AND** call `moveOptimisticUserIntentToThread(forkId)`
- **AND** call `retrySendOnThread(forkId)`
- **AND** return `true` on success or `false` on failure

#### Scenario: No-op when recovery is not applicable
- **WHEN** `staleRecoveryClassification` is `null`
- **OR** the error does not match `isInvalidReviewThreadIdError` / `isCodexMissingThreadBindingError`
- **THEN** `tryFreshDraftReplacement` SHALL return `false` without side effects

#### Scenario: Rebind path remains in useThreadMessaging
- **WHEN** `reboundThreadId` exists and differs from `threadId`
- **THEN** `useCodexMessageRecovery` SHALL NOT retry the rebound thread itself
- **AND** `useThreadMessaging` SHALL keep the existing rebind-and-retry branch responsible for dispatching the rebound id and retrying the send

### Requirement: Recovery MUST be idempotent within a single send attempt

The hook SHALL ensure `tryFreshDraftReplacement` is invoked at most once per send attempt by guarding with an internal `attempted` flag, even if called from multiple call sites.

#### Scenario: Repeated calls in same attempt
- **WHEN** `tryFreshDraftReplacement` is called twice in the same send attempt
- **THEN** the second call SHALL return `false` without re-running the recovery

### Requirement: Recovery MUST emit debug events

The hook SHALL call `onDebug` with payload `{ id, timestamp, source: "client", label: "turn/start draft fresh fallback", payload: { stage: "fresh-continuation", outcome, reasonCode, staleReason, userAction } }` for each recovery invocation.

#### Scenario: Debug event shape
- **WHEN** recovery runs successfully
- **THEN** `onDebug` SHALL be called exactly once with the documented payload shape
- **AND** `reasonCode` / `staleReason` / `userAction` SHALL be sourced from `staleRecoveryClassification` or `null` if absent
