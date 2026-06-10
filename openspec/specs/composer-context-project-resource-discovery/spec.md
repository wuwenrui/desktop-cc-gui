# composer-context-project-resource-discovery Specification

## Purpose

Defines the composer-context-project-resource-discovery behavior contract, covering Project-Scoped Skill Discovery.
## Requirements
### Requirement: Project-Scoped Skill Discovery

The system SHALL discover project-scoped skills from the active workspace in addition to existing managed/global
sources.

#### Scenario: Discover skills from workspace .claude directory

- **WHEN** active workspace contains `<workspace>/.claude/skills`
- **THEN** `skills_list` result SHALL include skills discovered from this directory
- **AND** each discovered item SHALL carry `source = project_claude`

#### Scenario: Discover skills from workspace .codex directory

- **WHEN** active workspace contains `<workspace>/.codex/skills`
- **THEN** `skills_list` result SHALL include skills discovered from this directory
- **AND** each discovered item SHALL carry `source = project_codex`

#### Scenario: Missing project skills directories does not fail discovery

- **WHEN** `<workspace>/.claude/skills` and/or `<workspace>/.codex/skills` do not exist
- **THEN** discovery SHALL continue using other sources
- **AND** API call SHALL still return success with available items

#### Scenario: Skill deduplication uses deterministic source priority

- **WHEN** multiple sources provide the same normalized skill name
- **THEN** system SHALL keep exactly one entry
- **AND** system SHALL keep the highest-priority source by rule:
  `workspace_managed > project_claude > project_codex > global_claude > global_claude_plugin > global_codex`

#### Scenario: Claude plugin cache skills are discovered after user global skills

- **WHEN** `~/.claude/plugins/cache/<owner>/<plugin>/skills/<skill>/SKILL.md` exists
- **THEN** `skills_list` result SHALL include that skill with `source = global_claude_plugin`
- **AND** user-authored `~/.claude/skills` entries SHALL keep priority over plugin cache entries with the same normalized skill name

#### Scenario: symlinked skill directories are followed safely

- **WHEN** a supported skill root contains a symbolic link that resolves to a directory with `SKILL.md`
- **THEN** discovery SHALL include the resolved skill
- **AND** discovery SHALL keep deterministic deduplication by normalized skill name and source priority
- **AND** missing or broken symlink targets SHALL be skipped without failing the whole scan

#### Scenario: review boundary fixes keep discovery non-blocking

- **WHEN** a discovery source is unreadable, stale, or points to a missing directory
- **THEN** resource discovery SHALL skip that source
- **AND** the returned list SHALL still include skills from remaining healthy sources

### Requirement: Project-Scoped Command Discovery

The system SHALL discover project-scoped commands from the active workspace in addition to existing global sources.

#### Scenario: Discover commands from workspace .claude commands directory

- **WHEN** active workspace contains `<workspace>/.claude/commands` or `<workspace>/.claude/Commands`
- **THEN** commands list result SHALL include commands discovered from that directory
- **AND** each discovered item SHALL carry `source = project_claude`

#### Scenario: Discover commands from workspace .codex commands directory

- **WHEN** active workspace contains `<workspace>/.codex/commands` or `<workspace>/.codex/Commands`
- **THEN** commands list result SHALL include commands discovered from that directory
- **AND** each discovered item SHALL carry `source = project_codex`

#### Scenario: Command deduplication prefers project over global

- **WHEN** project and global sources both provide the same normalized command name
- **THEN** system SHALL keep exactly one command entry
- **AND** system SHALL prioritize sources by rule: `project_claude > project_codex > global_claude`

#### Scenario: Unreadable project command directory is non-blocking

- **WHEN** a project command directory exists but is not readable
- **THEN** system SHALL skip that source and continue discovery from remaining sources
- **AND** API call SHALL still return success with available items

### Requirement: Source Metadata Availability

The system SHALL return source metadata for each discovered skill/command so UI can render source-aware grouping.

#### Scenario: Source field is included for skill results

- **WHEN** frontend requests skills list
- **THEN** each returned skill item SHALL include a non-empty `source` field

#### Scenario: Source field is included for command results

- **WHEN** frontend requests commands list
- **THEN** each returned command item SHALL include a non-empty `source` field

### Requirement: Project Map context packs are a first-class resource source
Composer resource discovery SHALL consume `project-map-relations/context-packs/latest.json` when available.

#### Scenario: fresh context pack exists
- **WHEN** discovery is triggered for active workspace
- **THEN** composer MAY prioritize must-read files, related files, tests, contracts, and risk flags from context pack

#### Scenario: stale context pack
- **WHEN** context pack is stale
- **THEN** discovery SHALL tag suggestions as stale or request Project Map refresh

### Requirement: no duplicate broad scan if deterministic context is available
Composer SHALL avoid launching another broad file scan for resource ranking when Project Map context is sufficient.

#### Scenario: relationship context covers requested files
- **WHEN** request concerns files present in relationship context
- **THEN** composer SHALL skip re-scan and use existing context data

### Requirement: fallback behavior
Composer SHALL remain backward compatible when Project Map context is missing.

#### Scenario: no relationship data
- **WHEN** no fresh context pack exists
- **THEN** composer SHALL fallback to existing discovery mechanism

### Requirement: context pack fields for composer are explicit
Composer SHALL require stable fields from context packs.

#### Scenario: consume contract
- **WHEN** consuming context pack
- **THEN** composer SHOULD rely on `mustReadFiles`, `relatedFiles`, `testTargets`, `contracts`, `riskFlags`, `provenance`, `staleReason`

