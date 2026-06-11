## MODIFIED Requirements

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

#### Scenario: fast renderer consumes the same stable snapshot
- **WHEN** file preview uses the fast Markdown renderer
- **THEN** the renderer MUST compile from the stable document snapshot and content hash
- **AND** annotation state, hover state, outline panel state, Mermaid tab state, and localized labels MUST NOT change the compiled Markdown document identity

### Requirement: Markdown compile work MUST be cached independently from annotation UI state

The system MUST separate Markdown compile work from annotation state, hover state, outline state, and localized labels.

#### Scenario: annotation draft typing does not recompile markdown
- **WHEN** the user types into an AI annotation draft in Markdown preview
- **THEN** the system MUST NOT re-run full Markdown normalization, frontmatter extraction, line-map construction, block-key generation, fast HTML compilation, sanitizer work, or outline extraction for the same content hash
- **AND** only the annotation overlay or affected annotation UI MAY update

#### Scenario: same content rerender reuses compiled markdown model
- **WHEN** the Markdown preview rerenders with the same `documentKey`, same content hash, and same renderer profile
- **THEN** the compiled Markdown document model MUST be reused
- **AND** the render path MUST NOT treat the rerender as a new document parse

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

#### Scenario: fast renderer heavy metadata is stable
- **WHEN** the fast renderer emits metadata for Mermaid, math, table, or large code blocks
- **THEN** the metadata key MUST be stable for the same document identity, source line range, language, and block content
- **AND** same-content UI updates MUST NOT drop the block's cached rendered state

### Requirement: Large Markdown files MUST use deterministic bounded rendering

Large Markdown preview MUST choose degradation, progressive rendering, fast document rendering, or virtualization through deterministic document metrics.

#### Scenario: render budget uses document metrics
- **WHEN** the system chooses a Markdown preview render strategy
- **THEN** it MUST use deterministic metrics such as file size, line count, block count, heavy block count, and `truncated`
- **AND** it MUST NOT use machine-local timing as the primary strategy selector

#### Scenario: large markdown does not mount all expensive content at once
- **WHEN** a Markdown file exceeds the rich preview budget
- **THEN** the preview MUST use a bounded strategy such as low-cost fallback, progressive block rendering, fast sanitized document rendering, or block virtualization
- **AND** it MUST NOT attempt unbounded full-document rich rendering that can freeze the UI indefinitely

#### Scenario: renderer profile can select fast html without changing behavior semantics
- **WHEN** deterministic metrics select a fast HTML renderer profile
- **THEN** the preview MUST preserve file-preview Markdown semantics for supported block types
- **AND** the strategy change MUST be observable through renderer diagnostics or data attributes for tests

### Requirement: Markdown preview partial refresh MUST not amplify local UI changes

Markdown preview MUST keep non-content UI updates local to the affected block, overlay, outline, or interaction island.

#### Scenario: annotation update does not recreate unrelated blocks
- **WHEN** an annotation marker, draft composer, hover state, or same-content refresh changes
- **THEN** the preview MUST update only the affected annotation overlay or affected block presentation
- **AND** unrelated Markdown block subtrees or HTML document regions MUST keep their identity and local rendered state

#### Scenario: outline navigation does not repaint the markdown body
- **WHEN** the user navigates or filters the Markdown outline
- **THEN** the Markdown body MUST NOT be remounted for unchanged content
- **AND** any active heavy block state MUST remain visible

## ADDED Requirements

### Requirement: Markdown file preview MUST support a fast sanitized document renderer

The file Markdown preview SHALL support rendering the Markdown body through a parser-produced sanitized HTML document surface rather than a React component tree for every Markdown node.

#### Scenario: fast renderer mounts sanitized document HTML
- **WHEN** the renderer profile selects the fast Markdown renderer
- **THEN** the Markdown body MAY be mounted as sanitized HTML under the file-preview Markdown namespace
- **AND** React MUST NOT need to own every paragraph, list item, table cell, and inline node as an application component
- **AND** the mounted HTML MUST strip dangerous attributes, event handlers, and unsafe URL schemes before display

#### Scenario: fast renderer keeps interaction islands isolated
- **WHEN** the fast renderer encounters links, annotations, wide tables, code blocks, KaTeX formulas, or Mermaid blocks
- **THEN** it MUST expose stable metadata, source-line anchors, placeholders, or delegated events for those interactions
- **AND** heavy or interactive blocks MUST be hydrated locally without remounting the full Markdown document body

#### Scenario: fast renderer failure falls back inside file preview
- **WHEN** fast Markdown compilation, sanitization, or interaction island hydration fails
- **THEN** the failure MUST remain inside the file-preview renderer boundary
- **AND** the user MUST receive either the existing ReactMarkdown file-preview fallback or another readable file-preview fallback
- **AND** message Markdown renderer MUST NOT become the fallback target

### Requirement: Markdown preview outline MUST be parser-derived and source-line stable

Markdown preview outline/Toc MUST be derived from Markdown parser tokens, heading metadata, or an equivalent compile-time source map rather than from repeated mounted-DOM scans.

#### Scenario: outline entries are extracted during compile
- **WHEN** a Markdown document contains heading tokens
- **THEN** the compile result MUST include outline entries with heading depth, title, stable anchor, ordinal, and original source line range
- **AND** duplicate headings MUST receive stable disambiguated anchors

#### Scenario: outline does not force document recompilation
- **WHEN** the user opens, filters, expands, collapses, or navigates the Markdown outline
- **THEN** the system MUST NOT recompile the Markdown body for unchanged source content
- **AND** outline state updates MUST remain local to the outline/navigation surface

#### Scenario: outline jump uses source-line or heading anchors
- **WHEN** the user activates an outline item
- **THEN** the preview MUST scroll to the corresponding heading/source-line anchor when rendered
- **AND** if the target is outside a bounded/progressive projection, the preview MUST reveal the target block or clearly indicate that the target is not yet rendered before attempting the final scroll

### Requirement: Markdown compile pipeline MUST be Worker-ready

The Markdown compile pipeline SHALL be pure and serializable so expensive parse/sanitize/outline work can move off the main thread without changing visible behavior.

#### Scenario: compile request and result are serializable
- **WHEN** fast Markdown compile is implemented
- **THEN** its input SHOULD be expressible as raw markdown, document identity, renderer profile, theme/options, and feature flags
- **AND** its output SHOULD be expressible as sanitized or sanitizer-ready HTML, outline entries, source-line anchors, heavy block metadata, and diagnostics
- **AND** compile code SHOULD NOT depend on React component instances or mounted DOM

#### Scenario: stale async compile result cannot overwrite newer preview
- **WHEN** Markdown compile is performed asynchronously in a Worker or equivalent async adapter
- **AND** a newer document snapshot has superseded the compile request
- **THEN** the stale result MUST be ignored
- **AND** the preview MUST remain bound to the latest stable snapshot
