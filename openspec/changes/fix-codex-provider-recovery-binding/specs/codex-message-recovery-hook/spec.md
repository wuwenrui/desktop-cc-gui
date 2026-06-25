## MODIFIED Requirements

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
