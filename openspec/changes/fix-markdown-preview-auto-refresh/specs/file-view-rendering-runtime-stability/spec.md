## ADDED Requirements

### Requirement: Main File Preview MUST Remain A Stable Reading Snapshot By Default

The main window file preview MUST NOT start external file-content polling solely because a workspace file is open. Background content refresh for the main file view MUST require an explicit user-visible mode that enables live external-change awareness.

#### Scenario: main markdown preview does not poll by default

- **WHEN** a user opens a Markdown file in the main window file module
- **AND** live edit preview is disabled
- **THEN** the main file preview MUST NOT enable external-change monitoring for that opened file
- **AND** the preview MUST remain a stable reading snapshot until the user performs an explicit refresh, save, file switch, or opt-in action

#### Scenario: explicit live preview can enable monitoring

- **WHEN** a user opens a file in the main window file module
- **AND** live edit preview is enabled
- **THEN** the main file view MAY enable external-change monitoring for the active file
- **AND** any resulting content refresh MUST continue to use the existing dirty-buffer conflict protection

### Requirement: Markdown Preview Interactive Blocks MUST Preserve User View Selection

Markdown preview interactive blocks MUST preserve user-selected view state across parent re-renders, Markdown AST subtree rebuilds, and same-document preview remounts. A Mermaid block that the user switched to rendered view MUST NOT silently revert to source view unless the user changes files, changes the block identity, or explicitly selects source.

#### Scenario: mermaid rendered view survives same-document remount

- **WHEN** a user opens a Markdown document in the main file module
- **AND** the user switches a Mermaid block from source view to rendered view
- **AND** the same Markdown document preview subtree is remounted or rebuilt
- **THEN** the Mermaid block MUST restore rendered view for the same document and block identity
- **AND** it MUST NOT return to source view solely because the preview surface re-rendered
