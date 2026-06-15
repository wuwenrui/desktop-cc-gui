## ADDED Requirements

### Requirement: File Editor Typing MUST Stay Local-First

The file editor MUST keep keystroke processing local-first so visible typing feedback is not coupled to app-wide state publication, workspace refresh, file tree recomputation, or backend IO.

#### Scenario: keystroke does not trigger app-wide recomputation

- **WHEN** a user types in an already-open editable text file
- **THEN** the editor MUST apply the document transaction locally first
- **AND** visible text echo MUST NOT require AppShell, Composer, workspace tree, or file tree recomputation to complete

#### Scenario: line range publication is delayed and coalesced

- **WHEN** cursor, selection, or line range changes repeatedly during typing
- **THEN** global active-file reference publication MUST be delayed, coalesced, or low-priority
- **AND** intermediate ranges MAY be dropped as long as the latest range is available before send or context injection

### Requirement: File Editor Typing MUST NOT Persist Per Keystroke

The file editor MUST NOT perform Tauri file reads/writes, filesystem writes, or client storage writes for transient typing state on every keystroke.

#### Scenario: typing does not write through Tauri or filesystem

- **WHEN** a user types a sequence of characters before explicit save or debounced autosave fires
- **THEN** the app MUST NOT issue one Tauri file read/write command per keystroke
- **AND** the app MUST NOT perform one filesystem write per keystroke

#### Scenario: transient editor state is not written to client storage per keystroke

- **WHEN** dirty state, cursor position, selection, or scroll state changes during typing
- **THEN** transient editor state MUST remain memory-first or be coalesced
- **AND** `clientStorage` MUST NOT receive one write per keystroke for that transient state

### Requirement: External Sync MUST NOT Interrupt Dirty Typing

External file sync and watcher feedback MUST preserve local dirty buffers and MUST NOT reload, reparse, or replace editor content while the user is actively editing unless the user explicitly resolves the change.

#### Scenario: dirty buffer survives external disk change

- **WHEN** a user has unsaved local edits in an open file
- **AND** the same file changes on disk
- **THEN** the editor MUST preserve the dirty buffer
- **AND** the system MUST expose conflict or pending-change UI instead of replacing editor content

#### Scenario: self-save watcher event does not reload the editor

- **WHEN** the app saves the active dirty buffer to disk
- **AND** a watcher event is emitted for that same saved snapshot
- **THEN** the file view MUST suppress a redundant full reload or reparse
- **AND** it MUST NOT mark the saved content as an external overwrite conflict

### Requirement: File Editor Typing Evidence MUST Be Content-Safe And Classified

Performance evidence for file editor typing MUST be bounded, content-safe, and classified before it is used for release or archive claims.

#### Scenario: evidence records latency without file content

- **WHEN** file editor typing evidence is collected
- **THEN** the payload MAY include ids, hashed path identity, file size bucket, line count bucket, event counts, timings, write counts, long-task counts, and evidence class
- **AND** the payload MUST NOT include full file content, file diff content, prompt text, assistant output, or terminal output

#### Scenario: proxy evidence is not release-grade proof

- **WHEN** file editor typing is validated only by jsdom, static checks, helper tests, or manual observation
- **THEN** the evidence MUST be classified as `proxy` or `manual-only`
- **AND** reports MUST NOT describe the typing latency improvement as release-grade measured evidence without browser, Tauri WebView, PerformanceObserver, React Profiler, or equivalent runtime signal

