## ADDED Requirements

### Requirement: Backend Scan Paths MUST Declare Cache And Evidence Contracts

Backend scan paths for sessions, history, usage, workspace files, git, and project-map relations MUST declare whether they are cached, uncached, or unsupported for caching, and MUST emit content-safe timing evidence.

#### Scenario: scan evidence is emitted for every audited path

- **WHEN** an audited backend scan completes
- **THEN** the scan evidence MUST include scan owner, duration, cache state, invalidation reason when applicable, scanned item counts when available, and evidence class
- **AND** frontend-visible evidence MUST redact or hash raw absolute paths and MUST NOT include prompt, assistant text, terminal output, diff body, or secrets.

#### Scenario: cache hit avoids unchanged source work

- **WHEN** a cached scan receives the same normalized root/workspace identity, provider identity, scan options hash, and source signature as a previous request
- **THEN** it MUST return the cached result or cached summary
- **AND** it MUST report `cacheState=hit` with no read of unchanged source segments.

#### Scenario: signature change invalidates cache

- **WHEN** root/workspace identity, provider identity, scan options hash, mtime/size/inode/content signature, or cache schema version changes
- **THEN** the affected cache entry MUST be invalidated
- **AND** the scan MUST report the invalidation reason.

#### Scenario: uncached paths are explicit

- **WHEN** a scan path has not yet adopted cache or cannot safely cache
- **THEN** diagnostics MUST classify cache state as `unsupported` or `disabled`
- **AND** acceptance evidence MUST NOT claim cache improvement for that path.

### Requirement: JSONL Scans MUST Use Append-Only Fast Path Only When Safe

JSONL scan paths MAY use an append-only fast path, but MUST fall back to a full scan when source identity or parse safety changes.

#### Scenario: append reads only new bytes

- **WHEN** a JSONL source keeps the same identity/signature prefix and grows monotonically
- **THEN** the scanner MAY read only bytes after the last recorded offset
- **AND** the result MUST merge with previous parsed state using the same source version.

#### Scenario: truncate or rotation forces full rescan

- **WHEN** file size shrinks, inode/source id changes, mtime/signature is inconsistent, or parse errors suggest corruption
- **THEN** the scanner MUST discard the append-only assumption
- **AND** it MUST run a full rescan or return a documented degraded partial result.

### Requirement: CPU-Heavy Backend Work MUST Be Budgeted And Partial-Safe

Filesystem walks, JSONL parsing, libgit2 work, and project-map scans MUST run under a documented blocking/timeout policy and produce partial results when safe.

#### Scenario: heavy work does not starve async runtime

- **WHEN** a backend command performs heavy filesystem, parsing, libgit2, or project-map work
- **THEN** it MUST use a blocking pool or equivalent isolation when appropriate
- **AND** diagnostics MUST capture timeout/queue/partial state where available.

#### Scenario: timeout yields safe partial or explicit failure

- **WHEN** work exceeds the documented timeout/budget
- **THEN** it MUST return a safe partial result with coverage metadata or an explicit recoverable error
- **AND** the UI MUST be able to distinguish partial from complete data.
