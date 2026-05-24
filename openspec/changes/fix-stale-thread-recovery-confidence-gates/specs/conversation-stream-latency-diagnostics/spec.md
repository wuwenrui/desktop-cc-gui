## MODIFIED Requirements

### Requirement: Stream Latency Diagnostics MUST Capture Correlated Turn Evidence

The system MUST record correlated latency evidence for streaming conversation turns so it can distinguish upstream provider delay, chunk cadence anomalies, client render amplification, and visible-output stalls.

#### Scenario: first token and render pacing are recorded with turn correlation

- **WHEN** a streaming conversation turn starts and later receives the first assistant chunk
- **THEN** the system MUST record first-token latency, first visible render latency, and subsequent chunk cadence summary
- **AND** records MUST include `workspaceId`, `threadId`, `engine`, `providerId/providerName/baseUrl`, `model`, and `platform` when available

#### Scenario: prolonged waiting or timeout still emits correlated latency evidence

- **WHEN** a streaming conversation remains in waiting state without receiving the first chunk, or eventually enters `FIRST_PACKET_TIMEOUT` or equivalent timeout
- **THEN** the system MUST record latency diagnostics with the same correlation dimensions
- **AND** diagnostics MUST distinguish no-first-packet from chunk cadence anomalies after ingress

#### Scenario: non-text runtime progress is not classified as backend silence

- **WHEN** a conversation has not yet received assistant text ingress
- **AND** the backend emits command execution, file change, tool output, terminal interaction, or equivalent runtime activity for the active turn
- **THEN** diagnostics MUST record that activity as non-text progress evidence
- **AND** first-token pending warnings MUST NOT fire solely because assistant text has not arrived yet
- **AND** the first assistant text latency MUST remain unset until assistant text ingress actually occurs

#### Scenario: candidate and active mitigation evidence are distinct

- **WHEN** a stream mitigation candidate profile is selected before or during visible render analysis
- **THEN** diagnostics MUST record candidate profile id and candidate reason separately from active mitigation profile id and active mitigation reason
- **AND** disabling active mitigation MUST NOT erase the evidence that a candidate was selected

### Requirement: Latency Diagnostics MUST Distinguish Upstream Delay From Client Render Amplification

The system MUST avoid recording all slow visible text symptoms as one root cause.

#### Scenario: upstream pending is classified without blaming renderer

- **WHEN** a conversation waits for a long time before receiving the first chunk
- **AND** renderer evidence does not show repeated render lag after chunk ingress
- **THEN** diagnostics MUST classify the slow path as upstream pending, first-token delay, or equivalent
- **AND** diagnostics MUST NOT report client render amplification as the primary cause

#### Scenario: render amplification is classified after chunk ingress exists

- **WHEN** a conversation has received chunks and chunk cadence is normal
- **AND** visible text or visible rows lag behind chunk arrival
- **THEN** diagnostics MUST classify the issue as client render amplification, render pacing lag, or equivalent
- **AND** diagnostics MUST retain evidence of active or candidate mitigation profile state

#### Scenario: first visible latency is classified before visible stall

- **WHEN** a Windows Claude Code turn has assistant text ingress
- **AND** the first visible render is delayed beyond the configured first-visible threshold
- **THEN** diagnostics MAY classify the delay separately from `visible-output-stall-after-first-delta`
- **AND** this classification MUST NOT be treated as proof of durable stale-thread recovery failure

### Requirement: Diagnostics MUST Compare Baseline And Optimized Paths

Realtime diagnostics MUST support comparing baseline and optimized behavior without requiring a code rebuild.

#### Scenario: rollback flag keeps comparable diagnostics

- **WHEN** an optimization flag disables batching, incremental derivation, render pacing, or mitigation activation
- **THEN** diagnostics MUST continue emitting comparable evidence dimensions
- **AND** triage MUST be able to determine whether the regression exists in the optimized path, the baseline path, or both

#### Scenario: threshold configuration remains bounded and rollback-safe

- **WHEN** first-visible, render-amplification, visible-output-stall, or preemptive-candidate thresholds are adjusted through an approved config/debug path
- **THEN** diagnostics MUST record the threshold source or effective threshold where practical
- **AND** rollback to default thresholds MUST preserve existing non-Windows and non-Claude behavior
