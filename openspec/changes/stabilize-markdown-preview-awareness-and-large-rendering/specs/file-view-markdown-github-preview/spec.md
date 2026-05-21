## ADDED Requirements

### Requirement: File View Markdown Preview MUST Render Large Documents By Stable Blocks

The file-view Markdown renderer MUST keep large Markdown documents structured and responsive by projecting stable source blocks instead of repeatedly rebuilding one growing Markdown document string.

#### Scenario: large markdown keeps structured rendering

- **WHEN** a Markdown document exceeds the rich-preview budget
- **THEN** the preview MUST keep rendering structured Markdown blocks such as headings, paragraphs, blockquotes, tables, fenced code, math, and Mermaid blocks
- **AND** it MUST NOT degrade to plain text solely because the document is large

#### Scenario: progressive rendering advances by block boundary

- **WHEN** the Markdown preview progressively reveals a large document
- **THEN** each reveal step MUST advance on stable Markdown block boundaries
- **AND** it MUST NOT cut through a fenced code, math, Mermaid, or table block in a way that breaks that block's renderer

#### Scenario: annotation line mapping remains source-stable

- **WHEN** a user creates or views annotations inside a block-rendered Markdown preview
- **THEN** annotation source line ranges MUST map back to original file line numbers
- **AND** block segmentation MUST NOT drift annotation placement to renderer-only line numbers

### Requirement: File View Markdown Preview MUST Avoid Unused Code Preview Work

The file-view Markdown preview MUST NOT precompute full-file code-preview highlighting when the active surface is Markdown preview.

#### Scenario: markdown preview does not compute code-preview highlighted lines

- **WHEN** the active file surface is `markdown-preview`
- **THEN** the file view MUST avoid full-file `highlightLine` work that is only needed by `code-preview`
- **AND** Markdown fenced code blocks MUST continue to render through the Markdown preview code-block renderer

### Requirement: Mermaid Preview Tabs MUST Keep Scroll Position Stable

The file-view Markdown renderer MUST keep a Mermaid block's card geometry stable when users switch between source and rendered views.

#### Scenario: source/render tab switching does not collapse the card body

- **WHEN** a user switches a Mermaid block between source and rendered views
- **THEN** the Mermaid block MUST keep a stable body container
- **AND** the body MUST NOT collapse to a transient loading height between tab states

#### Scenario: cached render does not flicker back to loading

- **WHEN** a Mermaid block has already rendered successfully
- **AND** the user switches away from and back to the rendered view
- **THEN** the block MUST reuse the last successful or cached SVG immediately
- **AND** it MUST NOT show a loading placeholder before restoring the rendered diagram

#### Scenario: Mermaid card is not used as scroll anchor during tab switch

- **WHEN** the user toggles a Mermaid block tab inside a scrolled Markdown preview
- **THEN** the Mermaid block SHOULD opt out of browser scroll anchoring
- **AND** the surrounding preview scroll position MUST remain visually stable

### Requirement: Revealed Markdown Blocks MUST Stay Visible Across Annotation Rerenders

The file-view Markdown renderer MUST keep already revealed heavy blocks visible when annotation UI state or progressive projection causes the preview to rerender.

#### Scenario: revealed table does not return to placeholder

- **WHEN** a table block has already been revealed in a large Markdown preview
- **AND** annotation draft state or parent preview props change without changing that table's source block
- **THEN** the table MUST remain visible
- **AND** it MUST NOT flash back to the deferred placeholder

#### Scenario: annotation affordance does not repaint card body

- **WHEN** a user hovers an annotatable table, code, math, or Mermaid block
- **THEN** the annotation affordance SHOULD render as a lightweight overlay
- **AND** it MUST NOT change the heavy block's content geometry or repaint the card body background
