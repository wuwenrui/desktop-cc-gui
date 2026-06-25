## ADDED Requirements

### Requirement: File Preview Markdown Optimizations MUST NOT Regress Message Markdown Streaming

Markdown performance optimizations introduced for file preview MUST preserve live assistant Markdown streaming protections and final/history convergence semantics.

#### Scenario: live streaming does not adopt file preview fast body by default
- **WHEN** assistant Markdown is still streaming and syntax may be incomplete
- **THEN** the messages surface MUST continue to use its bounded live rendering, lightweight fallback, or existing rich finalization rules
- **AND** file-preview fast HTML body rendering MUST NOT become the default live streaming renderer.

#### Scenario: completed large message may reuse serializable precompute
- **WHEN** an assistant message is completed and exceeds large Markdown precompute thresholds
- **THEN** the messages surface MAY reuse worker-capable serializable precompute for outline/heavy metadata
- **AND** any such reuse MUST preserve the same final visible Markdown semantics as history restore.

#### Scenario: file preview diagnostics do not leak message content
- **WHEN** Markdown diagnostics are shared between file-preview and message Markdown infrastructure
- **THEN** diagnostics MUST remain bounded and content-safe
- **AND** they MUST NOT include raw assistant body text, prompt text, tool output, or file content.

### Requirement: Message Outline Extraction MUST Remain Bounded During Streaming

Messages outline extraction MUST not add high-frequency full Markdown parse work to live streaming partial deltas.

#### Scenario: live partial deltas do not force full outline parse
- **WHEN** a live assistant message receives high-frequency partial Markdown deltas
- **THEN** outline extraction MUST be throttled, cached by visible source identity, or deferred until stable enough
- **AND** it MUST NOT run an unbounded full parser pipeline for every partial delta.

#### Scenario: final outline converges after completion
- **WHEN** the assistant message reaches completed state
- **THEN** the final outline MUST converge to the completed Markdown content
- **AND** stale outline results from earlier partial deltas MUST be ignored.
