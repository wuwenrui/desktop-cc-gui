# file-markdown-preview-render-architecture Specification

## Purpose
TBD - created by archiving change stabilize-file-markdown-preview-render-architecture. Update Purpose after archive.
## Requirements
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

### Requirement: Markdown block rendering correctness MUST be type-specific and regression-tested

Markdown preview performance optimizations MUST preserve rendered output semantics for supported Markdown block types.

#### Scenario: table rendering remains correct under optimization
- **WHEN** a Markdown table contains headers, body rows, alignment, wide columns, or inline Markdown inside cells
- **THEN** the preview MUST render it as a table with the expected GitHub-style structure and overflow behavior
- **AND** performance optimizations MUST NOT degrade it into incorrect paragraph or plain-text output

#### Scenario: list rendering remains correct under optimization
- **WHEN** Markdown contains ordered lists, unordered lists, nested lists, task lists, or list items containing paragraphs, code, or formulas
- **THEN** the preview MUST preserve list hierarchy, numbering semantics, check states, and nested content placement
- **AND** annotation placement or progressive rendering MUST NOT duplicate or flatten nested list items

#### Scenario: math and diagram rendering remain correct under optimization
- **WHEN** Markdown contains inline math, block math, Mermaid diagrams, or flowchart fenced blocks
- **THEN** the preview MUST render supported content through the dedicated math/diagram lifecycle
- **AND** invalid math or diagram source MUST fail locally to a readable fallback without corrupting surrounding Markdown blocks

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

### Requirement: Markdown preview interaction state MUST survive non-content refreshes

Markdown preview MUST preserve user interaction state inside stable rendered blocks when source content is unchanged.

#### Scenario: wide table horizontal scroll survives same-content rerender
- **WHEN** the user horizontally scrolls a wide Markdown table in preview
- **AND** annotation state, parent view state, or same-content refresh causes the preview to rerender
- **THEN** the table wrapper MUST restore the previous horizontal scroll position
- **AND** it MUST NOT reset `scrollLeft` to the left edge unless the table block content or document identity changed

#### Scenario: annotation draft input survives markdown preview rerender
- **WHEN** the user is typing in an AI annotation draft inside Markdown preview
- **AND** the preview rerenders without changing the underlying Markdown content for that draft target
- **THEN** the draft MUST preserve its current text, focus, selection, and IME composition state
- **AND** the rerender MUST NOT force the user to retype or recover lost input

#### Scenario: heavy block local view state survives unrelated overlay updates
- **WHEN** a Mermaid, flowchart, KaTeX, large table, or large code block has local rendered/expanded/visible state
- **AND** an unrelated annotation overlay or parent preview state changes
- **THEN** that heavy block MUST preserve its local interaction state
- **AND** unrelated overlay updates MUST NOT recreate the heavy block subtree in a way that drops visible rendered output

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

### Requirement: Large Markdown Preview MUST Prefer Low-Cost Renderer Profiles By Default

The file Markdown preview MUST select a low-cost renderer profile for large documents through deterministic document metrics, without requiring users to manually enable localStorage or environment feature flags for the common large-document path.

#### Scenario: large document selects fast profile by default
- **WHEN** a Markdown file exceeds the configured large-document threshold by byte length, line count, block count, or heavy block count
- **THEN** the file preview MUST select a fast or bounded-fast renderer profile by default
- **AND** the selected profile MUST be visible through diagnostics or data attributes
- **AND** the user MUST still receive readable Markdown content if the fast path later falls back.

#### Scenario: small document can remain rich
- **WHEN** a Markdown file is below all large-document thresholds
- **THEN** the file preview MAY continue to use the rich ReactMarkdown profile
- **AND** this profile choice MUST be deterministic for the same content and feature configuration.

### Requirement: Annotation State MUST NOT Force Whole-Document Rich Fallback

AI annotation draft and marker state MUST be rendered through a bounded overlay or delegated interaction layer instead of forcing the entire Markdown document to fall back from fast HTML rendering to rich ReactMarkdown rendering.

#### Scenario: annotation marker keeps fast body stable
- **WHEN** a fast-rendered Markdown preview has one or more existing AI annotation markers
- **THEN** the Markdown body MUST remain on the fast renderer profile when the body content is unchanged
- **AND** annotation markers MUST render through an overlay, delegated layer, or equivalent bounded mechanism
- **AND** the fast compile cache key MUST NOT include annotation marker state.

#### Scenario: annotation draft typing does not remount markdown body
- **WHEN** the user types into an AI annotation draft in Markdown preview
- **THEN** the Markdown body MUST NOT recompile or remount for each draft body change
- **AND** focus, selection, and IME composition in the draft editor MUST remain stable.

#### Scenario: unplaceable annotation degrades locally
- **WHEN** an annotation target cannot be mapped to a rendered source-line block in the fast preview
- **THEN** the system MUST degrade only the affected annotation interaction or clearly omit that annotation affordance
- **AND** it MUST NOT fallback the whole document solely for that unplaceable annotation.

### Requirement: Rich Markdown Preview MUST Reuse Expensive Placement Work

The rich ReactMarkdown fallback MUST cache or precompute expensive annotation placement and outline binding work for unchanged Markdown content.

#### Scenario: same-content annotation update reuses nested range placement
- **WHEN** annotation marker or draft state changes while the Markdown content hash is unchanged
- **THEN** nested node line ranges and block placement metadata MUST be reused or obtained through a bounded lookup
- **AND** the system MUST NOT recursively traverse every rendered Markdown node for every visible block solely because annotation state changed.

#### Scenario: rich outline does not repeat full compile and DOM heading scan
- **WHEN** rich preview rerenders with unchanged Markdown content
- **THEN** outline extraction and heading id binding MUST reuse parser-derived metadata, cached compile output, or equivalent stable source-line anchors
- **AND** the system MUST NOT perform an extra full Markdown compile plus full heading DOM scan on every same-content rerender.

### Requirement: Markdown Render Diagnostics MUST Expose Performance-Critical Decisions

Markdown file preview MUST expose bounded diagnostics for renderer profile selection, fallback, compile cost, mounted body size, and annotation overlay cost.

#### Scenario: diagnostics identify renderer and fallback
- **WHEN** a Markdown file preview renders
- **THEN** diagnostics MUST include selected renderer profile, fallback reason, content hash, visible line or block count, and whether the fast cache was hit
- **AND** diagnostics MUST NOT include raw Markdown content.

#### Scenario: annotation diagnostics are bounded
- **WHEN** annotation overlay state is present
- **THEN** diagnostics MUST include annotation overlay count or equivalent bounded metadata
- **AND** diagnostics MUST NOT include annotation body text or file content.

