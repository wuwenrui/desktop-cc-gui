## ADDED Requirements

### Requirement: Critical Events MUST Bypass Cadence In The Per-Event Backpressure Hub

When the webview `appServerEventDeliverHub` per-event backpressure classifies an `AppServerEvent` as critical (containing any of `turn/completed`, `turn/error`, `runtime/ended`, `item/tool/requestUserInput`, `approval/request`, `collaboration/modeBlocked`, `collaboration/modeResolved`), the event MUST be delivered to subscribers immediately without applying the per-flush event count, byte budget, or queue depth limits.

#### Scenario: critical event delivered before queued non-critical
- **WHEN** a non-critical event is in the per-event backpressure queue
- **AND** a critical event arrives
- **THEN** the critical event MUST be delivered to subscribers immediately
- **AND** the previously queued non-critical event MUST retain its position in the queue.

### Requirement: Input Pending MUST Force Idle Yield Between Dispatch Chunks

The webview per-event dispatch loop MUST listen for input pending signals (`pointerdown`, `keydown`, `wheel` capture-phase listeners plus `navigator.scheduling?.isInputPending?.()`) and force an idle yield between chunks when any signal fires.

#### Scenario: pointerdown yields mid-queue
- **WHEN** the dispatcher is processing the second chunk of a 200-event queue
- **AND** a `pointerdown` event fires
- **THEN** the current chunk MUST complete
- **AND** the next chunk MUST be deferred until the input is processed or until the next idle callback.
