## ADDED Requirements

### Requirement: Realtime Evidence MUST Measure Codex Post-Ack First Delta Wait
Realtime performance evidence MUST distinguish Codex post-ack first-delta wait from frontend turn-start acknowledgement and renderer visible text latency when timing data is available.

#### Scenario: post-ack first-delta metric is reported
- **WHEN** a Codex turn has measured `turn/start` response acknowledgement and measured first text delta ingress timing
- **THEN** runtime performance reports MUST include a measured `codexPostAckFirstDeltaP95`
- **AND** the report MUST preserve `turnStartAckLatencyP95` and `firstDeltaLatencyP95` as separate metrics

#### Scenario: post-ack residual guides next action
- **WHEN** post-ack first-delta wait is high while visible lag and reducer amplification are healthy
- **THEN** the report MUST identify the next investigation area as backend/provider/startup before renderer optimization

#### Scenario: post-ack phase breakdown is reported when available
- **WHEN** Codex app-server diagnostics include first runtime event and first assistant text delta phase timings
- **THEN** runtime performance reports MUST include measured `codexPostAckFirstRuntimeEventP95`
- **AND** runtime performance reports MUST include measured `codexFirstRuntimeEventToFirstTextDeltaP95`
- **AND** runtime performance reports SHOULD include measured `codexFirstRuntimeEventToFirstAssistantItemP95` and `codexFirstAssistantItemToFirstTextDeltaP95` when assistant item phase fields are available
- **AND** turn-level diagnostics MUST expose bounded `methodsBeforeFirstTextDelta` and event counters without prompt, assistant text, tool output, terminal output, or file content
- **AND** missing phase fields from older artifacts MUST remain `unsupported` rather than being approximated

#### Scenario: provider first-response dominance is identified
- **WHEN** `firstRuntimeEventToFirstAssistantItemEventMs` accounts for most of `firstRuntimeEventToFirstTextDeltaMs`
- **AND** `firstAssistantItemEventToFirstTextDeltaMs` is small
- **THEN** runtime performance reports MUST emit a content-safe `providerFirstResponseDominates` note
- **AND** the note MUST guide investigation toward provider/model first-response phase before renderer optimization
