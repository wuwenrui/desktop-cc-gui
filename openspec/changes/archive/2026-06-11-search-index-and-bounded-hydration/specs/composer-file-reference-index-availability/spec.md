## ADDED Requirements

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
