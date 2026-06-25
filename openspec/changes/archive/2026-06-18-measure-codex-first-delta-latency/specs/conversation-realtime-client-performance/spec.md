## ADDED Requirements

### Requirement: Realtime Evidence MUST Report First Delta Latency Separately

Realtime performance evidence MUST expose first-delta latency as a separate measured metric when correlated turn trace summaries provide `sendToFirstDeltaMs`.

#### Scenario: first-delta latency is reported separately from visible lag

- **WHEN** `realtime.turnTrace.summary` contains measured `deltas.sendToFirstDeltaMs`
- **THEN** runtime performance evidence MUST include first-delta latency as a distinct metric or summary field
- **AND** it MUST NOT merge first-delta latency into visible text lag, reducer amplification, batch flush duration, or terminal settlement metrics

#### Scenario: slow first delta with healthy visible path points to upstream investigation

- **WHEN** first-delta latency is high for a Codex, Claude Code, or Gemini turn
- **AND** visible text latency is within budget
- **AND** reducer amplification does not show client-side amplification
- **THEN** the report MUST identify upstream/provider/startup phase investigation as the next action
- **AND** it MUST NOT recommend client render or row memo optimization as the primary action
