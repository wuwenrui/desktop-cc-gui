## MODIFIED Requirements

### Requirement: Client Interaction Performance Evidence SHALL Be Classified

Runtime performance closure evidence SHALL classify client interaction scenarios by evidence strength before an optimization is considered release-grade.

#### Scenario: evidence source is explicit
- **WHEN** a performance report covers Composer typing, file editor typing, realtime streaming, thread switching, sidebar projection, or session catalog hydration
- **THEN** each scenario MUST be classified as `measured`, `proxy`, `manual-only`, or `unsupported`
- **AND** the report MUST explain the classification and list the next action for non-measured scenarios

#### Scenario: proxy evidence cannot prove release-grade improvement
- **WHEN** a scenario is validated only by jsdom, static render count, pure helper tests, or fixture-only latency estimates
- **THEN** the report MUST classify it as proxy evidence
- **AND** it MUST NOT claim release-grade measured improvement without browser, Tauri, WebView, React Profiler, PerformanceObserver evidence, or equivalent runtime signal

### Requirement: Client Interaction Budgets SHALL Track User-Visible Latency

Performance evidence SHALL capture metrics that map to user-visible responsiveness rather than only backend completion time.

#### Scenario: typing budget includes input-facing signals
- **WHEN** Composer typing, streaming typing, or file editor typing evidence is collected
- **THEN** it MUST include input event cadence, draft or editor update latency or proxy, relevant subtree render count or proxy, React commit duration where available, long task evidence where available, and dropped/stale advisory update count where available
- **AND** it MUST preserve workspace/thread/file/turn/engine correlation where applicable without storing prompt, assistant body text, terminal output, or file content

#### Scenario: thread switch budget separates phases
- **WHEN** thread switch evidence is collected
- **THEN** it MUST separately record foreground selection latency, message shell availability, history restore duration, sidebar projection duration or proxy, catalog request count, and stale response drops where available
- **AND** it MUST identify which phase dominates the lag

