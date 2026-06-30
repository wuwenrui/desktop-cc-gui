# realtime-event-batching-performance Specification

## Purpose
TBD - created by archiving change optimize-realtime-event-batching. Update Purpose after archive.
## Requirements
### Requirement: Realtime Batching MUST Preserve First-Token Semantics

The first user-visible assistant delta for a turn MUST be delivered without batching delay.

#### Scenario: first assistant delta flushes immediately

- **WHEN** the first assistant text delta for a turn arrives
- **THEN** it MUST be delivered to the UI path immediately
- **AND** batching MUST NOT make `S-RS-FT.firstTokenLatency` worse than the recorded fixture baseline

### Requirement: Batching MUST Preserve Event Order And Final Content

Coalescing MUST preserve the order and final content of realtime text/tool deltas.

#### Scenario: coalesced deltas produce the same final message

- **WHEN** multiple deltas are coalesced
- **THEN** the final assistant/tool content MUST equal the content produced by immediate processing
- **AND** relative order MUST be preserved

### Requirement: Terminal Events MUST Flush Pending Batches

Turn completion, interruption, error, and dedup settlement MUST flush pending deltas before final state is committed.

#### Scenario: completion flushes pending deltas

- **WHEN** a terminal event arrives while deltas are pending
- **THEN** pending deltas MUST be applied before the terminal state is visible

### Requirement: Dedup Semantics MUST Remain Stable

Batching MUST NOT change dedup identity or the recorded meaning of `S-RS-PE.dedupHitRatio = 0.25`.

#### Scenario: dedup ratio remains semantically stable

- **WHEN** the realtime extended baseline runs
- **THEN** dedup behavior MUST match existing replay expectations
- **AND** duplicate responses MUST NOT reappear because of delayed batches

### Requirement: Batching MUST Not Redefine Canonical Runtime Events

This capability MUST change delivery cadence only; it MUST NOT introduce new canonical realtime event names or a domain EventBus.

#### Scenario: normalized event contract remains unchanged

- **WHEN** batching is enabled
- **THEN** `NormalizedThreadEvent` shape and adapter normalization tests MUST continue to pass
- **AND** `openspec validate optimize-realtime-event-batching --strict --no-interactive` MUST pass

### Requirement: Tool Output Deltas MUST Append-Buffer By `(workspaceId, itemId, kind)` When Consecutive Deltas Are < 32ms Apart

When consecutive `item/commandExecution/outputDelta` or `item/fileChange/outputDelta` events for the same `(workspaceId, itemId, kind)` key arrive less than 32ms apart, the generic webview per-event backpressure MUST NOT last-write coalesce them. Instead, `useToolOutputTailGate` MUST append-buffer their text payloads and release at most one accumulated reducer update per 32ms window per key.

#### Scenario: 1000 stdout deltas in 1s append-buffer to ~32 reducer updates
- **WHEN** 1000 `item/commandExecution/outputDelta` events for the same `(workspaceId, itemId, "commandExecution")` arrive within 1 second
- **THEN** the generic per-event backpressure MUST deliver the raw deltas without last-write replacement
- **AND** `useToolOutputTailGate` MUST append-buffer them down to at most ~32 reducer updates
- **AND** the final accumulated text MUST equal the concatenation of all 1000 deltas.

#### Scenario: tool tail saturation reported
- **WHEN** a tool item's delta count exceeds 256 within 60 seconds
- **THEN** `toolOutputTailGateSaturated` MUST be recorded in the runtime evidence report
- **AND** `gateSaturationCount` MUST increment by 1.

### Requirement: Tool Output Coalesce MUST NOT Affect Live Assistant Delta Path

The webview per-event backpressure MUST NOT coalesce `appendAgentMessageDelta` events. The live assistant delta fast path established by `realtime-input-render-budget` MUST remain unchanged.

#### Scenario: live assistant delta unaffected by tool saturation
- **WHEN** a tool item is in tail-gate saturation mode
- **AND** an `appendAgentMessageDelta` event for the same turn arrives
- **THEN** the live delta MUST dispatch on the standard per-event path
- **AND** MUST NOT be throttled or coalesced by the per-event backpressure.
