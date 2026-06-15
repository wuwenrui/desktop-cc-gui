## ADDED Requirements

### Requirement: Open file tabs MUST own reusable file sessions

Each open file tab MUST have a reusable file session identity so tab activation can restore document/editor state without treating every switch as a fresh open.

#### Scenario: activating cached tab reuses document snapshot

- **GIVEN** file A and file B are both open
- **AND** file A has a ready clean document snapshot
- **WHEN** the user switches from file B back to file A
- **THEN** the file view MUST reuse file A's valid document snapshot before issuing a full file read
- **AND** the first visible content for file A MUST NOT depend on rebuilding file B state

#### Scenario: dirty background tab keeps draft

- **GIVEN** file A has unsaved local edits
- **WHEN** the user switches to file B and then back to file A
- **THEN** file A MUST restore its unsaved draft
- **AND** the app MUST NOT replace the draft with disk content unless the user explicitly discards or reloads it

#### Scenario: tab close releases session

- **WHEN** the user closes an open file tab after confirming any dirty state
- **THEN** the associated file session MAY be released from memory
- **AND** later opening the same path MAY create a fresh session

### Requirement: Tab activation MUST NOT commit stale work

Asynchronous work scheduled by one tab MUST NOT mutate another tab after activation changes.

#### Scenario: stale preview work cannot update active tab

- **GIVEN** file A has pending Markdown, syntax, git marker, or external refresh work
- **WHEN** the user activates file B before that work completes
- **THEN** file A work MUST verify file identity and render epoch before commit
- **AND** failed verification MUST drop the result without mutating file B's visible state
