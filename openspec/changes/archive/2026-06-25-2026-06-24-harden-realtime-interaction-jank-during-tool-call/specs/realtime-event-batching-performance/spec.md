## ADDED Requirements

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
