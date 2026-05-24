## ADDED Requirements

### Requirement: Claude History Scanner SHALL Produce Bounded Session Facts

Claude history scanning SHALL produce bounded session facts and diagnostics for catalog projection without requiring full transcript restoration or leaking large inline payloads into session summaries.

#### Scenario: scanner returns summary without full transcript payload
- **WHEN** the backend scans Claude history for workspace session catalog membership
- **THEN** it MUST return bounded metadata such as canonical session id, timestamps, cwd, physical path, parent id, message count, and first real user message
- **AND** it MUST NOT include full transcript bodies or large inline media payloads in the catalog summary

#### Scenario: malformed transcript is source-scoped degradation
- **WHEN** one Claude transcript is malformed, oversized, or unreadable during catalog scanning
- **THEN** the scanner MUST mark the Claude source or candidate as degraded
- **AND** it MUST NOT clear unrelated valid Claude sessions for the workspace

#### Scenario: control-plane messages do not become title facts
- **WHEN** a Claude transcript contains GUI, Codex, JSON-RPC, or other control-plane payloads
- **THEN** the scanner MUST NOT use those payloads as first real user message or title evidence
- **AND** valid real conversation messages in the same transcript MUST remain eligible as title evidence

#### Scenario: scanner reports candidate diagnostics without leaking transcript body
- **WHEN** a Claude transcript cannot be attributed, parsed, or summarized for catalog membership
- **THEN** the scanner MUST return bounded diagnostic evidence such as reason code, candidate count, redacted path locator, or file metadata
- **AND** it MUST NOT return full transcript body, large inline media payloads, or control-plane payload text as diagnostic content

### Requirement: Claude Transcript Loader SHALL Remain Separate From Workspace Membership

Claude transcript loading SHALL restore readable session history for a selected session but SHALL NOT perform independent workspace membership decisions for default workspace lists.

#### Scenario: loader opens catalog-selected session
- **WHEN** the user opens a Claude session from Sidebar or Session Management
- **THEN** the loader MUST resolve and restore that selected native Claude transcript
- **AND** it MUST NOT infer additional workspace membership from the restored messages

#### Scenario: loader failure does not rewrite catalog membership
- **WHEN** Claude transcript loading fails for a selected catalog row
- **THEN** the UI MUST show a recoverable load failure for that row
- **AND** it MUST NOT silently remove the row from workspace membership unless catalog refresh later proves authoritative removal

#### Scenario: late transcript restore updates content only
- **WHEN** a delayed Claude transcript restore completes after the catalog projection has already rendered the row
- **THEN** it MAY update the readable conversation content
- **AND** it MUST NOT change owner workspace or strict scope membership outside the catalog resolver
