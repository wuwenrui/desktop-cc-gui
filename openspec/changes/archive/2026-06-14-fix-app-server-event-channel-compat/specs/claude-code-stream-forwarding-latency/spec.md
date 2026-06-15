## ADDED Requirements

### Requirement: Claude Stream Forwarding MUST Reach A Frontend-Subscribed App Event Route

Claude Code stream forwarding guarantees MUST include frontend delivery route compatibility. Emitting an `AppServerEvent` from the backend is insufficient if the current frontend subscription strategy cannot receive that channel.

#### Scenario: text delta uses a subscribed route

- **WHEN** the Claude backend forwarder receives `EngineEvent::TextDelta`
- **AND** app-server event batching is enabled in the frontend
- **THEN** the emitted app-server event MUST be delivered through a channel that `useAppServerEvents` is subscribed to
- **AND** the live assistant text delta MUST be routed before the turn relies on history reload or terminal reconciliation.

#### Scenario: terminal turn event uses a subscribed route

- **WHEN** the Claude backend forwarder receives `EngineEvent::TurnCompleted` or `EngineEvent::TurnError`
- **AND** the producer still emits on legacy `app-server-event`
- **THEN** the frontend MUST still receive and route that terminal event
- **AND** the active turn MUST settle without waiting for a history refresh to infer completion.

#### Scenario: performance channel migration does not weaken hot path guarantee

- **WHEN** app-server event batching or another transport optimization is introduced
- **THEN** Claude `TextDelta`, `ReasoningDelta`, and `ToolOutputDelta` events MUST remain on a frontend-reachable low-latency route
- **AND** transport migration MUST NOT silently drop the event while backend diagnostics report successful emission.
