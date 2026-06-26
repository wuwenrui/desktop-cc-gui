# codex-message-recovery-hook Specification

## Purpose
TBD - created by archiving change refactor-v0511-thread-messaging-recovery-and-streaming. Update Purpose after archive.
## Requirements
### Requirement: useCodexMessageRecovery MUST expose recovery entry points

The hook SHALL export `useCodexMessageRecovery` as a top-level React hook returning `createRecoveryAttempt(deps)`. Each attempt SHALL expose at least `tryFreshDraftReplacement(fallbackReason)`, `tryForkFromMessage(reason)`, `canUseFreshDraftReplacement`, and `isUnverifiedSameThreadMissingRebind`.

#### Scenario: provider-bound fresh continuation

- **WHEN** `createRecoveryAttempt(deps).tryFreshDraftReplacement(...)` creates a fresh Codex continuation
- **AND** `deps.providerProfileId` is a non-empty string after trimming
- **THEN** the hook SHALL call `startThreadForMessageSend(workspace, "codex", { providerProfileId })`
- **AND** the debug event payload SHOULD include the normalized `providerProfileId`
- **AND** whitespace-only provider ids SHALL be omitted from the call.

#### Scenario: provider-bound fork retry path

- **WHEN** `createRecoveryAttempt(deps).tryForkFromMessage(...)` creates a fork continuation
- **AND** `deps.providerProfileId` is a non-empty string after trimming
- **THEN** the hook SHALL call `forkThreadForWorkspace(workspace.id, threadId, { activate: true, providerProfileId })`
- **AND** whitespace-only provider ids SHALL be omitted from the call.

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
