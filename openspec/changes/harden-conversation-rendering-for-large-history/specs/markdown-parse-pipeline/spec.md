## ADDED Requirements

### Requirement: Conversation Heavy Markdown Blocks MUST Hydrate Lazily Without Changing Canonical Text

Final and restored conversation Markdown MUST support lazy hydration for heavy blocks while preserving canonical Markdown source and final rich semantics.

#### Scenario: heavy Markdown block renders a bounded placeholder first
- **WHEN** a final or restored conversation message contains a heavy Markdown block such as a large table, long code fence, nested Markdown fence, Mermaid/math-rich block, or tool-call XML block
- **AND** the block is outside the visible hydration budget
- **THEN** the renderer MAY show a bounded placeholder or summary for that block
- **AND** the placeholder MUST NOT replace or mutate the canonical message text

#### Scenario: hydration converges to final Markdown semantics
- **WHEN** a heavy Markdown block enters the viewport, becomes an anchor target, or is explicitly expanded
- **THEN** the block MUST hydrate to the same final Markdown semantics expected from the normal rich renderer
- **AND** headings, tables, lists, code fences, math, Mermaid, file links, and tool-call cards MUST NOT require thread switching or history replay to recover

#### Scenario: stale heavy-block hydration is ignored
- **WHEN** an async Markdown precompute or heavy-block hydration result resolves after a newer content hash, renderer options hash, schema version, or request ordinal exists
- **THEN** the stale result MUST be ignored
- **AND** diagnostics MUST record a bounded stale-result event without raw Markdown, prompt text, assistant text, tool output, or file content
