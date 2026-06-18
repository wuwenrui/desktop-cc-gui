## ADDED Requirements

### Requirement: Turn Trace Summary MUST Be Consistent With Visible Stream Evidence

The system MUST validate turn-level trace summary counters and deltas against visible stream latency evidence before using them as proof of client-side batch, reducer, or render lag.

#### Scenario: fast visible output is not reported as client batch lag without corroboration

- **WHEN** a completed streaming turn has measured visible text growth with `firstVisibleTextAfterDeltaMs` and `lastVisibleTextAfterDeltaMs` under the configured visible-output thresholds
- **AND** `realtime.turnTrace.summary` reports large `batchFlushDurationAvgMs`, `firstDeltaToBatchFlushEndMs`, or `batchFlushEndToReducerCommitMs`
- **THEN** diagnostics MUST preserve the measured summary values
- **AND** performance reports MUST mark the turn as requiring trace consistency review or equivalent caution instead of claiming confirmed client-side batch/reducer lag

#### Scenario: visible text growth counter reflects latest bounded growth count

- **WHEN** a streaming turn renders visible assistant text multiple times after the first engine delta
- **THEN** the turn trace summary MUST keep the first visible text growth milestone as the first growth timestamp
- **AND** `counters.visibleTextGrowthCount` MUST reflect the latest bounded visible text growth count reported by stream latency diagnostics
- **AND** the counter MUST NOT remain pinned to `1` after later visible text growth has been observed

#### Scenario: batch flush duration remains distinct from route work duration

- **WHEN** batch flush timing is recorded with precise route timing fields
- **THEN** diagnostics MUST keep queue/window duration, app server event route duration, and per-delta route duration as separate counters
- **AND** performance reports MUST NOT use batch flush duration alone as proof of route work or reducer work latency

#### Scenario: reducer amplification is interpreted only with matching delta counters

- **WHEN** `reducerCommitCount`, `deltaCount`, or `reducerAmplification` are exported in `realtime.turnTrace.summary`
- **THEN** the report MUST include enough context to determine whether reducer amplification is based on assistant/runtime deltas for the same correlated turn
- **AND** missing or inconsistent counters MUST be treated as incomplete evidence rather than release-grade proof of reducer pressure
