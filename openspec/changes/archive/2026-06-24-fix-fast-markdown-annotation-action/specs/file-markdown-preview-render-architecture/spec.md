# file-markdown-preview-render-architecture Specification Delta

## MODIFIED Requirements

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

#### Scenario: fast renderer exposes annotation action through overlay anchors
- **WHEN** Markdown file preview uses the fast renderer
- **AND** annotation creation is available for the file preview
- **THEN** each source-line anchored block MUST expose the standard annotation action affordance
- **AND** activating that affordance MUST call the same preview annotation start contract as the rich Markdown renderer
- **AND** the action affordance MUST NOT depend on the rich renderer's `.fvp-markdown-annotatable-block` DOM wrapper

#### Scenario: fast renderer failure falls back inside file preview
- **WHEN** fast Markdown compilation, sanitization, or interaction island hydration fails
- **THEN** the failure MUST remain inside the file-preview renderer boundary
- **AND** the user MUST receive either the existing ReactMarkdown file-preview fallback or another readable file-preview fallback
- **AND** message Markdown renderer MUST NOT become the fallback target
