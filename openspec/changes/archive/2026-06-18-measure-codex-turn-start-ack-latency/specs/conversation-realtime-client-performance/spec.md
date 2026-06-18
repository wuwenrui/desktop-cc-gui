## ADDED Requirements

### Requirement: Realtime Evidence MUST Distinguish Turn Start Ack Latency

Realtime performance evidence MUST distinguish Codex turn-start acknowledgement latency from first-delta latency when both are available.

#### Scenario: turn-start ack latency is reported separately

- **WHEN** Codex `send_user_message` completes or fails after invoking backend `turn/start`
- **THEN** diagnostics MUST record bounded turn-start acknowledgement latency
- **AND** runtime performance reports MUST NOT merge it into first-delta latency or visible text latency

#### Scenario: first-delta residual remains visible after ack

- **WHEN** first-delta latency is high and turn-start ack latency is available
- **THEN** the report MUST preserve enough data to estimate post-ack first-delta wait
- **AND** the next action MUST distinguish backend ack delay from provider/startup waiting after ack
