## ADDED Requirements

### Requirement: Markdown file preview MUST be driven by a stable document snapshot

Markdown file preview MUST consume a stable document snapshot rather than every transient file-sync or UI-state update.

#### Scenario: default reading mode ignores pending external disk changes
- **WHEN** a Markdown file is open in default preview/read mode
- **AND** external change monitoring detects a disk snapshot for the same file
- **THEN** the preview DOM MUST remain bound to the current stable snapshot
- **AND** the system MUST surface a refresh/changed-file affordance instead of replacing the preview content immediately

#### Scenario: live edit preview may advance the snapshot explicitly
- **WHEN** live edit preview is explicitly enabled
- **AND** a file content update is detected for the active Markdown file
- **THEN** the preview MAY advance to the new snapshot
- **AND** it MUST use debounce or hash-equivalent guarding to avoid rebuilding the preview for unchanged content

### Requirement: Markdown compile work MUST be cached independently from annotation UI state

The system MUST separate Markdown compile work from annotation state, hover state, and localized labels.

#### Scenario: annotation draft typing does not recompile markdown
- **WHEN** the user types into an AI annotation draft in Markdown preview
- **THEN** the system MUST NOT re-run full Markdown normalization, frontmatter extraction, line-map construction, or block-key generation for the same content hash
- **AND** only the annotation overlay or affected annotation UI MAY update

#### Scenario: same content rerender reuses compiled markdown model
- **WHEN** the Markdown preview rerenders with the same `documentKey`, same content hash, and same renderer profile
- **THEN** the compiled Markdown document model MUST be reused
- **AND** the render path MUST NOT treat the rerender as a new document parse

### Requirement: AI annotation placement MUST use indexed block placement

AI annotation placement in Markdown preview MUST be resolved through precomputed block/line placement or an equivalent indexed strategy.

#### Scenario: block render does not scan all annotations
- **WHEN** a Markdown block renders
- **THEN** it MUST obtain its draft/marker placement from a precomputed placement index or equivalent bounded lookup
- **AND** it MUST NOT scan the entire annotation list or recursively traverse rendered React children for every block

#### Scenario: nested annotations remain single-placement
- **WHEN** an annotation targets a nested Markdown list item, table cell, code block, or other nested block
- **THEN** the marker or draft MUST render at the most specific valid block
- **AND** it MUST NOT duplicate at parent preview blocks

### Requirement: Heavy Markdown blocks MUST render through isolated cached lifecycles

Mermaid diagrams, KaTeX formulas, large tables, and large code blocks MUST not force the whole Markdown document to remount or flicker.

#### Scenario: Mermaid rendered view survives same-content rerender
- **WHEN** a Mermaid block has successfully rendered as SVG
- **AND** the Markdown preview rerenders with the same block content and theme
- **THEN** the system MUST reuse the rendered SVG or equivalent cached result
- **AND** it MUST NOT switch the block back to Source or a loading placeholder

#### Scenario: Mermaid theme refresh keeps previous svg visible
- **WHEN** a theme change requires Mermaid SVG refresh
- **THEN** the previous successful SVG MUST remain visible until the replacement render succeeds or fails
- **AND** failure MUST stay local to the Mermaid block

#### Scenario: offscreen heavy blocks do not eagerly render
- **WHEN** a heavy Markdown block is outside the active viewport or render budget
- **THEN** the system SHOULD defer expensive rendering for that block
- **AND** the rest of the preview MUST remain readable and interactive

### Requirement: Large Markdown files MUST use deterministic bounded rendering

Large Markdown preview MUST choose degradation, progressive rendering, or virtualization through deterministic document metrics.

#### Scenario: render budget uses document metrics
- **WHEN** the system chooses a Markdown preview render strategy
- **THEN** it MUST use deterministic metrics such as file size, line count, block count, heavy block count, and `truncated`
- **AND** it MUST NOT use machine-local timing as the primary strategy selector

#### Scenario: large markdown does not mount all expensive content at once
- **WHEN** a Markdown file exceeds the rich preview budget
- **THEN** the preview MUST use a bounded strategy such as low-cost fallback, progressive block rendering, or block virtualization
- **AND** it MUST NOT attempt unbounded full-document rich rendering that can freeze the UI indefinitely
