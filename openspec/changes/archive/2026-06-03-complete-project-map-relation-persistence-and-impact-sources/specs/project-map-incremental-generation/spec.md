## ADDED Requirements

### Requirement: Project Map relation snapshot round trip
Project Map storage SHALL allow optional relation snapshots to be written and read as part of the existing Project Map snapshot contract.

#### Scenario: Relation snapshot exists
- **WHEN** Project Map storage contains `relations/latest.json` for a workspace map
- **THEN** reading the Project Map returns relation data to the frontend dataset builder

#### Scenario: Relation snapshot is absent
- **WHEN** Project Map storage has no `relations/latest.json`
- **THEN** reading the Project Map succeeds and returns an empty or omitted relation collection without requiring migration

### Requirement: Project Map relation write path safety
Project Map snapshot writes SHALL permit `relations/latest.json` and continue rejecting relation files outside the allowed Project Map storage contract.

#### Scenario: Safe relation path is written
- **WHEN** a Project Map snapshot includes `relations/latest.json`
- **THEN** the backend accepts the path as part of the constrained snapshot contract

#### Scenario: Unsafe relation path is written
- **WHEN** a Project Map snapshot includes a relation file path with nested directories, parent traversal, uppercase reserved segments, or unsupported extensions
- **THEN** the backend rejects the write path
