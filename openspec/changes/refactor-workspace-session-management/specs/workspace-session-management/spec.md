## ADDED Requirements

### Requirement: Session Management SHALL Reconcile Disk Truth And Metadata Projection

Session Management MUST treat engine disk/session storage as the source of truth for session existence and workspace metadata as a projection for archive and folder organization.

#### Scenario: metadata orphan is explainable
- **GIVEN** workspace session metadata contains archive or folder state for a session id
- **AND** the corresponding engine session no longer exists on disk
- **WHEN** the user views a management surface that can expose inconsistent entries
- **THEN** the system MUST mark the row with `missing-on-disk` or an equivalent inconsistency code
- **AND** the system MUST NOT present metadata alone as proof that the session still exists

#### Scenario: active strict list excludes orphaned metadata by default
- **GIVEN** metadata references a session missing from disk
- **WHEN** the user views the default `strict + active` project session list
- **THEN** the system MUST NOT render that orphan as a normal active session
- **AND** the system SHOULD offer a cleanup path in management contexts

### Requirement: Session Delete SHALL Be Physical And Idempotent

Deleting a managed session MUST remove the physical engine session when it exists and MUST clean associated workspace metadata for success-like outcomes.

#### Scenario: physical delete removes disk session and metadata
- **WHEN** the user deletes a session that exists on disk
- **THEN** the backend MUST attempt the engine-specific physical delete
- **AND** on success MUST remove archive and folder assignment metadata for that session
- **AND** the response MUST identify the result as physically deleted

#### Scenario: already missing disk session cleans metadata
- **GIVEN** the user deletes a session whose metadata exists but whose disk session is already missing
- **WHEN** the backend resolves the target as not found
- **THEN** the delete MUST settle as idempotent cleanup success
- **AND** the response MUST expose a code such as `ALREADY_MISSING_CLEANED`
- **AND** the frontend MUST remove the row instead of keeping it as a retry failure

#### Scenario: invalid session id remains a hard failure
- **WHEN** the user or caller submits an invalid path-like session id
- **THEN** the backend MUST reject the request
- **AND** MUST NOT cleanup metadata for the invalid id

### Requirement: Session Management SHALL Display Parent Child Sessions Without Silent Cascade

Session Management MUST expose parent-child session relationships when known, but deletion MUST remain explicit per selected session unless the backend returns an explicit cascade contract.

#### Scenario: child session renders under parent when both are visible
- **GIVEN** a catalog page contains a parent session and a child session with `parentSessionId`
- **WHEN** the frontend renders the session list
- **THEN** the child SHOULD be visually grouped under the parent
- **AND** both rows MUST keep independent selection identity

#### Scenario: deleting child does not delete parent
- **WHEN** the user selects and deletes only a child session
- **THEN** the backend MUST NOT delete the parent session
- **AND** parent metadata MUST remain intact

#### Scenario: deleting parent does not silently delete child
- **WHEN** the user selects and deletes only a parent session
- **THEN** the backend MUST NOT silently delete visible child sessions
- **AND** any unsupported cascade MUST be reported explicitly rather than hidden

### Requirement: Session Management SHALL Provide Project Hierarchy Navigation

The Settings session management surface MUST provide a left-side project hierarchy so users can organize sessions by project/worktree and folder.

#### Scenario: project tree changes catalog scope
- **WHEN** the user selects a project or worktree row in the left hierarchy
- **THEN** the right session list MUST reload using that workspace scope
- **AND** selection state from the previous scope MUST be cleared

#### Scenario: folder selection is organization-only
- **WHEN** the user selects a session folder in the hierarchy
- **THEN** the UI MAY filter or focus rows assigned to that folder
- **AND** the backend strict project membership MUST NOT be widened by the folder selection

#### Scenario: hierarchy exposes degraded counts
- **WHEN** catalog or projection summary is partial/degraded
- **THEN** the project hierarchy SHOULD show a degraded indicator for the affected scope
- **AND** the right panel MUST explain that counts may be incomplete

### Requirement: Session Management Query SHALL Be Bounded And Explainable

Session catalog query MUST avoid unbounded first-page work where possible and MUST expose partial/degraded status when completeness cannot be proven.

#### Scenario: first page uses bounded source work
- **WHEN** the user opens a project session catalog first page without keyword filtering
- **THEN** the backend SHOULD use bounded engine source reads or capped scans
- **AND** MUST return a cursor or partial marker when more data may exist

#### Scenario: exhaustive query remains explicit
- **WHEN** keyword or status filters require exhaustive source scanning
- **THEN** the system MAY perform exhaustive work
- **AND** MUST keep loading/error/degraded states visible to the user

### Requirement: Session Management SHALL Provide Read-only Session Curtain

The Settings session management list MUST expose a lightweight read-only session curtain for inspecting session history without entering a send/continue-chat flow.

#### Scenario: row actions remain icon-first
- **WHEN** a session row is rendered in the dense list
- **THEN** the detail and curtain actions MUST be icon-only controls with accessible labels
- **AND** their visible glyphs MUST be large enough to read in the dense row layout
- **AND** the controls MUST NOT rely on gray button chrome as the primary visible affordance

#### Scenario: curtain opens as independent viewer
- **WHEN** the user activates the session curtain icon
- **THEN** the UI MUST open a modal curtain over the settings surface
- **AND** MUST render available session messages, role labels, reload, and close controls
- **AND** MUST NOT render a composer or send button in this version

#### Scenario: Codex history uses progressive sources
- **GIVEN** the selected session is a Codex session
- **WHEN** the curtain loads history
- **THEN** the frontend MUST start local Codex history loading and resume-thread history loading without waiting for one to fail first
- **AND** the first source that returns visible messages MUST populate the curtain
- **AND** a later source MAY merge additional visible messages without duplicating existing items

#### Scenario: Codex curtain load cannot hang indefinitely
- **GIVEN** Codex local or resume history is slow
- **WHEN** no visible messages are available after the configured hard timeout
- **THEN** the curtain MUST leave the loading state and show a retry/refresh notice
- **AND** late-arriving history MAY still update the same open curtain if it belongs to the latest load request
