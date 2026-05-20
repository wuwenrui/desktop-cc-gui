## MODIFIED Requirements

### Requirement: File View Markdown Preview SHALL Provide A GitHub-Style Reading Baseline

The system SHALL present file Markdown preview with a stable GitHub-style reading baseline for common Markdown elements.

#### Scenario: common block elements follow github-style baseline

- **WHEN** a Markdown file contains headings, paragraphs, blockquotes, horizontal rules, tables, links, and fenced code blocks
- **THEN** the preview SHALL render those elements with a GitHub-style reading baseline
- **AND** the resulting structure SHALL remain readable without requiring message-curtain-specific wrappers

#### Scenario: code blocks remain readable inside file preview

- **WHEN** a Markdown file contains fenced code blocks with or without language hints
- **THEN** the preview SHALL render code blocks with stable spacing, overflow handling, and readable highlighting
- **AND** file preview code blocks MUST NOT inherit message-curtain-only controls or wrappers unless separately specified for file view

#### Scenario: latex formulas render inside markdown file preview

- **WHEN** a Markdown file contains inline `$...$` math or display `$$...$$` math
- **THEN** the preview SHALL render those formulas through KaTeX inside the file-preview renderer
- **AND** raw formula delimiters MUST NOT remain as the primary reading surface for valid formulas

#### Scenario: fenced math blocks render as display formulas

- **WHEN** a Markdown file contains fenced `math`, `latex`, or `tex` blocks
- **THEN** the preview SHALL render valid block contents as KaTeX display formulas
- **AND** those blocks MUST NOT show a source-code card as the primary reading surface for valid formulas

#### Scenario: mermaid diagrams remain lazy renderable beside math support

- **WHEN** a Markdown file contains a fenced `mermaid` block and LaTeX formulas in the same document
- **THEN** the Mermaid block SHALL keep its file-preview Source / Render tab behavior
- **AND** math plugin support MUST NOT force Mermaid rendering during initial source-tab display

### Requirement: File View Markdown Styling SHALL Be Isolated From Message Curtain Styling

The system SHALL scope file-preview Markdown styles and render customizations to the file-view namespace so that message-curtain Markdown remains unaffected.

#### Scenario: file-preview style changes do not alter message markdown

- **WHEN** file-preview Markdown styles are updated to satisfy GitHub-style requirements
- **THEN** message-curtain Markdown rendering SHALL remain visually and structurally unchanged
- **AND** file-preview styles MUST NOT require direct mutation of message-curtain style selectors to take effect

#### Scenario: message renderer remains the active path for message surfaces

- **WHEN** Markdown is rendered inside chat messages, Spec Hub, release notes, or other existing message-based consumers
- **THEN** those surfaces SHALL continue using the existing message Markdown renderer contract
- **AND** they MUST NOT be implicitly migrated to the file-preview renderer by this change

#### Scenario: file-preview katex styles stay file-view scoped

- **WHEN** KaTeX styles are added for Markdown file preview
- **THEN** the selectors SHALL be scoped under the file-view Markdown namespace
- **AND** the change MUST NOT depend on `.message .markdown` selectors for file-preview formula readability

#### Scenario: file-preview math assets load independently from message surfaces

- **WHEN** a user opens a Markdown file preview containing LaTeX formulas before any chat message formula has rendered
- **THEN** the file-preview renderer SHALL load the KaTeX assets needed for formula readability
- **AND** formula readability MUST NOT depend on visiting the message-curtain renderer first

#### Scenario: file-preview annotation lines remain source-stable after math normalization

- **WHEN** file-preview math normalization expands a single source line into multiple render lines for display math
- **THEN** preview annotation actions SHALL map the rendered block back to the original source file line range
- **AND** the submitted annotation MUST NOT drift to transformed renderer-only line numbers

#### Scenario: file-preview mermaid card labels are localized

- **WHEN** the file-preview Mermaid source/render card is displayed
- **THEN** its tab labels, tablist label, render progress, and error text SHALL use i18n keys
- **AND** the component MUST NOT hard-code user-visible English strings
