# conversation-stream-latency-diagnostics Specification

## Purpose

Define correlated stream latency diagnostics so the system can distinguish upstream provider delay, chunk cadence anomalies, and client-side render amplification during realtime conversation turns.
## Requirements
### Requirement: Stream Latency Diagnostics MUST Capture Correlated Turn Evidence

The system MUST record correlated latency evidence for streaming conversation turns so it can distinguish upstream provider delay, backend forwarding stalls, batch/reducer amplification, client render lag, terminal settlement delay, and visible-output stalls.

#### Scenario: turn trace links ingress through visible render

- **WHEN** a streaming conversation turn starts and later receives assistant/runtime events
- **THEN** diagnostics MUST preserve a turn-level correlation id or equivalent dimensions across event ingress, batch flush, reducer commit, first visible row render, first visible text growth, and terminal settlement where available
- **AND** records MUST include `workspaceId`, `threadId`, `engine`, `providerId/providerName/baseUrl`, `model`, and `platform` when available

#### Scenario: visible lag is classified after correlation

- **WHEN** assistant text ingress exists but visible text growth is delayed
- **THEN** diagnostics MUST classify the delay using correlated evidence from batch flush, reducer commit, render timing, and terminal pressure where surfaced
- **AND** the system MUST NOT infer backend or upstream stalls from frontend visible delay alone.

### Requirement: Stream Latency Diagnostics MUST Reuse Existing Diagnostics Surfaces And Stay Bounded

系统 MUST 复用现有 renderer/runtime/thread diagnostics surfaces 暴露 stream latency 证据，并保持事件数量有界。

#### Scenario: per-turn trace summary is bounded

- **WHEN** a long streaming turn emits many deltas
- **THEN** diagnostics SHOULD store bounded milestone summaries, counters, queue depth summaries, or sampled records instead of unbounded per-delta payloads
- **AND** payloads MUST NOT include prompt text, assistant body text, tool output body, or terminal output content.

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

### Requirement: Stream Latency Diagnostics MUST Classify Backend Forwarding Stalls Separately

The system MUST distinguish Claude backend event forwarding stalls from upstream first-token delay and frontend visible render stalls.

#### Scenario: backend stall is classified after engine event ingress
- **WHEN** the Claude engine has produced a stream delta inside the backend
- **AND** the corresponding app event is not emitted within the bounded forwarding window
- **THEN** diagnostics MUST classify the slow path as `backend-forwarder-stall` or an equivalent explicit category
- **AND** the classification MUST NOT be collapsed into upstream provider delay

#### Scenario: burst flush is classified when queued deltas arrive together
- **WHEN** multiple Claude deltas are emitted to the frontend after a long backend forwarding gap
- **THEN** diagnostics MUST record burst evidence such as max forwarding gap, queued delta count, or equivalent summary
- **AND** the classification MUST remain distinct from `visible-output-stall-after-first-delta`

#### Scenario: diagnostics correlate runtime sync and process snapshot timing
- **WHEN** backend forwarding latency overlaps runtime sync, process diagnostics, or ledger persistence work
- **THEN** diagnostics MUST preserve enough timing evidence to correlate the stall with that work
- **AND** the evidence MUST include `workspaceId`, `threadId`, `engine`, `platform`, and turn correlation where available

#### Scenario: backend evidence uses existing bounded diagnostics surfaces
- **WHEN** backend forwarding latency evidence is recorded for a Claude turn
- **THEN** the evidence MUST be written to an existing bounded diagnostics surface such as runtime diagnostics, renderer diagnostics correlation, app-server diagnostic events, structured logs, or an equivalent project-approved diagnostics channel
- **AND** the evidence MUST be correlatable by `workspaceId`, `threadId`, `turnId` where available, `engine`, and `platform`
- **AND** adding this evidence MUST NOT require changing the stable Tauri command payload contract for conversation streaming

#### Scenario: frontend classification only consumes backend evidence when surfaced
- **WHEN** backend forwarding evidence is exposed through an existing frontend-consumable diagnostics surface
- **THEN** frontend stream latency diagnostics MAY classify `backend-forwarder-stall` or burst-flush from that evidence
- **AND** when backend evidence is log-only, frontend diagnostics MUST keep using local ingress/render timing and MUST NOT infer backend-forwarder stalls from visible render delay alone

#### Scenario: frontend visible stall remains a separate category
- **WHEN** app events are emitted promptly but visible assistant text does not grow in the frontend
- **THEN** diagnostics MUST continue to classify the issue as `visible-output-stall-after-first-delta` or equivalent frontend render category
- **AND** backend forwarding stall evidence MUST NOT be reported as the primary category for that turn

### Requirement: Stream Diagnostics MUST Include Reducer Render And Composer Client Evidence
Stream latency diagnostics MUST capture frontend client evidence beyond first-token and visible text timing so triage can identify reducer, render, and composer hot paths.

#### Scenario: reducer amplification is observable after chunk ingress
- **WHEN** chunks arrive at normal cadence but reducer processing causes repeated expensive derivation or dispatch amplification
- **THEN** diagnostics MUST record bounded evidence such as batching queue size, flush count, reducer action counts, `prepareThreadItems(...)` call count or equivalent derivation cost, and affected thread id
- **AND** the classification MUST remain separate from upstream pending and backend forwarding stall

#### Scenario: composer responsiveness degradation is observable during streaming
- **WHEN** the user types while a conversation is streaming
- **THEN** diagnostics SHOULD capture bounded evidence of composer-facing update pressure or input responsiveness degradation when available
- **AND** this evidence MUST be correlated with stream engine, thread, turn, render profile, and active mitigation state

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

### Requirement: Stream Latency Diagnostics MUST Classify Claude First Token Delay Separately

The system MUST classify Claude Code first-token delay separately from backend forwarding stalls and frontend visible-output stalls.

#### Scenario: no stdout is classified as first-token startup latency
- **WHEN** a Claude Code turn has started and stdin has closed
- **AND** no stdout line has been observed within the bounded diagnostic window
- **THEN** diagnostics MUST classify the wait as Claude first-token or startup latency
- **AND** diagnostics MUST NOT report `backend-forwarder-stall` or `visible-output-stall-after-first-delta` as the primary category

#### Scenario: stdout without valid event is classified before parser ingress
- **WHEN** Claude Code stdout has produced at least one line
- **AND** no valid stream-json event has been parsed within the bounded diagnostic window
- **THEN** diagnostics MUST classify the wait as stdout-without-valid-event or equivalent parser/protocol startup latency
- **AND** diagnostics MUST preserve the distinction from no-stdout upstream delay

#### Scenario: valid event without text is classified before assistant ingress
- **WHEN** a valid Claude Code stream-json event has been parsed
- **AND** no assistant text delta has been emitted yet
- **THEN** diagnostics MUST classify the wait as valid-event-without-text or equivalent first-text latency
- **AND** diagnostics MUST NOT trigger frontend visible-stall mitigation until assistant text delta ingress exists

#### Scenario: malformed timing payloads are ignored safely
- **WHEN** frontend diagnostics receive missing, non-finite, negative, or otherwise malformed timing fields
- **THEN** diagnostics MUST ignore or clamp those fields safely
- **AND** diagnostic gap calculations MUST NOT produce negative durations

