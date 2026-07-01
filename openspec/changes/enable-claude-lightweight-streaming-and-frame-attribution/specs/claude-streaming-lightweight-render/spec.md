## ADDED Requirements

### Requirement: Claude Streaming Markdown MUST Use Lightweight Rendering By Complexity, Not Engine Identity

Streaming assistant markdown for the Claude engine MUST be able to use the lightweight streaming surface (and staged throttle) based on content complexity — the same path already validated for the codex engine — instead of being forced onto the full react-markdown pipeline on every throttle window.

#### Scenario: Claude streaming medium or structured content uses the lightweight surface
- **WHEN** an assistant message on the Claude engine is streaming
- **AND** its streaming markdown complexity is medium or structured-heavy
- **THEN** the message MUST render via the lightweight streaming surface with progressive reveal
- **AND** it MUST NOT run the full markdown normalization plus react-markdown parse pipeline on every throttle window

#### Scenario: finalized Claude message restores full fidelity
- **WHEN** a Claude assistant message stops streaming and is finalized
- **THEN** it MUST render via the full markdown pipeline
- **AND** final rich semantics such as tables, code fences, math, file links, and tool cards MUST match the non-lightweight renderer

#### Scenario: other engines keep prior behavior
- **WHEN** an assistant message on an engine other than codex or claude is streaming
- **AND** its presentation profile does not explicitly enable staged streaming markdown
- **THEN** its streaming render mode MUST remain unchanged from prior behavior

#### Scenario: streaming virtualization and auto-follow are not affected
- **WHEN** Claude streaming lightweight rendering is active
- **THEN** the timeline streaming-virtualization gate MUST remain disabled as before
- **AND** bottom-follow auto-scroll behavior MUST NOT regress
