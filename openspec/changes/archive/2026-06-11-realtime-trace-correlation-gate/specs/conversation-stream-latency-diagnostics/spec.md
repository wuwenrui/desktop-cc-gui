## MODIFIED Requirements

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
