## ADDED Requirements

### Requirement: Session Activity Shows Turn Artifacts And Semantic Diff

The session activity surface SHALL show which conversation turn produced which changed files and SHALL provide a turn-scoped semantic diff explaining likely change intent, behavior impact, risk, and validation evidence.

#### Scenario: User reviews AI-produced files by conversation turn

- **WHEN** a session activity turn contains one or more file-change events
- **THEN** the turn SHALL render a single artifact module for those changes
- **AND** the artifact module SHALL show a deduped file list rather than a separate `File change` timeline card per event.

#### Scenario: Activity category labels changed files as artifacts

- **WHEN** the session activity category tabs include file-change events
- **THEN** the user-facing tab label SHALL be "Artifacts" / "产物"
- **AND** it SHALL NOT be labeled "File" / "文件".

#### Scenario: Turn artifact module has file and semantic tabs

- **WHEN** the artifact module is visible in an expanded turn
- **THEN** it SHALL provide tabs for the artifact file list and semantic diff
- **AND** the semantic diff tab SHALL remain scoped to that same conversation turn.

#### Scenario: Semantic diff includes turn meaning

- **WHEN** the semantic diff tab is visible and the turn has a user message
- **THEN** the tab SHALL show a compact "Turn meaning" / "本轮语义" section before diff-derived facts
- **AND** the turn meaning SHALL render as escaped text rather than trusted HTML.

#### Scenario: Semantic diff uses compact layout

- **WHEN** semantic diff sections are visible in the session activity panel
- **THEN** the sections SHALL use a single-column layout
- **AND** the artifact header SHALL avoid stacking kicker, title, stats, and tabs across multiple rows when horizontal space allows.

#### Scenario: Turn artifact module uses flat visual treatment

- **WHEN** the artifact module is visible in an expanded turn
- **THEN** the module SHALL avoid outer card borders, inset shadows, raised shadows, and framed tab rails
- **AND** the artifact and semantic content SHALL read as a flat continuation of the turn rather than a nested card.

#### Scenario: Turn artifact content is left-compact

- **WHEN** the artifact file list is visible in an expanded turn
- **THEN** the module SHALL keep left indentation compact relative to nested cards
- **AND** file rows SHALL avoid excessive inner left padding that visually detaches file names from the turn content.

#### Scenario: Turn artifact tabs remain scannable without chrome

- **WHEN** the artifact module tab controls are visible
- **THEN** each tab SHALL include a leading icon plus label
- **AND** the icons SHALL NOT require bordered or raised button chrome to communicate the two modes.

#### Scenario: Concrete code facts are available

- **WHEN** a turn's diff hunk includes concrete code tokens such as exception handlers, endpoint mappings, HTTP status mapping, response envelope calls, exports, or public declarations
- **THEN** the semantic summary SHALL describe those concrete facts
- **AND** it SHALL NOT replace them with generic file-count or file-type statements.

#### Scenario: Evidence boundary is explicit

- **WHEN** the summary is derived only from diff evidence
- **THEN** the UI SHALL avoid presenting inferred statements as verified business facts
- **AND** validation status SHALL state when external validation evidence is not connected.

#### Scenario: Traditional diff remains available

- **WHEN** the user needs line-level evidence for a turn artifact file
- **THEN** the file row SHALL still allow opening the traditional diff preview or file location
- **AND** the standalone Git diff viewer SHALL remain focused on line-level diff review instead of adding a separate global semantic panel.

#### Scenario: Risk hints remain review aids

- **WHEN** the diff touches configuration, tests/specs, deleted files, large file sets, or behavior-facing source files
- **THEN** the semantic summary MAY surface risk hints
- **AND** those hints SHALL NOT block Git actions or mutate commit selection.
