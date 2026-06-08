# runtime-performance-evidence-gates Specification

## Purpose
TBD - created by archiving change stabilize-runtime-performance-evidence-gates. Update Purpose after archive.
## Requirements
### Requirement: Runtime Evidence Gate MUST Classify Closure Evidence

The system MUST classify performance and stability closure evidence before declaring a runtime optimization or stability change ready for archive.

#### Scenario: report classifies evidence source
- **WHEN** runtime performance evidence is generated
- **THEN** each scenario MUST be classified as `measured`, `proxy`, `unsupported`, or `manual-only`
- **AND** the report MUST include a short reason for that classification

#### Scenario: proxy evidence does not become release-grade proof
- **WHEN** a scenario is backed only by fixture, jsdom, static, or proxy evidence
- **THEN** the report MUST NOT describe the scenario as fully measured
- **AND** the report MUST include the next evidence action needed for release-grade closure

### Requirement: Runtime Evidence Gate MUST Preserve Platform Qualifiers

The system MUST preserve local, skipped, unsupported, and platform-specific qualifiers in generated closure reports.

#### Scenario: missing Windows evidence remains visible
- **WHEN** local validation lacks Windows execution
- **THEN** generated reports MUST keep Windows evidence as missing or unsupported
- **AND** the reports MUST NOT mark Windows as passed by inference from macOS or Linux evidence

#### Scenario: unsupported webview timing remains explicit
- **WHEN** cold-start webview timing cannot be collected in the current environment
- **THEN** generated reports MUST record an `unsupported` classification with a reason
- **AND** the report MUST include the remediation target for real webview timing

### Requirement: Runtime Evidence Gate MUST Produce Archive-Readiness Guidance

The system MUST generate guidance that separates task-complete OpenSpec changes from archive-ready OpenSpec changes.

#### Scenario: completed active changes are listed separately
- **WHEN** OpenSpec active-change state is inspected
- **THEN** task-complete changes MUST be listed separately from in-progress changes
- **AND** each completed active change MUST retain validation, manual-test, and platform qualifier notes when available

#### Scenario: in-progress changes remain explicit
- **WHEN** an active change has incomplete tasks
- **THEN** the report MUST list it as in-progress
- **AND** the report MUST NOT include it in archive-ready recommendations

### Requirement: Runtime Evidence Gate MUST Separate Dead Code From Compatibility Code

The system MUST distinguish unreferenced dead code from intentional compatibility, diagnostic, and platform fallback paths.

#### Scenario: compatibility paths are not deleted by reference count alone
- **WHEN** a low-reference or externally invoked compatibility path is found
- **THEN** the cleanup report MUST classify it as compatibility or diagnostic before removal is considered
- **AND** deletion MUST require a dedicated removal change or explicit compatibility evidence

#### Scenario: true dead code is eligible for cleanup
- **WHEN** a code path has no imports, no command exposure, no external runtime entry, and no documented compatibility purpose
- **THEN** it MAY be listed as cleanup-eligible
- **AND** the report MUST include the verification method used to reach that conclusion

### Requirement: Runtime Evidence Gate MUST Keep Validation Noise Actionable

The system MUST treat validation noise as a stability defect when it comes from runtime cleanup that outlives the owning component or environment.

#### Scenario: virtualizer cleanup does not outlive jsdom teardown
- **WHEN** the Messages timeline virtualizer observes scroll offset changes
- **AND** the timeline unmounts before a scheduled scroll-end fallback fires
- **THEN** the pending fallback timer MUST be cleared during cleanup
- **AND** the cleanup MUST remove scroll listeners registered by the observer

#### Scenario: heavy-test-noise remains a usable stability gate
- **WHEN** `npm run check:heavy-test-noise` runs the full test inventory
- **THEN** async teardown errors from the Messages timeline virtualizer MUST NOT be reported after the owning test environment is destroyed

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

### Requirement: Renderer stability evidence MUST be classified before release or archive claims
Performance and stability evidence reports SHALL classify renderer pressure and recovery evidence by collection strength before claiming release-grade improvement.

#### Scenario: evidence report covers renderer stability
- **WHEN** a report claims improvement for white-screen, WebView/WebContent crash, renderer unresponsive, long-run pressure, or multi-engine streaming stability
- **THEN** the report MUST classify each evidence item as measured, proxy, manual-only, or unsupported
- **AND** measured evidence MUST identify the source such as native process event, backend heartbeat watchdog, WebView/Tauri profiler, PerformanceObserver, OS process snapshot, or equivalent platform signal

#### Scenario: platform evidence is unavailable
- **WHEN** a platform cannot provide memory, process, long-task, native process failure, or profiler evidence
- **THEN** the report MUST mark that signal as unsupported with reason
- **AND** it MUST NOT present proxy or manual-only evidence as release-grade measured evidence

