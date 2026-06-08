## ADDED Requirements

### Requirement: Multi-engine streaming deltas MUST be coalesced without blocking critical controls
The client SHALL coalesce high-frequency realtime output from multiple engines through a shared bounded update boundary while preserving immediate user-critical controls.

#### Scenario: concurrent engines stream realtime deltas
- **WHEN** Claude, Codex, Gemini, OpenCode, or custom provider turns stream deltas concurrently
- **THEN** the client MUST batch or coalesce non-critical render updates at a bounded cadence
- **AND** active assistant output MUST remain visibly live
- **AND** final turn settlement MUST flush the latest buffered content

#### Scenario: user-critical controls remain immediate
- **WHEN** realtime output is being coalesced
- **THEN** Composer draft text, IME composition, selection, attachments, Stop, message toolbar, copy, fork, rewind and scroll controls MUST remain on immediate action paths
- **AND** those controls MUST NOT wait for full timeline, status, catalog, diagnostics or sidebar projection recomputation
