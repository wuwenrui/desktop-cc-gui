## ADDED Requirements

### Requirement: Live Rendering MUST Preserve Long Assistant Paragraph Structure

Live rendering MUST preserve paragraph and newline structure for long assistant text while allowing bounded processing-stage fallback rendering.

#### Scenario: long live text keeps paragraph breaks
- **WHEN** an active assistant message streams long CJK or Markdown text with paragraph breaks
- **THEN** the live conversation surface MUST preserve visible paragraph separation
- **AND** it MUST NOT collapse the text into a single dense paragraph solely because the message exceeded ordinary live-render size

#### Scenario: processing fallback converges to final Markdown
- **WHEN** a long assistant message used plain, lightweight, chunked, or throttled rendering while processing
- **AND** the turn completes with final assistant text
- **THEN** the rendered surface MUST converge to final Markdown semantics
- **AND** headings, paragraphs, lists, code fences, links, and emphasis MUST NOT require thread switching or history replay to recover

#### Scenario: display truncation does not contaminate canonical render source
- **WHEN** the renderer uses a shortened preview, summary, or degraded display for a long assistant message
- **THEN** that display text MUST remain separate from the canonical message text used for later deltas and final rendering
- **AND** the shortened display text MUST NOT become the source of truth for the active assistant body
