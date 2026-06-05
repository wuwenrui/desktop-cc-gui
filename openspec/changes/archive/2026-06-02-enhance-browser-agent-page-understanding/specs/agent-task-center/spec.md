## ADDED Requirements

### Requirement: TaskRun details show Browser Snapshot v2 evidence
Agent Task Center SHALL display Browser Snapshot v2 evidence linked to a TaskRun, including source URL, title, capture time, freshness, summary, diagnostics, privacy state, and candidate code files when available.

#### Scenario: TaskRun has browser evidence
- **WHEN** a TaskRun includes Browser Snapshot v2 evidence
- **THEN** Task Center SHALL show the evidence in the run detail with available, stale, expired, or degraded state

#### Scenario: Browser evidence has code candidates
- **WHEN** linked browser evidence includes page-to-code candidates
- **THEN** Task Center SHALL display candidate file references with reason and confidence metadata

### Requirement: TaskRun evidence preserves browser context boundaries
Agent Task Center SHALL NOT display or persist raw DOM, cookies, headers, storage, password values, token values, or authorization secrets as TaskRun browser evidence.

#### Scenario: Evidence contains redacted fields
- **WHEN** Browser Snapshot v2 evidence includes redaction metadata
- **THEN** Task Center SHALL show redaction status without exposing redacted values
