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

### Requirement: Files view uses low-signal filtering instead of unconditional governance hiding
The Project Map Files view SHALL treat low-signal files as a UI projection concern and MUST NOT hide governance or documentation roots solely because their path starts with `openspec/`, `.trellis/`, or `docs/`.

#### Scenario: Governance source appears in a relationship snapshot
- **WHEN** a scanned file belongs to `openspec/`, `.trellis/`, or `docs/` and has a meaningful role or parse status
- **THEN** the Files view can include it by default instead of classifying it as unconditional noise.

#### Scenario: Low-signal files are hidden by default
- **WHEN** a scanned file is skipped, unknown, style-only, or infrastructure-only
- **THEN** the Files view may hide it until the user enables low-signal files.

### Requirement: Java relationship calls prefer verified receiver resolution
The Project Map relationship scanner SHALL avoid treating broad Java call text matches as verified cross-file `calls` relationships.

#### Scenario: Java code calls an imported or injected collaborator
- **WHEN** a Java file calls `receiver.method(...)` or `Type.method(...)`
- **AND** the receiver/type can be resolved from imports, the current class, or a declared field
- **AND** the target file declares the called method
- **THEN** the scanner may emit a `calls` relationship from the source file to the target file.

#### Scenario: Java code contains an untyped local or generic call candidate
- **WHEN** a Java call candidate is an annotation/constructor-like token, local variable getter, DTO getter, enum equality helper, or otherwise lacks a resolvable receiver/type
- **THEN** the scanner SHALL NOT emit it as a verified cross-file `calls` relationship in the main relationship graph.

### Requirement: Relationship workspace avoids persistent repair strip noise
The Project Map relationship workspace SHALL NOT render repair/read-error artifacts as a persistent bottom strip across Graph, Files, Read, or API tabs.

#### Scenario: Snapshot contains repair issues or read errors
- **WHEN** the user switches between relationship tabs
- **THEN** repair/read-error artifacts do not appear as a global bottom text/chip strip
- **AND** the underlying artifacts remain available for future explicit diagnostics surfaces.

