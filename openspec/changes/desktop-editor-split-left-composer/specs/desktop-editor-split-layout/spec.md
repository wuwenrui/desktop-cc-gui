## ADDED Requirements

### Requirement: Desktop Editor Split SHALL Keep Composer With Conversation Column

The system MUST render desktop editor split as a two-column work surface where the conversation column owns both messages and composer, and the file editor column owns the active file editor.

#### Scenario: workspace file open enters desktop split layout

- **WHEN** desktop layout opens a workspace file into the editor from the workspace file surfaces
- **THEN** the app MUST request the sidebar to collapse
- **AND** the editor split layout MUST become horizontal
- **AND** the editor file MUST NOT remain maximized
- **AND** the file MUST open in editor mode rather than diff mode

#### Scenario: horizontal editor split keeps composer in chat column

- **WHEN** desktop layout renders with `centerMode` set to `editor`
- **AND** editor split layout is horizontal
- **AND** the editor file is not maximized
- **THEN** the chat layer MUST contain both messages and composer
- **AND** the editor layer MUST remain a separate side-by-side file column

#### Scenario: editor column is not shortened by global composer

- **WHEN** desktop horizontal editor split is visible
- **THEN** composer MUST NOT be rendered as a global bottom row spanning under the editor column
- **AND** the file editor column MUST be able to use the available split height

#### Scenario: composer submit keeps active file visible

- **WHEN** desktop horizontal editor split is visible with an active file
- **AND** the user sends or queues a composer message
- **THEN** the app MUST preserve editor mode
- **AND** the active file editor MUST remain visible
- **AND** only explicit editor close, navigation, or mode-switch actions MAY return the center area to chat-only mode

#### Scenario: maximized editor keeps existing composer path

- **WHEN** desktop layout renders with `centerMode` set to `editor`
- **AND** the editor file is maximized
- **THEN** the hidden chat layer MUST NOT own an interactive composer
- **AND** the existing outer composer placement MAY remain available for input

#### Scenario: non-editor desktop modes keep composer placement

- **WHEN** desktop layout renders normal chat, diff, memory, or home modes
- **THEN** composer placement MUST remain compatible with the existing mode-specific layout
- **AND** this editor split contract MUST NOT move composer for those modes

#### Scenario: compact layouts are outside desktop editor split contract

- **WHEN** phone or tablet layouts render messages and composer
- **THEN** their existing layout components MUST remain the source of composer placement
- **AND** desktop editor split changes MUST NOT alter compact navigation semantics
