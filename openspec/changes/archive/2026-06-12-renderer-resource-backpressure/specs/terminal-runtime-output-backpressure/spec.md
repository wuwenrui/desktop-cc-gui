## ADDED Requirements

### Requirement: Terminal And Runtime Output MUST Use A Bounded Backpressure Path

Terminal and runtime non-critical output MUST be delivered to React through a bounded queue with explicit flush budgets, while critical lifecycle events remain lossless.

#### Scenario: high-volume output is batched per frame

- **WHEN** terminal output or runtime log lines arrive faster than React can render
- **THEN** non-critical events MUST be batched and flushed at animation-frame or equivalent scheduling boundaries
- **AND** each flush MUST respect documented max event and max byte budgets.

#### Scenario: critical events bypass loss-prone queues

- **WHEN** an event is classified as critical, such as terminal exit, fatal runtime status, session-ending error, or final settlement marker
- **THEN** it MUST bypass dropping/coalescing behavior or be delivered within the documented bounded time
- **AND** tests MUST prove it is not evicted by burst output.

#### Scenario: coalesced and dropped events are visible

- **WHEN** non-critical events are coalesced or evicted
- **THEN** diagnostics MUST report dropped count, coalesced count, queue depth, flush duration, and event kind summary
- **AND** reports MUST avoid terminal output body content.

#### Scenario: recent output remains visible and raw export remains available

- **WHEN** the bounded queue reaches capacity
- **THEN** oldest non-critical display events MAY be evicted from the renderer queue
- **AND** complete raw output MUST remain available through existing source/export paths when those paths are supported.
