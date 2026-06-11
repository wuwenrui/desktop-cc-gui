## MODIFIED Requirements

### Requirement: Codex New Conversation Start MUST Be Idempotent While In Flight

When the frontend starts a new Codex conversation for the same workspace, folder/root, provider profile, and auto-session identity, concurrent callers MUST reuse the same in-flight backend start instead of creating multiple backend sessions. Starts for different provider profiles or materially different current launch identities MUST remain independent so provider-scoped runtimes can launch in parallel. Current code does not include selected model, launch mode, or spec-root in `start_thread`; if a future change adds those fields to the start payload, the in-flight identity MUST be extended in that same change.

#### Scenario: concurrent codex starts reuse one backend session for the same provider profile and auto-session identity

- **WHEN** two or more callers invoke new Codex conversation creation for the same workspace, folder/root, provider profile, and auto-session identity before the first backend start resolves
- **THEN** the system MUST call the backend start command only once
- **AND** all callers MUST receive the same created thread id
- **AND** the sidebar MUST materialize only one new Codex conversation

#### Scenario: different provider profiles do not share the same in-flight start

- **WHEN** two callers invoke new Codex conversation creation for the same workspace and folder
- **AND** the selected provider profiles are different
- **THEN** the system MUST keep those starts as separate in-flight operations
- **AND** each resolved thread MUST retain its own provider profile binding
- **AND** the sidebar MAY materialize both conversations

#### Scenario: different current launch identities do not share the same in-flight start

- **WHEN** two callers invoke new Codex conversation creation for the same workspace and provider profile
- **AND** the folder/root or auto-session identity differs
- **THEN** the system MUST keep those starts as separate in-flight operations
- **AND** each resolved thread MUST retain the folder and auto-session metadata used to start it

#### Scenario: future start payload dimensions extend in-flight identity

- **WHEN** a future change adds selected model, launch mode, spec-root, or another material launch dimension to the Codex `start_thread` payload
- **THEN** the frontend in-flight key MUST include that dimension in the same change
- **AND** starts that differ by that dimension MUST NOT share one backend start

#### Scenario: in-flight reuse preserves activation request

- **WHEN** a caller reuses an in-flight Codex start and requests activation
- **THEN** the resolved shared thread MUST become active for that workspace
- **AND** the system MUST NOT dispatch a second create/materialize side effect for that same thread

#### Scenario: failed in-flight start can be retried

- **WHEN** an in-flight Codex start fails
- **THEN** the in-flight guard MUST be released
- **AND** a later user action MAY attempt a new backend start for the same workspace, folder, and provider profile
