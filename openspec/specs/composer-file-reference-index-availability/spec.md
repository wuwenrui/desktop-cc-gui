# composer-file-reference-index-availability Specification

## Purpose
TBD - created by archiving change fix-composer-file-reference-without-file-tree-open. Update Purpose after archive.
## Requirements
### Requirement: Composer file-reference completion MUST NOT require the file tree view

The system MUST make the active workspace file index available to composer `@` file-reference completion without requiring the user to open the right-side file tree first.

#### Scenario: composer can reference files before file tree is opened

- **GIVEN** an active workspace exists
- **AND** the right-side file tree panel has not been opened
- **WHEN** the workspace shell initializes shared workspace file data
- **THEN** the system MUST enable the initial workspace file-index lifecycle independent of file-tree visibility
- **AND** if the active workspace is connected, the system MUST perform the initial workspace file-index load
- **AND** composer `@` file-reference completion MUST receive the resulting file and directory candidates through the existing completion pipeline

#### Scenario: closed file tree does not enable periodic polling

- **GIVEN** an active workspace exists
- **AND** the right-side file tree panel remains closed
- **WHEN** the initial workspace file-index load has completed
- **THEN** the system MUST NOT start the periodic file-tree polling loop only because composer may use `@` completion

#### Scenario: visible file tree keeps existing refresh behavior

- **GIVEN** the right-side file tree panel is visible for the active workspace
- **WHEN** the workspace file-index polling interval is due
- **THEN** the system MUST continue refreshing the shared workspace file index through the existing polling behavior

### Requirement: File Reference Index MUST Be Available Without Blocking High-Frequency Input

The file reference and search index path MUST keep high-frequency Composer/search input responsive while workspace file metadata is hydrated or refreshed.

#### Scenario: active workspace index is prioritized

- **WHEN** global search or file reference search opens across multiple workspaces
- **THEN** the active workspace index SHOULD hydrate first
- **AND** other workspace hydration MUST be bounded rather than launched as unbounded parallel scans.

#### Scenario: query uses indexed candidates where available

- **WHEN** user types a search query repeatedly
- **THEN** query computation SHOULD use cached normalized provider candidates where available
- **AND** it MUST NOT rescan all raw files, messages, threads, kanban items, history, skills, and commands for every keypress when their source versions have not changed.

#### Scenario: stale async provider results are dropped

- **WHEN** a provider search or workspace hydration result resolves after the query changed or the palette closed
- **THEN** the stale result MUST be ignored or marked stale
- **AND** it MUST NOT replace newer query results.

#### Scenario: search performance metrics are bounded and content-safe

- **WHEN** search performance evidence is collected
- **THEN** it MAY include provider elapsed time, candidate count, result count, hydration state, index hit/miss, and stale drop count
- **AND** it MUST NOT include full message bodies, file content, prompt text, assistant output, or terminal output.

