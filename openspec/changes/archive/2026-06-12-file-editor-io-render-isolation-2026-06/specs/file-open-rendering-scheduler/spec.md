## ADDED Requirements

### Requirement: File activation MUST prioritize first useful viewport

File activation MUST separate tab/session activation, document snapshot readiness, first useful viewport, and heavy preview completion.

#### Scenario: first useful viewport precedes heavy preview work

- **WHEN** a user opens or activates a supported text file
- **THEN** the system MUST be able to render the file header and first useful viewport before Markdown compilation, full syntax highlighting, git marker parsing, structured preview parsing, or code intelligence completes
- **AND** delayed heavy work MUST NOT block the first useful file view

#### Scenario: file open stage timings are observable

- **WHEN** file-open evidence is collected
- **THEN** the evidence MUST distinguish read start/end, document snapshot ready, first useful viewport, and heavy preview complete timings
- **AND** the evidence MUST remain content-safe

#### Scenario: preview handle resolution is deferred

- **WHEN** an editable text file is opened
- **THEN** preview handle resolution, truncated preview loading, or structured preview parsing MUST NOT block editor mount or the first useful viewport
- **AND** those preview tasks MUST be cancellable or ignored when the file identity or render epoch changes

### Requirement: Scheduled file work MUST use snapshot and render epoch guards

Any async file render work that can complete after tab switch, snapshot replacement, or unmount MUST use file identity, snapshot version, and render epoch guards.

#### Scenario: external refresh verifies current snapshot

- **WHEN** a clean external refresh is delayed
- **AND** the active file, dirty state, snapshot version, or render epoch changes before it applies
- **THEN** the refresh MUST be cancelled or ignored
- **AND** it MUST NOT replace the current visible content

#### Scenario: git marker result verifies active file

- **WHEN** git marker parsing completes for file A
- **AND** the active render epoch no longer belongs to file A
- **THEN** the marker result MUST NOT be committed to the visible editor

#### Scenario: external sync reuses the file epoch contract

- **WHEN** external change sync finishes after a file version, dirty state, or render epoch changed
- **THEN** the sync result MUST be ignored through the same file identity/snapshot guard contract
- **AND** the implementation SHOULD NOT introduce a parallel stale-result mechanism with conflicting semantics
