## MODIFIED Requirements

### Requirement: File View Markdown Preview SHALL Remain Stable During Large Documents And Surface Transitions

The system SHALL keep file-preview Markdown rendering readable and stable when the user switches tabs, switches modes, changes annotation state, or opens larger Markdown documents that stress the renderer.

#### Scenario: switching away from and back to markdown preview does not blank the document
- **WHEN** the user opens a Markdown file in preview mode, switches to another file or mode, and then returns
- **THEN** the Markdown preview MUST recover to a readable rendered state for the current document
- **AND** the file view MUST NOT remain blank or show stale content from a previous file

#### Scenario: large markdown documents can degrade without breaking readability
- **WHEN** the user opens a Markdown document whose full rich preview exceeds the safe rendering budget
- **THEN** the system MUST preserve a readable Markdown preview experience through bounded degradation
- **AND** it MUST NOT freeze indefinitely while attempting the richest possible rendering

#### Scenario: markdown degradation threshold is deterministic across platforms
- **WHEN** a Markdown file exceeds the first-phase rich-preview budget by file size, line count, or `truncated` state
- **THEN** the file view MUST degrade using the same deterministic threshold policy on Windows and macOS
- **AND** it MUST NOT choose different render paths solely because one machine is faster than another

#### Scenario: annotation state changes do not rebuild the entire markdown document
- **WHEN** the user creates, edits, types into, or removes an AI annotation in Markdown preview
- **THEN** the Markdown document content model MUST remain stable for unchanged source content
- **AND** the renderer MUST update only the affected annotation overlay or affected block presentation

#### Scenario: Mermaid rendered tab does not flicker during stable rerender
- **WHEN** a Mermaid block is in rendered mode
- **AND** the Markdown preview rerenders without changing that block content
- **THEN** the Mermaid block MUST remain in rendered mode
- **AND** it MUST NOT flash back to Source mode, an empty block, or a loading-only state
