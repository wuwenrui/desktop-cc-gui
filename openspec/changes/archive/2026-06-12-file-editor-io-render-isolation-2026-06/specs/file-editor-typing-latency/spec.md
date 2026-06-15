## ADDED Requirements

### Requirement: Editor content input MUST remain session-local before publication

The file editor MUST treat CodeMirror/editor session state as the hot-path owner of typed content. React document snapshots, AppShell state, Composer active-file references, and preview snapshots MUST receive only coalesced or explicit publications.

#### Scenario: keystroke updates editor session before React document snapshot

- **WHEN** a user types in an already-open editable file
- **THEN** the visible text update MUST be applied through the active editor session first
- **AND** the update MUST NOT require the parent `FileViewPanel`, AppShell, Sidebar, Composer, or file tree to complete a render before the character is visible

#### Scenario: repeated typing coalesces document publication

- **WHEN** a user types multiple characters within the editor publish window
- **THEN** the system MUST publish at most the latest content snapshot to parent document state for that window
- **AND** intermediate content snapshots MAY be dropped as long as save and context injection can flush the latest editor content

#### Scenario: save flushes latest editor session

- **WHEN** the user invokes save while editor content publication is pending
- **THEN** the save path MUST flush the latest editor session content before writing
- **AND** it MUST NOT write a stale parent React document snapshot

#### Scenario: active code anchor derivation is bounded

- **WHEN** editor content or cursor position changes repeatedly
- **THEN** active declaration/code anchor derivation MUST NOT synchronously scan the full document on every input or line movement
- **AND** any delayed derivation MUST verify the latest file/editor epoch before publishing to Composer or AppShell state

### Requirement: Editor line changes MUST publish through a latest-only channel

Cursor, selection, and line-range changes MUST stay local first and publish global active-file reference state through a latest-only, cancellable channel.

#### Scenario: cursor movement is local first

- **WHEN** a user clicks another line or moves the cursor repeatedly
- **THEN** the editor MAY update local footer or annotation affordance immediately
- **AND** global Composer active-file line reference publication MUST be delayed, coalesced, or low-priority

#### Scenario: stale line range is dropped after tab switch

- **WHEN** a line-range publication is pending for file A
- **AND** the user activates file B before the publication fires
- **THEN** the pending file A publication MUST be cancelled or ignored
- **AND** Composer MUST NOT receive file A as the current active file line range
