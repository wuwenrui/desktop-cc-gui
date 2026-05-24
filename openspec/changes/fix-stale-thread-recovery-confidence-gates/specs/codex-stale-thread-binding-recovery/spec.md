## MODIFIED Requirements

### Requirement: Verified Codex Thread Replacement MUST Survive Restart

When a `Codex` stale thread has been recovered to a new canonical `threadId`, the system MUST persist the replacement only after the replacement has been verified as a high-confidence durable rebind.

#### Scenario: persisted alias remaps stale thread after restart

- **WHEN** a `Codex` thread replacement has been verified as `oldThreadId -> canonicalThreadId`
- **AND** the recovery decision is high confidence and non-ambiguous
- **AND** the user restarts the application and opens the same workspace or historical session
- **THEN** the lifecycle entrypoint MUST canonicalize the old `threadId` to the persisted `canonicalThreadId`
- **AND** the system MUST NOT call the known invalid old `threadId` before trying the canonical target

#### Scenario: alias chain resolves to latest canonical target

- **WHEN** a stale `threadId` forms a chain of verified replacements
- **THEN** the persisted alias read result MUST converge to the latest canonical `threadId`
- **AND** reopen and restore paths MUST NOT pass through stale intermediate thread ids

#### Scenario: low-confidence replacement does not persist durable alias

- **WHEN** stale-thread recovery finds a replacement candidate
- **AND** the candidate is based only on weak evidence such as a single newly discovered row, title similarity, or provider/source similarity without enough score gap or history evidence
- **THEN** the system MAY surface the candidate as degraded or user-confirmable recovery
- **BUT** it MUST NOT persist `oldThreadId -> candidateThreadId` as a durable alias

#### Scenario: ambiguous replacement keeps source session explainable

- **WHEN** two or more replacement candidates have equivalent or insufficiently separated recovery scores
- **THEN** automatic durable alias persistence MUST be rejected with an explicit ambiguous reason
- **AND** the source session surface MUST remain explainable as stale, degraded, or needing explicit recovery

### Requirement: Codex Stale Binding Recovery MUST Be Durable-Safe

Codex stale thread binding recovery MUST preserve durable local activity and MUST NOT silently replace durable conversations with fresh threads or unverified aliases.

#### Scenario: durable stale thread requires verified rebind or explicit fresh continuation

- **WHEN** a stale Codex thread has accepted user turn, assistant response, tool activity, approval, generated image, or other durable local activity
- **THEN** the system MUST first attempt verified rebind through the stale-thread recovery contract
- **AND** fresh continuation MUST be explicit and user-visible rather than silently replacing the old thread

#### Scenario: recoverable stale send retries at most once

- **WHEN** send or resume fails with recoverable stale binding signal such as `thread-not-found`, `session-not-found`, `broken-pipe`, or `runtime-ended`
- **THEN** the system MAY attempt automatic recovery and retry the user action at most once
- **AND** repeated failure MUST settle to visible recovery state rather than entering retry storm

#### Scenario: recovery failure preserves old thread visibility

- **WHEN** stale binding recovery fails
- **THEN** UI MUST keep the source thread explainable as stale, abandoned, unrecovered, degraded-readable, or requiring fresh continuation
- **AND** the system MUST NOT silently clear local history or bind it to an unrelated thread

#### Scenario: alias rollback does not delete thread content

- **WHEN** a persisted stale-thread alias later fails to load or fails a consistency check
- **THEN** the system MAY remove the alias mapping for the stale source id
- **AND** alias rollback MUST NOT delete the source thread history or the candidate replacement thread

### Requirement: Fresh Continuation MUST Preserve User Intent Visibility

When stale Codex recovery falls back to a fresh thread, the user's immediate intent MUST remain visible and target the new active identity.

#### Scenario: fresh continuation renders the replayed prompt

- **WHEN** a recover-and-resend or first-turn fallback sends a prompt to a fresh Codex thread
- **THEN** the user prompt MUST be rendered or otherwise visibly represented in the fresh thread
- **AND** duplicate suppression MUST NOT hide the prompt merely because the action originated from a stale source thread

#### Scenario: fresh continuation keeps old thread explainable

- **WHEN** a fresh continuation replaces or supersedes a stale Codex source identity
- **THEN** the old thread surface MUST remain explainable as stale, abandoned, replaced, or degraded-readable when visible
- **AND** the UI MUST NOT imply that old context was fully preserved unless verified rebind occurred

#### Scenario: automatic agent session creation is reason-coded

- **WHEN** the app creates a fresh `agentN` style session after stale reopen or large-context recovery failure
- **THEN** the new session MUST carry a user-visible or diagnostic reason code for fresh continuation
- **AND** the UI MUST NOT present the fresh session as the original session unless a verified durable rebind exists

## ADDED Requirements

### Requirement: Sidebar Catalog Hydration MUST Use Full Catalog As Fact Source

The active workspace sidebar MUST use full active project catalog hydration as its fact source and MUST NOT write a startup first-page subset into the main project session list.

#### Scenario: active startup uses full catalog

- **WHEN** active workspace startup hydrates the sidebar project session list
- **THEN** the hydration task MUST request `full-catalog`
- **AND** it MUST NOT request or apply a `first-page` subset

#### Scenario: full catalog consumes backend catalog cursors internally

- **WHEN** the backend catalog returns a page with `nextCursor`
- **THEN** sidebar full-catalog hydration MUST continue fetching catalog pages internally
- **AND** the applied main list MUST include all fetched active catalog sessions until `nextCursor=null` or a bounded degraded stop condition occurs
- **AND** the remaining catalog cursor MUST NOT be exposed as a normal sidebar load-older cursor

#### Scenario: stale full catalog hydration remains retryable

- **WHEN** a `full-catalog` hydration result is discarded because a newer workspace thread-list request superseded it
- **THEN** the workspace MUST NOT be marked as fully catalog-hydrated
- **AND** a later background hydration pass MUST be allowed to retry `full-catalog`

#### Scenario: active workspace full catalog has priority

- **WHEN** the active workspace still needs full-catalog hydration
- **AND** other unrelated workspaces also need idle background hydration
- **THEN** the active workspace full-catalog hydration MUST run before unrelated idle workspace prewarm
- **AND** the sidebar SHOULD align with strict project session list count/order after that full-catalog pass applies

#### Scenario: direct tracked refresh does not downgrade active workspace to a subset

- **WHEN** the active workspace sidebar has already converged to `full-catalog`
- **AND** a manual, reload, rename, or other direct `listThreadsForWorkspaceTracked(workspace)` refresh runs without an explicit startup hydration kind
- **THEN** the refresh MUST use `full-catalog`
- **AND** it MUST NOT overwrite the active sidebar with startup `first-page` rows or any other subset projection
