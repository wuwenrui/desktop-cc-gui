## ADDED Requirements

### Requirement: Workspace Session Projection SHALL Be The Default Membership Truth

Sidebar, Workspace Home, and Session Management default workspace session membership SHALL be derived from the shared workspace session catalog projection instead of independently merging engine-specific native lists as parallel truth sources.

#### Scenario: sidebar uses catalog membership for Claude rows
- **WHEN** the sidebar renders default active workspace sessions
- **THEN** Claude rows MUST be admitted through the shared active workspace session projection
- **AND** native Claude listing MUST NOT independently widen or shrink default membership outside that projection

#### Scenario: native Claude list remains detail and diagnostic source
- **WHEN** the UI needs to load a Claude transcript or diagnose Claude native history availability
- **THEN** it MAY call native Claude history commands
- **AND** the native result MUST NOT override catalog membership unless the catalog marks the Claude source as incomplete

#### Scenario: settings and home share projection semantics
- **WHEN** Sidebar, Workspace Home, and Session Management request the same active strict workspace scope
- **THEN** their membership sets MUST be explainable from the same backend projection
- **AND** any difference MUST come from display window, pagination, or explicit UI filters rather than different scope rules

### Requirement: Workspace Session Projection SHALL Expose Claude Source Completeness

Workspace session catalog responses SHALL expose whether Claude source absence is authoritative or incomplete so consumers do not confuse degraded omissions with deletion.

#### Scenario: authoritative Claude empty can clear continuity
- **WHEN** the backend proves Claude scanning is complete for the requested strict scope and no Claude sessions match
- **THEN** the projection MUST expose an authoritative empty state for Claude
- **AND** consumers MAY remove stale Claude continuity rows for that scope

#### Scenario: uncertain Claude empty cannot erase last-good rows
- **WHEN** Claude source scanning returns no rows but cannot prove full workspace coverage
- **THEN** the projection MUST expose uncertain or degraded Claude source status
- **AND** consumers MUST NOT clear last-good Claude rows solely because the current response omitted them

#### Scenario: capped Claude scan remains partial
- **WHEN** Claude scanning stops because a scan cap, timeout, malformed transcript, oversized transcript, or source error prevents complete evaluation
- **THEN** the projection MUST expose partial or degraded Claude source status
- **AND** the UI MUST be able to explain that the visible result may be incomplete

### Requirement: Workspace Session Projection SHALL Merge Source Completeness Conservatively

Workspace session catalog projection SHALL preserve per-engine source completeness and SHALL NOT allow one engine's complete result to hide another engine's incomplete evidence.

#### Scenario: Claude incomplete remains visible beside Codex complete
- **WHEN** Codex scanning completes successfully
- **AND** Claude scanning returns partial, degraded, or uncertain empty evidence
- **THEN** the projection MUST keep Claude's incomplete source status in the response
- **AND** the projection summary MUST NOT describe the overall project result as fully complete without exposing that Claude is incomplete

#### Scenario: authoritative empty is engine and scope specific
- **WHEN** Claude scanning proves authoritative empty for the requested strict workspace scope
- **THEN** that proof MUST apply only to Claude in that requested scope
- **AND** it MUST NOT be reused as proof for related/global history or other engines

#### Scenario: incomplete reasons do not collapse into empty
- **WHEN** Claude storage is unavailable, permission denied, capped, timed out, malformed, oversized, or otherwise not fully evaluated
- **THEN** the projection MUST expose a partial, degraded, or uncertain empty source status
- **AND** it MUST NOT collapse the result into authoritative empty

### Requirement: Workspace Session Projection SHALL Preserve Owner Scope Evidence

Workspace session projection SHALL carry enough owner and scope evidence for frontend consumers to avoid reimplementing workspace membership filters.

#### Scenario: child worktree row survives project aggregate projection
- **GIVEN** a main workspace projection includes child worktree owner scopes
- **WHEN** a Claude session belongs to a child worktree within that project aggregate
- **THEN** the backend projection MUST include the row with its true owner workspace identity
- **AND** the frontend MUST NOT drop it by requiring the owner workspace id to equal the selected main workspace id

#### Scenario: worktree-only projection remains isolated
- **GIVEN** the requested scope is a single worktree
- **WHEN** the backend builds active strict projection
- **THEN** it MUST include only sessions owned by that worktree scope
- **AND** it MUST NOT include parent or sibling workspace rows merely because they share a git root

#### Scenario: unresolved Claude ownership is explainable
- **WHEN** a Claude transcript exists on disk but cannot be uniquely attributed to the requested workspace scope
- **THEN** the projection MUST expose unresolved or ambiguous ownership evidence
- **AND** the transcript MUST NOT silently disappear as if it never existed

#### Scenario: unresolved Claude ownership does not enter strict membership
- **WHEN** a Claude transcript exists on disk
- **AND** the backend cannot uniquely prove its owner workspace for the requested strict scope
- **THEN** the strict active projection MUST NOT include that transcript as a current workspace session
- **AND** the response MUST expose diagnostic evidence so the omission is explainable

#### Scenario: conflict between cwd and project directory is not guessed
- **WHEN** a Claude transcript cwd points to one known workspace
- **AND** its Claude project directory maps to a different known workspace
- **THEN** the projection MUST mark the candidate as unresolved or conflicting
- **AND** it MUST NOT choose either owner without explicit higher-confidence evidence
