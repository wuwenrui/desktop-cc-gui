# runtime-performance-evidence-gates Specification (Delta)

## ADDED Requirements

### Requirement: Long-Running Client Runtime Evidence MUST Track Bounded Resources

Runtime performance evidence MUST track long-running client resources that can make module switching and streaming degrade over time.

#### Scenario: active engine process count is budgeted

- **WHEN** long-running client runtime evidence is collected
- **THEN** it MUST include `S-LR-100/activeEngineProcessCountAfterClose` or an explicit unsupported marker
- **AND** the metric MUST report whether the evidence is measured, proxy, manual-only, or unsupported
- **AND** a nonzero value after all local workspaces close MUST include a reason or external-process qualifier
- **AND** the metric MUST be described as registered runtime handle evidence, not OS process liveness evidence

#### Scenario: OS child liveness after close is explicit

- **WHEN** long-running client runtime evidence is collected after closing local runtime workspaces
- **THEN** it MUST include `S-LR-101/sampledOsChildLivenessAfterClose` or an explicit unsupported marker
- **AND** a measured/manual/proxy value MUST include platform qualifier and sampling method
- **AND** unsupported sampling MUST include bounded rationale

#### Scenario: stale child candidates are visible

- **WHEN** stale child reconciliation runs in diagnostics-only mode
- **THEN** it MUST report `S-LR-110/staleEngineChildCandidateCount` or an explicit unsupported marker
- **AND** diagnostics-only stale candidates MUST NOT be described as auto-killed
- **AND** age-only stale candidates MUST state when progress evidence is unsupported

#### Scenario: module switch latency is phase-aware

- **WHEN** module or workspace switch performance evidence is collected
- **THEN** it MUST include `S-LR-200/moduleSwitchP95Ms` or an explicit unsupported marker
- **AND** the report SHOULD separate selection latency, list mount/commit cost, projection cost, and history/message availability where observable

#### Scenario: long-list visible row count is bounded

- **WHEN** long-list evidence is collected for Home/Sidebar/ThreadList
- **THEN** it MUST include `S-LR-210/visibleListRowCount` or an explicit unsupported marker
- **AND** the row count MUST be compared against the virtualizer overscan budget or marked unsupported with rationale

#### Scenario: markdown worker pending requests are bounded

- **WHEN** Markdown worker evidence is collected
- **THEN** it MUST include `S-LR-300/markdownWorkerPendingRequests` or an explicit unsupported marker
- **AND** pending requests MUST return to zero after worker dispose or test teardown

#### Scenario: streaming visible lag is tracked or explicitly deferred

- **WHEN** streaming runtime evidence is collected for this change
- **THEN** it MUST include `S-LR-310/streamingVisibleLagP95Ms` or an explicit unsupported/manual-only marker
- **AND** the report MUST state whether the value reuses `chat-stream-render-isolation-2026-06` baseline evidence or comes from a fresh runtime trace

### Requirement: Long-Running Runtime Evidence MUST Remain Content-Safe

Long-running runtime diagnostics MUST remain safe and bounded even during multi-engine long conversations.

#### Scenario: long-run evidence excludes conversation content

- **WHEN** process, module switch, list, streaming, or worker evidence is emitted
- **THEN** the payload MUST NOT include prompt text, assistant body text, terminal output, tool output, file diff content, or raw Markdown body
- **AND** it MAY include ids, process ids, counts, durations, lengths, hashes, evidence class, and bounded reason strings

#### Scenario: proxy evidence is not promoted to measured

- **WHEN** evidence is produced by jsdom, static counters, fixtures, synthetic worker tests, or manual notes without runtime timing
- **THEN** it MUST be classified as `proxy` or `manual-only`
- **AND** archive-readiness MUST list the measured runtime/WebView follow-up if release-grade proof is required
