## ADDED Requirements

### Requirement: Realtime Evidence MUST Correlate Visible-Lag Risk

Realtime performance reports MUST correlate first-token latency, inter-token jitter, batching behavior, terminal pressure, and visible-lag risk for the same scenario.

#### Scenario: realtime summary includes visible-lag risk
- **WHEN** realtime performance evidence is generated
- **THEN** the summary MUST include first-token latency and inter-token jitter where available
- **AND** the summary MUST classify visible-lag risk without hiding terminal-settlement pressure

#### Scenario: terminal pressure remains separate from provider delay
- **WHEN** realtime evidence shows terminal or batching pressure
- **THEN** the report MUST distinguish client-side terminal pressure from provider first-token delay
- **AND** it MUST NOT attribute all lag to the provider without correlated evidence
