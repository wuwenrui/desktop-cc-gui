## ADDED Requirements

### Requirement: Tool Output Tail Gate MUST Throttle High-Frequency Streams

For events `item/commandExecution/outputDelta` and `item/fileChange/outputDelta`, the generic webview per-event backpressure MUST NOT apply last-write coalescing. `useToolOutputTailGate` MUST maintain an append buffer per `(workspaceId, itemId, kind)`. When more than one event for the same key arrives within a 32ms window, the gate MUST append their text payloads and submit at most one accumulated reducer update per window per key. In addition, `useToolOutputTailGate` MUST maintain a 60-second sliding window per key for tool output rate observability.

#### Scenario: 1024 deltas in 1 second for one tool item
- **WHEN** the per-event pipeline receives 1024 deltas for the same `(workspaceId, itemId, "commandExecution")` within 1 second
- **THEN** generic backpressure MUST NOT replace earlier deltas with the latest one
- **AND** `useToolOutputTailGate` MUST append-buffer them down to ~32 reducer updates
- **AND** the accumulated text MUST equal the concatenation of all 1024 deltas.

#### Scenario: tail gate saturation reported
- **WHEN** a tool item's delta rate exceeds the saturation threshold
- **THEN** `toolOutputTailGateSaturated` MUST be recorded in the runtime evidence report
- **AND** `gateSaturationCount` MUST increment by 1.

### Requirement: Tail Gate MUST Be Bypassed Under Baseline Tier

When `streamingScheduleTier === "baseline"`, the tail gate MUST bypass throttling and append-buffering. All tool output deltas MUST be submitted to the reducer immediately. This preserves the v0.5.13 behavior for users on the baseline tier.

#### Scenario: baseline tier does not enter BACKPRESSURE
- **WHEN** `streamingScheduleTier === "baseline"`
- **AND** 1024 deltas arrive for the same key
- **THEN** the gate MUST submit all 1024 deltas to the reducer
- **AND** the gate MUST NOT enter BACKPRESSURE mode.

### Requirement: Tool Output Deltas MUST NOT Enter Live Assistant Fast Path

`appendToolOutputDelta` events MUST NOT be routed through `canUseLiveAssistantDeltaFastPath` or any other live-text fast path. Tool output deltas MUST remain on a dedicated reducer path so that tail-gating cannot affect assistant text streaming latency.

#### Scenario: appendToolOutputDelta skips live fast path
- **WHEN** a tool output delta is processed by the reducer
- **THEN** the reducer MUST NOT invoke the live assistant delta fast path
- **AND** the assistant text delta path MUST remain unaffected by tool output backpressure.

### Requirement: Tail Gate Diagnostics MUST Be Observable

`useToolOutputTailGate` MUST expose diagnostics for runtime evidence and rollback verification: `gateSaturationCount`, `droppedDeltaCount`, `lastFlushDurationMs`, `bufferOverflowCount`, `activeKeys`.

#### Scenario: gate saturation reported after BACKPRESSURE
- **WHEN** the gate enters BACKPRESSURE for the first time in a session
- **THEN** `gateSaturationCount` MUST increment by 1
- **AND** `appendRendererDiagnostic("tool-output-tail-gate/saturated", { key, count })` MUST fire.

#### Scenario: buffer overflow diagnostic
- **WHEN** the ref buffer exceeds 1MB
- **THEN** `bufferOverflowCount` MUST increment by 1
- **AND** `appendRendererDiagnostic("tool-output-tail-gate/overflow", { key, sizeBytes })` MUST fire.

### Requirement: Tail Gate Runtime State MUST Be Bounded

`useToolOutputTailGate` MUST bound its per-key runtime state during long-running clients. Empty idle entries MUST be evicted after a TTL, active key count MUST stay under a configured cap, and evicting a buffered entry MUST flush its accumulated text before deletion so raw output is not lost. Consumers that maintain side metadata for gate keys MUST receive an eviction callback and release matching metadata.

#### Scenario: idle empty key is evicted
- **WHEN** a key has no buffered text, no pending flush timer, and has been idle longer than the TTL
- **THEN** the next submit MUST prune that key
- **AND** `activeKeys` MUST decrease.

#### Scenario: active key cap flushes before eviction
- **WHEN** active key count exceeds the configured cap
- **THEN** the gate MUST choose oldest keys for eviction
- **AND** any buffered text for those keys MUST be flushed before the key is deleted
- **AND** `droppedDeltaCount` MUST remain unchanged.

#### Scenario: side metadata is released with gate entry
- **WHEN** the tail gate evicts a key because of TTL or key cap
- **THEN** `useThreadItemEvents` MUST delete the matching `toolOutputMetadataRef` entry
- **AND** stale metadata MUST NOT keep completed item/thread ids alive.
