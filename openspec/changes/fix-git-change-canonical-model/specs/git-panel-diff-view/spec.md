## ADDED Requirements

### Requirement: Git Diff Panel SHALL Use Canonical Change Projection

The Git Diff panel SHALL derive visible changed-file rows from a canonical projection that reconciles status entries and diff entries before rendering file lists or diff viewer inputs.

#### Scenario: Status entries remain authoritative
- **WHEN** a path exists in staged or unstaged status entries and matching diff evidence is available
- **THEN** the Git Diff panel MUST preserve the status-derived path, status, section, additions, deletions, and existing action semantics
- **AND** diff evidence MUST only enrich preview content or media metadata

#### Scenario: Diff-only added file remains visible
- **WHEN** diff evidence contains a file that is not present in the status-derived file list
- **AND** the diff evidence indicates a new file through optional status, `new file mode`, or `--- /dev/null`
- **THEN** the Git Diff panel MUST render that path as an added file instead of silently dropping it

#### Scenario: Diff-only deleted file remains visible
- **WHEN** diff evidence contains a file that is not present in the status-derived file list
- **AND** the diff evidence indicates deletion through optional status, `deleted file mode`, or `+++ /dev/null`
- **THEN** the Git Diff panel MUST render that path as a deleted file instead of silently dropping it

#### Scenario: Diff-only fallback entry is preview-only
- **WHEN** canonical projection creates a visible row from diff evidence without matching staged or unstaged status evidence
- **THEN** that row MUST allow non-mutating preview and focus behavior
- **AND** it MUST NOT expose stage, unstage, discard, or commit inclusion mutation controls until section state is confirmed by status evidence

#### Scenario: Staged and unstaged same-path state is preserved
- **WHEN** the same path has both staged and unstaged status entries
- **THEN** canonical projection MUST preserve both section-scoped entries
- **AND** stage, unstage, discard, preview, and commit inclusion controls MUST continue to target the same section semantics as before

#### Scenario: Canonical identities remain role-specific
- **WHEN** the same path appears in multiple Git panel responsibilities
- **THEN** file-list row identity MUST be section-scoped
- **AND** diff viewer identity MUST remain path-scoped
- **AND** mutation action identity MUST include section and operation semantics

### Requirement: Canonical Git Change Projection SHALL Be Cross-Platform

Canonical Git change projection SHALL behave consistently on Windows, macOS, Linux, and browser/Web Service surfaces.

#### Scenario: Path separators do not change file identity
- **WHEN** status or diff inputs refer to the same repository-relative file using `src/foo.ts` and `src\foo.ts`
- **THEN** canonical projection MUST treat them as the same logical Git path for merge purposes
- **AND** it MUST NOT rely on OS-specific path APIs to determine identity

#### Scenario: Line endings do not change status inference
- **WHEN** diff text uses LF or CRLF line endings
- **THEN** canonical projection MUST infer added, deleted, and modified fallback status consistently
- **AND** additions/deletions best-effort counting MUST classify `+` and `-` diff lines consistently across both line-ending styles

#### Scenario: Web Service and desktop use the same projection rules
- **WHEN** Git Diff panel data arrives from local desktop commands, remote daemon forwarding, or a Web Service-facing interface
- **THEN** the UI MUST apply the same canonical projection rules after data receipt
- **AND** Web-facing behavior MUST NOT diverge through a parallel status/diff merge implementation

#### Scenario: Incomplete Web-facing payloads are handled safely
- **WHEN** a Web-facing Git payload entry lacks `path`
- **THEN** canonical projection MUST discard that entry from visible changed-file rows
- **AND** it MUST use existing diagnostic/error reporting paths where available

#### Scenario: Missing diff does not create fallback entries
- **WHEN** a Web-facing or daemon diff payload omits `diff`
- **AND** no status-derived entry exists for that path
- **THEN** canonical projection MUST NOT synthesize a diff-only fallback row for that entry

### Requirement: Deleted File Rows SHALL Expose Explicit Deleted-State Visual Semantics

Deleted file rows in the Git Diff panel SHALL be visually distinguishable from modified and added files without changing existing actions or accessibility semantics.

#### Scenario: Deleted row uses explicit deleted styling
- **WHEN** a changed file row has status `D`
- **THEN** the row MUST expose a deleted-state visual treatment such as line-through, subdued text, or equivalent deleted affordance
- **AND** the status marker MUST remain distinguishable from added, modified, renamed, and typechange statuses

#### Scenario: Deleted styling preserves interaction affordances
- **WHEN** a deleted file row is selected, focused, hovered, or opened through keyboard interaction
- **THEN** the row MUST preserve existing focus, active, selected, preview, context menu, and commit inclusion affordances
- **AND** the deleted styling MUST NOT hide stage, unstage, discard, or preview controls that were available before

### Requirement: Git Diff Canonical Model SHALL Preserve Payload Compatibility

Git Diff panel canonical projection SHALL be compatible with existing local, remote daemon, and Web Service payloads that omit optional diff status.

#### Scenario: Optional diff status enriches projection
- **WHEN** a diff entry includes an optional status field
- **THEN** canonical projection MAY use that status for fallback entries
- **AND** status-derived staged or unstaged entries MUST still take precedence for existing paths

#### Scenario: Missing optional diff status remains supported
- **WHEN** a local, remote daemon, or Web-facing diff entry omits optional status
- **THEN** canonical projection MUST fall back to diff-header inference
- **AND** existing error handling, loading states, and return-shape compatibility MUST remain unchanged

#### Scenario: Rename headers infer rename display status
- **WHEN** a diff-only entry includes `rename from` and `rename to` headers
- **THEN** canonical projection MUST infer rename display status `R`
- **AND** it MUST NOT require deep rename pairing to preserve existing compatibility

### Requirement: Git Diff Canonical Model SHALL Respect Large-File Governance

Implementation of canonical Git change projection SHALL avoid increasing large-file debt and SHALL remain compatible with the large-file governance workflow.

#### Scenario: Implementation avoids mega-component growth
- **WHEN** canonical projection logic is implemented
- **THEN** merge, inference, path normalization, and stat counting logic MUST live in focused utility code rather than being embedded deeply in large React components
- **AND** component changes MUST remain thin wiring and presentation updates unless the design document records an explicit exception

#### Scenario: Large-file governance remains passable across OS matrix
- **WHEN** the change is ready for review
- **THEN** the implementation MUST be compatible with the workflow steps in `.github/workflows/large-file-governance.yml`
- **AND** it MUST remain suitable for `ubuntu-latest`, `macos-latest`, and `windows-latest` runners
