## ADDED Requirements

### Requirement: Project Map git impact source
The Project X-Ray panel SHALL derive Project Map impact input from the active workspace git status when no explicit changed-file input is supplied.

#### Scenario: Active workspace has changed git files
- **WHEN** Project Map is opened for an active workspace and git status returns changed files
- **THEN** the Project Map impact view uses those changed file paths to compute changed, affected, unmapped, and ignored nodes

#### Scenario: Explicit changed files are supplied
- **WHEN** Project Map receives explicit changed file paths from a caller
- **THEN** the explicit changed file paths take precedence over git-derived paths

#### Scenario: Git status unavailable
- **WHEN** git status fails or the workspace is not a git repository
- **THEN** Project Map remains usable and does not show a git-derived impact overlay

### Requirement: Project Map impact source metadata
The Project X-Ray panel SHALL indicate whether the current impact analysis comes from explicit input, git status, or no source.

#### Scenario: Git status supplies impact files
- **WHEN** Project Map impact files are derived from git status
- **THEN** the panel can show source metadata indicating git status and the number of input files
