## ADDED Requirements

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
