## ADDED Requirements

> **Implementation Status (本 change)**: 本 change 已完成 (reducer fast path 解除 + 4 引擎等价性 Vitest)。


### Requirement: Live Assistant Delta MUST Use A Provider-Agnostic Fast Path

`appendAgentDelta` MUST use the incremental derivation fast path for claude, codex, gemini, and opencode threads when the assistant message is the last item, canonicalization is not required, and final metadata does not need to be preserved.

#### Scenario: non-claude tail delta hits the fast path

- **WHEN** a `codex:`, `gemini:`, or `opencode:` thread receives a streaming `appendAgentDelta` for the last assistant message
- **AND** `shouldCanonicalizeLegacyId === false`
- **AND** `keepFinalMetadata === false`
- **THEN** the reducer MUST update the message through the live assistant delta fast path
- **AND** MUST NOT call `prepareThreadItems` for that delta.

#### Scenario: slow path remains reachable for semantic derivation

- **WHEN** the assistant message is not the last item
- **OR** `shouldCanonicalizeLegacyId === true`
- **OR** `keepFinalMetadata === true`
- **THEN** the reducer MUST use the existing `prepareThreadItems` slow path.

#### Scenario: terminal message completion remains slow-path covered

- **WHEN** `completeAgentMessage` finalizes a streaming message
- **THEN** tests MUST prove the final item list matches the slow-path baseline
- **AND** final metadata MUST be preserved.

### Requirement: Fast Path Equivalence MUST Be Proven Across Streaming Edge Cases

Provider-agnostic fast path behavior MUST be covered by targeted tests before it is enabled by default.

#### Scenario: reasoning and assistant deltas interleave

- **WHEN** reasoning deltas and assistant deltas interleave during a codex streaming burst
- **THEN** reasoning item positions MUST remain stable
- **AND** the assistant message MUST continue to receive tail deltas correctly.

#### Scenario: tool or generated image items require derivation safety

- **WHEN** tool items or generated image items are present in the same turn
- **THEN** tests MUST verify that fast-path deltas do not break generated image anchor binding
- **AND** any reorder/canonicalization case MUST fall back to `prepareThreadItems`.

### Requirement: Realtime Reducer Evidence MUST Be Reported

Runtime evidence gates MUST report reducer hot-path metrics so streaming regressions can be detected.

#### Scenario: prepareThreadItems call rate is reported

- **WHEN** a 1000-delta streaming fixture runs
- **THEN** `prepareThreadItems_calls_per_1000_delta` MUST be present
- **AND** calls MUST only come from terminal/reorder/canonicalization scenarios.

#### Scenario: reducer and route timing are reported

- **WHEN** the realtime performance gate runs
- **THEN** `thread_reducer_flush_ms_p95` MUST be present
- **AND** `realtime_delta_route_ms_p95` MUST be present.
