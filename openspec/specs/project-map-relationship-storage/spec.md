# project-map-relationship-storage Specification

## Purpose
TBD - created by archiving change add-project-map-relationship-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Sibling storage root is mandatory
The relationship data root SHALL be a sibling of existing `project-map` data:

`<app-home>/project-map-relations/<storage-key>/`

#### Scenario: default active workspace is scanned
- **WHEN** a user triggers relationship scan for active workspace
- **THEN** scan artifacts SHALL be persisted under `project-map-relations/<storage-key>/`
- **AND** the path SHALL not be under the project source directory unless user explicitly changes policy

### Requirement: Deterministic storage key isolation
The relationship root SHALL use the same workspace identity model as existing Project Map or an explicit equivalent contract.

#### Scenario: two projects share same name
- **WHEN** two distinct workspace paths have same basename
- **THEN** their storage keys SHALL differ
- **AND** their relationship roots SHALL not clash

### Requirement: Layered relationship artifact layout
The system SHALL persist multiple artifact groups instead of one single JSON file.

#### Scenario: full scan write
- **WHEN** a scan completes
- **THEN** at minimum the following artifacts SHALL exist:
  - `manifest.json`
  - `profile.json`
  - `runs/latest.json`
  - `scans/latest.json`
  - `files/manifest.json`
  - `relations/latest.json`
  - `relations/by-file.json`
  - `relations/by-type.json`
  - `modules/latest.json`
  - `impact/latest.json`
  - `context-packs/latest.json`
  - `repair/latest.json`
- **AND** file chunk artifacts (`files/chunks-*.json`, `symbols/chunks-*.json`) MAY be used when collections exceed configured thresholds

### Requirement: Path safety for relationship writes
The write layer SHALL reject invalid paths before touching filesystem.

#### Scenario: path escape
- **WHEN** a write target includes `..`, absolute path, or untrusted root traversal segments
- **THEN** write SHALL be rejected and a typed error SHALL be returned

#### Scenario: invalid reserved names
- **WHEN** file name segments include Windows reserved names (`con`, `prn`, `aux`, `nul`, `com1`, `lpt1`, ...)
- **THEN** write SHALL fail with explicit reason and skip the scan commit

### Requirement: Atomic snapshot write with rollback
The storage layer SHALL provide atomic writes and rollback semantics.

#### Scenario: snapshot commit success
- **WHEN** all planned files are written
- **THEN** manifest and latest links SHALL be atomically flipped
- **AND** readers SHALL see a consistent view

#### Scenario: partial write failure
- **WHEN** any file in snapshot fails
- **THEN** existing valid snapshots SHALL remain readable
- **AND** manifest SHALL not point to incomplete data

### Requirement: Artifact metadata includes provenance and scan identity
The system SHALL persist provenance fields for reproducibility.

#### Scenario: manifest has full identity
- **WHEN** manifest is read
- **THEN** it SHALL include at least schema version, storage key, workspace id, workspace path, scan run id, git commit hash (if available), scanned root, file count, relation count, ignored count, repaired issue count, generatedAt, and source `deterministic-scan`

### Requirement: Ignore policy is transparent and auditable
The scanner SHALL summarize ignore sources and ignored counts.

#### Scenario: ignore source includes `.gitignore`
- **WHEN** ignore rules skip files
- **THEN** `ignored` summary SHALL record count per source (`builtin`, `.gitignore`, `project-ignore`)

### Requirement: Relationship storage remains independent from UA schema
The relationship layer SHALL not serialize or depend on Understand-Anything schemas.

#### Scenario: no cross-schema dependency
- **WHEN** storage is read
- **THEN** no `KnowledgeGraph` specific field set is required
- **AND** no third-party graph persistence type is mandatory

### Requirement: Repair artifacts are first-class
Repair issues SHALL be persisted under `repair/latest.json` and surfaced by consumers.

#### Scenario: invalid relation discovered
- **WHEN** repair detects dangling / duplicate / invalid direction
- **THEN** the action and issue SHALL be persisted with IDs, evidence, and severity

### Requirement: Stale and incremental metadata
The scan metadata SHALL support stale and incremental decisions.

#### Scenario: stale detection input available
- **WHEN** latest manifest is compared with current workspace
- **THEN** dashboard and consumer layers SHALL read stale reasons from scan metadata and fingerprint differences

