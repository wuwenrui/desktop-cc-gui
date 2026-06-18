## ADDED Requirements

### Requirement: Live Assistant Delta Commits MUST Avoid Transition Lag
The realtime client MUST treat flushed live assistant text deltas as latency-critical reducer work once batching has decided to deliver them.

#### Scenario: cadence-flushed live assistant delta commits urgently
- **WHEN** `appendAgentMessageDelta` events have been coalesced by the realtime event batcher
- **AND** the batcher emits a `cadence`, `manual`, or `first-token` flush
- **THEN** the client MUST dispatch the reducer mutation without wrapping that live delta in transition scheduling
- **AND** the reducer path MUST preserve existing terminal turn filtering before mutating state

#### Scenario: terminal and heavier normalized events keep guarded scheduling
- **WHEN** normalized realtime events are terminal completions, tool events, reasoning events, snapshots, or other non-live assistant delta work
- **THEN** the client MUST preserve the existing ordering and terminal-fence semantics
- **AND** it MUST NOT broaden urgent scheduling to unrelated heavy event classes without separate evidence and tests

#### Scenario: reducer fast path remains bounded
- **WHEN** a long Codex, Gemini, or OpenCode assistant message receives many live text deltas
- **THEN** reducer commits for the live delta path MUST avoid `prepareThreadItems`
- **AND** batching/coalescing MUST remain available to bound dispatch count under streaming pressure

### Requirement: Lightweight Markdown Visible Text MUST Track Live Assistant Growth
When a live assistant row uses lightweight Markdown streaming, the client MUST keep visible-text diagnostics aligned with the current assistant item even if Markdown's rendered-value callback is delayed by throttling or progressive reveal.

#### Scenario: Codex recovery row reports current visible text during callback delay
- **WHEN** `codex-markdown-stream-recovery` is active for a streaming Codex assistant row
- **AND** the row remains on lightweight Markdown rather than plain text
- **AND** Markdown does not immediately call `onRenderedValueChange` for the latest `displayText`
- **THEN** the row MUST still report the current assistant `itemId` and text to `onAssistantVisibleTextRender`
- **AND** the report MUST NOT force the final completed message to bypass full Markdown rendering

#### Scenario: visible stall classification stays evidence based
- **WHEN** no `realtime.turnTrace.summary` is emitted after a hot-start validation turn
- **AND** raw renderer diagnostics emit `visible-output-stall-after-first-delta`
- **THEN** the next optimization target MUST be selected from the visible render/reporting evidence rather than assuming reducer commit lag persisted
