# streaming-dispatch-decision-table Specification

## Purpose
TBD - created by archiving change refactor-v0511-thread-messaging-recovery-and-streaming. Update Purpose after archive.
## Requirements
### Requirement: Dispatch decision MUST be based on operation type and flush reason

The streaming dispatch layer SHALL use a fixed decision table to route each `NormalizedThreadEvent` to exactly one of three channels: `batch-aggregator`, `batch-contract`, or `urgent-dispatch`.

#### Scenario: Agent message delta is urgent
- **WHEN** `event.operation === "appendAgentMessageDelta"`
- **THEN** the event SHALL be routed to `urgent-dispatch` (no transition; `useTransitionForDispatch: false`)
- **AND** it SHALL NOT be aggregated by either batch channel

#### Scenario: Reasoning delta is urgent on first token only
- **WHEN** `event.operation === "appendReasoningContentDelta"`
- **AND** `flush.reason === "first-token"`
- **THEN** the event SHALL be routed to `urgent-dispatch`

#### Scenario: Reasoning delta is batched in steady state
- **WHEN** `event.operation === "appendReasoningContentDelta"`
- **AND** `flush.reason !== "first-token"`
- **THEN** the event SHALL be routed to `batch-aggregator`
- **AND** it SHALL NOT trigger urgent dispatch

#### Scenario: Other delta operations are batched
- **WHEN** `event.operation` is `appendReasoningSummaryDelta`, `appendToolOutputDelta`, `itemStarted`, or `itemUpdated`
- **THEN** the event SHALL be routed to `batch-aggregator`
- **AND** it SHALL NOT trigger urgent dispatch

### Requirement: Decision predicates MUST be pure

The three decision predicates (`shouldBatchNormalizedRealtimeEvent`, `shouldUseContractRealtimeBatcher`, `shouldDispatchNormalizedRealtimeEventUrgently`, and the new `shouldUrgentlyDispatchReasoningDelta`) SHALL be pure functions with no side effects, no React state access, and no I/O.

#### Scenario: Predicate inputs and outputs
- **WHEN** a predicate is called with the same `NormalizedThreadEvent` and `FlushReason`
- **THEN** the predicate SHALL return the same boolean on every call
