## ADDED Requirements

### Requirement: File Preview Fast Markdown Compile MUST Be Cache-Stable Across UI State

Fast Markdown compile results for file preview MUST be keyed by Markdown content identity and renderer options, not by annotation, outline, hover, scroll, theme label, or localized UI state.

#### Scenario: annotation state does not invalidate fast compile cache
- **WHEN** annotation draft, annotation marker, outline collapsed state, hover state, or localized label state changes
- **THEN** the fast Markdown compile cache key MUST remain unchanged for the same Markdown content and renderer options
- **AND** compile work MUST NOT restart solely because of that UI state change.

#### Scenario: renderer option change invalidates cache
- **WHEN** sanitizer-affecting options, renderer profile, bounded line limit, feature flags, schema version, or Markdown content hash changes
- **THEN** the fast Markdown compile cache MUST be invalidated
- **AND** a new compile result MUST be produced or a bounded fallback reason MUST be emitted.

### Requirement: File Preview Compile Diagnostics MUST Include Mount-Safe Metadata

Fast Markdown compile diagnostics MUST expose enough metadata for the file preview to bind outline, source-line anchors, annotation overlay, and heavy block islands without rescanning the full DOM.

#### Scenario: compile result includes source-line anchors
- **WHEN** fast Markdown compile succeeds
- **THEN** the result MUST include source-line anchors or equivalent block metadata with stable ids, source line ranges, and heavy block markers
- **AND** the file preview MUST be able to attach outline navigation and annotation overlay from that metadata without full document DOM scans.

#### Scenario: diagnostics stay content-safe
- **WHEN** compile diagnostics are emitted
- **THEN** they MUST include bounded fields such as duration, profile, cache state, total source lines, total headings, total heavy blocks, and fallback reason
- **AND** they MUST NOT include raw Markdown body, file content, annotation body, prompt text, or assistant text.

### Requirement: Stale File Preview Compile Results MUST Not Replace Current Preview

Asynchronous fast Markdown compile results MUST be ignored when a newer document snapshot or renderer profile supersedes the request.

#### Scenario: stale compile result is dropped
- **WHEN** a fast compile request resolves after the file preview has switched to a newer content hash, document key, renderer profile, or bounded line limit
- **THEN** the stale result MUST be ignored
- **AND** diagnostics MUST increment a bounded stale-result counter or equivalent evidence.

#### Scenario: fallback result is tied to current request
- **WHEN** fast compile fails and returns a fallback reason
- **THEN** the fallback MUST only switch the preview to rich mode if the failing request still matches the current document identity
- **AND** stale fallback results MUST NOT downgrade a newer successful preview.
