## ADDED Requirements

### Requirement: Realtime Event Optimization MUST Preserve Codex Ownership Gates

Realtime batching, raw-event compatibility routing, normalized realtime adapters, and late-event suppression MUST preserve Codex event ownership gates. Performance optimizations MUST NOT allow stale or ambiguous events to recreate processing state after terminal settlement.

#### Scenario: batched late event cannot revive terminal Codex turn
- **WHEN** realtime event batching flushes a Codex event after the target turn has completed, failed, stalled, or been abandoned
- **THEN** the flush MUST respect terminal/quarantine state
- **AND** it MUST NOT mark the thread processing or append lifecycle-visible progress for the old turn

#### Scenario: raw and normalized paths share ownership semantics
- **WHEN** equivalent Codex activity is received through raw app-server compatibility routing or normalized realtime routing
- **THEN** both paths MUST apply equivalent owner checks before lifecycle mutation
- **AND** neither path MAY use active UI selection as lifecycle ownership proof

#### Scenario: optimization preserves explicit owner priority
- **WHEN** a batched or coalesced Codex event includes explicit thread and turn ownership
- **THEN** optimization MAY defer or coalesce processing
- **AND** final mutation MUST still route to the explicit owner rather than the active conversation at flush time

#### Scenario: owner decision is made before coalesced mutation
- **WHEN** multiple realtime events are coalesced for render or reducer efficiency
- **THEN** each lifecycle-sensitive Codex event MUST carry or resolve its owner before mutation
- **AND** a later active-thread selection change MUST NOT change the event target during flush

### Requirement: Ownership Hardening MUST Preserve Non-Codex Engine Realtime Semantics

Codex ownership gates MUST NOT regress Claude Code, Gemini, or OpenCode realtime semantics. Shared batching and adapter utilities MAY be reused only when engine-specific behavior remains unchanged.

#### Scenario: Claude Code legacy single channel still routes under batching
- **WHEN** app-server event batching is enabled
- **AND** Claude Code emits legacy single-channel agent delta or turn completion events with explicit `threadId`
- **THEN** those events MUST continue routing to the Claude thread
- **AND** Codex ownership fallback rules MUST NOT suppress them

#### Scenario: Claude normalized events preserve explicit completion
- **WHEN** Claude Code normalized realtime events include explicit thread and turn identity
- **THEN** completion and context usage semantics MUST remain unchanged
- **AND** Codex-specific settled-turn quarantine MUST NOT be applied as a Claude lifecycle rule

#### Scenario: Gemini and OpenCode adapters remain non-fatal
- **WHEN** Gemini or OpenCode receives unknown or unsupported realtime methods
- **THEN** adapter behavior MUST remain non-fatal according to existing engine contracts
- **AND** Codex ownership diagnostics MUST NOT convert those events into lifecycle errors

#### Scenario: multi-engine batching remains lossless
- **WHEN** Codex, Claude Code, Gemini, or OpenCode realtime events are batched or flushed under streaming pressure
- **THEN** accepted events MUST remain ordered and lossless within their thread/item lineage
- **AND** Codex ambiguous-event suppression MUST NOT drop explicit non-Codex events

### Requirement: Realtime Regression Tests MUST Cover Both Performance And Ownership Semantics

Realtime optimization tests MUST cover ownership-sensitive behavior so future performance changes do not reintroduce Codex session contamination.

#### Scenario: existing performance contracts remain green
- **WHEN** Codex ownership hardening is implemented
- **THEN** existing realtime adapter, batcher, and history parity tests for Codex/Claude/Gemini/OpenCode MUST remain green
- **AND** reducer/render optimization semantics MUST remain lossless

#### Scenario: late-event regression covers raw and normalized input
- **WHEN** a Codex turn is terminal
- **AND** a late event for the old turn arrives through raw app-server routing or normalized realtime routing
- **THEN** tests MUST prove neither path revives processing state
- **AND** the old terminal turn MUST remain quarantined

#### Scenario: active selection changes cannot affect buffered Codex events
- **WHEN** a Codex event is accepted into a batching or deferred processing path
- **AND** the user switches active thread before the event is flushed
- **THEN** the eventual mutation MUST still target the resolved owner
- **AND** it MUST NOT target the newly active thread

#### Scenario: deferred presentation snapshot cannot cross active conversation scope
- **WHEN** two Codex conversations are processing concurrently
- **AND** the user switches the active tab while one conversation still has a deferred render or presentation snapshot
- **THEN** the newly active conversation MUST render from a snapshot whose scope matches its `workspaceId + threadId`
- **AND** a stable snapshot from the previously active conversation MUST NOT be merged into the new conversation curtain

#### Scenario: same-thread streaming stabilization remains enabled
- **WHEN** a Codex or Claude Code conversation keeps streaming inside the same `workspaceId + threadId` scope
- **THEN** parent timeline derivations MAY continue to use the deferred stable snapshot
- **AND** live assistant/reasoning rows MUST still override from the latest source items
