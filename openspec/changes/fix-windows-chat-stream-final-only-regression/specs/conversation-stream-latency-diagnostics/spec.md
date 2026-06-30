## ADDED Requirements

### Requirement: Codex First Text Timing MUST Recognize Supported Delta Aliases

Codex backend timing diagnostics MUST classify supported app-server assistant text delta aliases as first text ingress when they carry non-empty assistant text, so version skew or Windows wrapper installs do not appear as terminal-only output when streaming deltas were actually received.

#### Scenario: canonical Codex delta starts first text timing

- **WHEN** the Codex app-server emits `item/agentMessage/delta`
- **AND** the event payload contains a non-empty `delta` or `text` field
- **THEN** `ccguiTiming.firstTextDeltaReceivedAtMs` MUST be set from that event
- **AND** `ccguiTiming.firstTextDeltaMethod` MUST record the method that triggered it

#### Scenario: legacy Codex delta aliases start first text timing

- **WHEN** the Codex app-server emits `text:delta`, `text/delta`, or `item/agentMessage/textDelta`
- **AND** the event payload contains a non-empty `delta` or `text` field
- **THEN** `ccguiTiming.firstTextDeltaReceivedAtMs` MUST be set from that event
- **AND** earlier reasoning, tool, and lifecycle events MUST remain counted as before-first-text events

### Requirement: Codex Terminal Completion MUST Not Masquerade As Streamed First Text

Codex backend timing diagnostics MUST keep terminal-only completion output separate from streamed assistant text ingress.

#### Scenario: final-only completion has no first text delta

- **WHEN** a Codex turn emits reasoning, tool, lifecycle, or terminal completion events
- **AND** no supported assistant text delta method with non-empty text was emitted before terminal completion
- **THEN** `ccguiTiming.firstTextDeltaReceivedAtMs` MUST remain absent or null on the terminal event
- **AND** diagnostics MUST preserve enough bounded method/count evidence to identify the turn as final-only from the backend stream perspective
