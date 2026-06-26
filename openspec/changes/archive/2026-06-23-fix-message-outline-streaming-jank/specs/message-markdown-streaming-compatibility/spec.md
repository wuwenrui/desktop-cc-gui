## MODIFIED Requirements

### Requirement: Message Outline Extraction MUST Remain Bounded During Streaming

Messages outline extraction MUST not add high-frequency full Markdown parse work to live streaming partial deltas.

#### Scenario: live partial deltas do not force full outline parse

- **WHEN** a live assistant message receives high-frequency partial Markdown deltas
- **THEN** outline extraction MUST be throttled, cached by visible source identity, or deferred until stable enough
- **AND** it MUST NOT run an unbounded full parser pipeline for every partial delta.

#### Scenario: unchanged visible source reuses outline extraction

- **WHEN** `Markdown` re-renders with the same throttled visible source text
- **THEN** the outline extraction result SHOULD be reused from the latest source cache.
- **AND** parent callback identity changes MUST NOT cause another full source scan for that same visible source.

#### Scenario: final outline converges after completion

- **WHEN** the assistant message reaches completed state
- **THEN** the final outline MUST converge to the completed Markdown content
- **AND** stale outline results from earlier partial deltas MUST be ignored.
