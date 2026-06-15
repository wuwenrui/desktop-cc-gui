## ADDED Requirements

### Requirement: Realtime state MUST NOT pollute file editor hot paths

Realtime conversation state changes MUST NOT force file editor typing, line switching, or tab activation to depend on whole conversation status maps or reducer state.

#### Scenario: file editor receives only narrow render pressure

- **WHEN** a conversation is streaming while a file editor is open
- **THEN** the file editor MAY receive a narrow render pressure signal
- **AND** it MUST NOT receive `threadStatusById`, conversation items, or conversation reducer state as props or imports for rendering file content

#### Scenario: thread status map updates do not drive file typing path

- **WHEN** `threadStatusById` changes because a conversation progresses
- **AND** the user is typing in a file editor
- **THEN** the file typing hot path MUST NOT require recomputing file document state, CodeMirror extensions, file tree rows, or file preview snapshots because of that map update

#### Scenario: pressure signal only affects non-urgent file work

- **WHEN** active engine processing creates render pressure
- **THEN** file rendering MAY defer non-visible or non-urgent preview work
- **AND** it MUST NOT delay explicit user typing, cursor movement, save, or first useful active file viewport
