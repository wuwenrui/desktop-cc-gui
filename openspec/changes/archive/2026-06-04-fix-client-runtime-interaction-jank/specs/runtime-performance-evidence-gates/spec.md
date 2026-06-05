## ADDED Requirements

### Requirement: Client Interaction Performance Evidence SHALL Be Classified

Runtime performance closure evidence SHALL classify client interaction scenarios by evidence strength before an optimization is considered release-grade.

#### Scenario: evidence source is explicit
- **WHEN** a performance report covers Composer typing, realtime streaming, thread switching, sidebar projection, or session catalog hydration
- **THEN** each scenario MUST be classified as `measured`, `proxy`, `manual-only`, or `unsupported`
- **AND** the report MUST explain the classification and list the next action for non-measured scenarios

#### Scenario: proxy evidence cannot prove release-grade improvement
- **WHEN** a scenario is validated only by jsdom, static render count, pure helper tests, or fixture-only latency estimates
- **THEN** the report MUST classify it as proxy evidence
- **AND** it MUST NOT claim release-grade measured improvement without browser, Tauri, WebView, React Profiler, or PerformanceObserver evidence

### Requirement: Client Interaction Budgets SHALL Track User-Visible Latency

Performance evidence SHALL capture metrics that map to user-visible responsiveness rather than only backend completion time.

#### Scenario: typing budget includes input-facing signals
- **WHEN** streaming typing evidence is collected
- **THEN** it MUST include input event cadence, draft update latency or proxy, input subtree render count or proxy, React commit duration where available, long task evidence where available, and dropped/stale advisory update count where available
- **AND** it MUST preserve workspace/thread/turn/engine correlation without storing prompt or assistant body text

#### Scenario: thread switch budget separates phases
- **WHEN** thread switch evidence is collected
- **THEN** it MUST separately record foreground selection latency, message shell availability, history restore duration, sidebar projection duration or proxy, catalog request count, and stale response drops where available
- **AND** it MUST identify which phase dominates the lag

### Requirement: Performance Evidence SHALL Be Content-Safe And Bounded

Client performance diagnostics SHALL remain safe during long conversations and large workspaces.

#### Scenario: diagnostic payload excludes conversation content
- **WHEN** performance diagnostics record typing, streaming, render, switch, or catalog evidence
- **THEN** the payload MUST NOT include full prompt text, assistant body text, tool output, command output, or file diff content
- **AND** it MAY include ids, counts, lengths, timings, booleans, status labels, bounded reason strings, and evidence classifications

#### Scenario: long sessions do not produce unbounded diagnostics
- **WHEN** a long streaming session receives many deltas or a large workspace triggers many projection updates
- **THEN** diagnostics MUST aggregate, sample, or keep latest summaries instead of appending unbounded per-event records
- **AND** final reports MUST remain bounded enough for local collection and review

### Requirement: Performance Optimization Layers SHALL Be Rollback-Safe

Each client interaction optimization layer SHALL be independently reversible without breaking runtime correctness.

#### Scenario: disabling one layer preserves runtime continuity
- **WHEN** an optimization for Composer props, status projection, thread switch staging, sidebar projection, catalog pagination, or timeline rendering is disabled
- **THEN** the client MUST preserve baseline-compatible conversation rendering, terminal settlement, draft input, and session continuity
- **AND** diagnostics MUST remain available to compare baseline and optimized behavior

#### Scenario: rollback does not disable unrelated protections
- **WHEN** one optimization layer is rolled back
- **THEN** unrelated realtime batching, terminal fences, input source-of-truth, and membership truth protections MUST remain active
- **AND** the rollback scope MUST be documented in the change evidence
