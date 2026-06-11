## ADDED Requirements

### Requirement: Live Message Canvas MUST Stay Visually Stable During Streaming

The realtime conversation message canvas MUST keep the active assistant output readable while streaming text grows, even when virtualization and browser layout measurement are under pressure.

#### Scenario: live assistant tail remains visible while text grows

- **WHEN** an assistant message is actively streaming text into the live tail row
- **THEN** the message canvas MUST keep that live row renderable and visible
- **AND** the system MUST NOT require history replay, turn completion, or a full timeline rebuild before newly arrived text becomes visible

#### Scenario: active live row uses stable layout during streaming

- **WHEN** the active live row is receiving realtime deltas
- **THEN** the row MUST use a layout strategy that avoids stale measured height causing overlapping or disappearing content
- **AND** the strategy MUST remain local to the live canvas/tail path rather than forcing every historical row into a heavier rendering mode

### Requirement: Message Timeline Virtualization MUST Recover From Suspicious Empty Visible Sets

The message timeline MUST detect and recover from transient virtualization states that can blank or overlap the live message canvas.

#### Scenario: virtualizer collapse triggers bounded remeasure

- **WHEN** timeline virtualization is enabled
- **AND** the timeline has one or more projection rows
- **AND** the virtualizer reports no visible items while a scroll element is available
- **THEN** the system MUST request a bounded virtualizer remeasure or equivalent recovery nudge
- **AND** it MUST NOT disable virtualization globally as the primary recovery mechanism

#### Scenario: suspicious live row absence is handled without full rebuild

- **WHEN** an active live row is expected during streaming
- **AND** the virtualized visible set temporarily omits that row due to measurement or offset instability
- **THEN** the system MAY request bounded remeasurement or keep the live row in a stable render path
- **AND** it MUST NOT force parent timeline heavy derivations to recompute on every text delta

### Requirement: Live Canvas Render Instability MUST Leave Bounded Privacy-Safe Diagnostics

The system MUST record bounded diagnostics for suspicious live message canvas render states so triage can distinguish client render instability from upstream provider delay and backend forwarding stalls.

#### Scenario: diagnostics record virtualizer collapse without message text

- **WHEN** the live message canvas detects suspicious empty virtualizer output or live-row visibility risk
- **THEN** diagnostics MUST record bounded structural evidence such as row counts, virtual item counts, streaming state, and active-row expectation
- **AND** diagnostics MUST NOT include assistant message text, user prompt text, or full transcript content

#### Scenario: diagnostics remain bounded during long streaming turns

- **WHEN** a long streaming turn repeatedly enters the same suspicious render state
- **THEN** diagnostics MUST be rate-limited or otherwise bounded
- **AND** the diagnostic path MUST NOT become part of the per-delta render hot path
