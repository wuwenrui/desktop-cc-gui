# parallel-conversation-runtime-residuals Specification

## Purpose

多 workspace / 多 session 并行实时对话的卡顿问题 MUST be handled as a layered runtime-residual problem, not as a single renderer symptom. This spec defines the observable contracts and P0 recovery paths for performance flags, Claude child-process lifecycle, and follow-up diagnostics.
## Requirements
### Requirement: Parallel Conversation Runtime Residuals MUST Be Diagnosable From Webview

The client MUST expose diagnostic surfaces that let an operator inspect the layers that contribute to the "parallel conversation jank" symptom from DevTools or Settings.

#### Scenario: operator can identify active engine child processes

- **WHEN** active process diagnostics are requested
- **THEN** the response MUST include workspace ids, engine type, registered active process ids, total registered active process count, and a sampling timestamp
- **AND** the diagnostic payload MUST be stable enough to paste into a bug report
- **AND** local Claude, OpenCode, and Gemini sessions that own `active_processes` MUST be represented when they have active child handles
- **AND** the payload MUST NOT imply OS process exit solely from a drained runtime registry

#### Scenario: operator can inspect realtime performance flags

- **WHEN** `getActiveRealtimePerfFlags()` is called
- **THEN** it MUST return every known `ccgui.perf.*` flag
- **AND** each entry MUST include `value`, `source`, `storageKey`, `defaultValue`, `testDefaultValue`, and `metric`

#### Scenario: diagnostic command survives degraded runtime mode

- **WHEN** active process diagnostics are invoked in remote backend mode
- **THEN** the response MUST succeed with `measured=false`
- **AND** it MUST include an `unsupportedReason` explaining that active process diagnostics are local-runtime only

### Requirement: Performance Flag Default Values MUST Be Self-Documenting And Resettable

The realtime performance flag system MUST expose its known flags, current value, source, defaults, and reset path from a single source-of-truth registry.

#### Scenario: operator inspects active perf flags

- **WHEN** `getActiveRealtimePerfFlags()` is called
- **THEN** it MUST return all 8 `ccgui.perf.*` flags
- **AND** each entry MUST include `value`, `source`, `storageKey`, `defaultValue`, `testDefaultValue`, and `metric`

#### Scenario: operator resets perf flags

- **WHEN** `resetRealtimePerfFlags()` is called
- **THEN** every known `ccgui.perf.*` key MUST be removed from `localStorage`
- **AND** the in-memory cache MUST be cleared
- **AND** Settings MUST show a reload-required message rather than silently reloading

#### Scenario: reset keeps unrelated localStorage keys

- **WHEN** `resetRealtimePerfFlags()` clears known realtime performance overrides
- **THEN** localStorage keys outside the `ccgui.perf.*` registry MUST remain untouched
- **AND** the reset result MUST report only removed known performance keys

### Requirement: ClaudeSession MUST Release Child Processes On Drop

`ClaudeSession` MUST provide a non-blocking Drop fallback for any child process handles still present in `active_processes`.

#### Scenario: Drop drains remaining active children

- **WHEN** `Drop::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit

#### Scenario: Drop does not block runtime teardown

- **WHEN** `Drop::drop` runs while the active process mutex is locked
- **THEN** it MUST log a warning and return without panicking
- **AND** it MUST NOT block waiting for the async mutex

#### Scenario: active process diagnostics are webview-callable

- **WHEN** `get_engine_active_process_diagnostics` is invoked in local mode
- **THEN** the response MUST include Claude workspace ids and active process ids
- **AND** it MUST include a total active process count and a timestamp

#### Scenario: remote mode diagnostics do not break UI

- **WHEN** `get_engine_active_process_diagnostics` is invoked in remote backend mode
- **THEN** the response MUST succeed with `measured=false`
- **AND** it MUST include an `unsupportedReason` explaining that active process diagnostics are local-runtime only

### Requirement: Progressive Reveal Cadence MUST Remain Measurable For Long Turns

The Markdown progressive reveal path MUST avoid repeated full-window boundary scans when revealing long streaming content. Boundary selection MUST preserve readable Markdown chunking while keeping the scan linear in the candidate window.

#### Scenario: short pending text flushes immediately

- **WHEN** `pendingText.length <= PROGRESSIVE_REVEAL_SMALL_PENDING_CHARS`
- **THEN** `resolveProgressiveRevealValue()` MUST return `targetValue`
- **AND** it MUST NOT require boundary scanning to decide the result

#### Scenario: boundary finder uses a single candidate-window scan

- **WHEN** `resolveProgressiveRevealValue()` reveals a partial chunk from long pending text
- **THEN** boundary classification MUST be computed in one pass over newline boundaries in the candidate window
- **AND** it MUST NOT run multiple regex passes over the same candidate text

#### Scenario: readable Markdown boundaries keep priority

- **WHEN** candidate text contains paragraph, heading, list, quote, code fence, and plain newline boundaries
- **THEN** the reveal boundary SHOULD prefer readable structural boundaries over plain newline fallback
- **AND** the fallback MUST still return `preferredEnd` when no safe boundary is available

#### Scenario: long pending reveal remains partial

- **WHEN** pending text is long but below the extreme backlog immediate-flush threshold
- **THEN** `resolveProgressiveRevealValue()` MUST return a value longer than `visibleValue`
- **AND** it MUST remain shorter than `targetValue`

#### Scenario: follow-up profiling records Markdown cost

- **WHEN** a long turn streams 8000+ characters
- **THEN** follow-up profiling SHOULD record Markdown render rate and boundary-scan p95 latency
- **AND** any cadence change MUST be backed by profiler evidence rather than guesswork

### Requirement: Handler Reference Churn MUST Be Measured Before Concern Splitting

The realtime handler surface MUST record handler rebuild evidence before any concern-splitting follow-up is accepted.

#### Scenario: follow-up handler split preserves existing consumers

- **WHEN** handler groups are split by streaming, lifecycle, and diagnostic concern
- **THEN** existing `useAppServerEvents` consumers MUST remain backward-compatible
- **AND** handler rebuild counts SHOULD be measured before and after the split

### Requirement: Long Session Lists MUST Keep DOM Size Bounded

Any Home/recent conversation/thread sidebar surface that can render 100+ session rows MUST use virtualization or an equivalent bounded-render strategy once identified as a measured jank source.

#### Scenario: follow-up list optimization is evidence-driven

- **WHEN** a workspace has 200 threads
- **THEN** the implementation SHOULD measure rendered row count and scroll frame time
- **AND** optimization SHOULD target the measured list surface rather than unrelated lists

### Requirement: Image Resources MUST Have Release Evidence On Session Switch

Local image rendering MUST provide release evidence before image-resource follow-up changes are accepted.

#### Scenario: follow-up image release records resource evidence

- **WHEN** long parallel conversations include local images
- **THEN** follow-up validation SHOULD capture heap snapshots or equivalent image-resource evidence
- **AND** released image resources SHOULD be attributable to workspace and thread ownership

### Requirement: useThreads Timers MUST Be Bounded And Idle-Scheduled

Non-critical timers in `useThreads` MUST be deduplicated and cleared through a centralized registry when the timer audit identifies them as jank contributors.

#### Scenario: follow-up timer audit records queue size

- **WHEN** multiple workspaces and sessions are active
- **THEN** follow-up diagnostics SHOULD record timer count and timer-fire density
- **AND** non-critical timers SHOULD prefer idle scheduling where available

### Requirement: OpenCodeSession And GeminiSession MUST Release Child Processes On Drop

OpenCode and Gemini sessions MUST provide the same non-blocking Drop fallback as Claude for any child process handles still present in their `active_processes` maps.

#### Scenario: OpenCode Drop drains remaining active children

- **WHEN** `OpenCodeSession::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining OpenCode child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit
- **AND** lock failure MUST log a warning and return without panicking

#### Scenario: Gemini Drop drains remaining active children

- **WHEN** `GeminiSession::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining Gemini child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit
- **AND** lock failure MUST log a warning and return without panicking

#### Scenario: active process diagnostics include all child-owning local engines

- **WHEN** `get_engine_active_process_diagnostics` is invoked in local mode
- **THEN** the response MUST include active child process rows for Claude, OpenCode, and Gemini sessions when present
- **AND** the total active process count MUST equal the sum of all included row process ids
- **AND** the count MUST be documented as a registered runtime handle count, not an OS process liveness proof

### Requirement: Stale Child Reconciliation MUST Start Diagnostics-Only

Stale child-process reconciliation MUST first ship as diagnostics-only so false positives can be reviewed before any automatic kill policy is enabled.

#### Scenario: stale child candidate is reported without kill

- **WHEN** a local engine child process exceeds the configured registered-age threshold
- **THEN** diagnostics MUST record workspace id, engine, process id, registered age, stale reason, and progress evidence class
- **AND** engines without reliable progress metadata MUST report `progressEvidence=unsupported` instead of claiming missing progress
- **AND** the reconciler MUST NOT kill the process unless an explicit follow-up policy enables kill behavior

#### Scenario: reconciler evidence is content-safe

- **WHEN** stale child diagnostics are emitted
- **THEN** the payload MUST NOT include prompt text, assistant body text, terminal output, tool output, or file content
- **AND** it MAY include ids, process ids, durations, engine names, and bounded reason strings

### Requirement: Runtime Registry And OS Process Liveness MUST Be Separate Evidence

The client MUST keep registered child-handle diagnostics separate from OS-level process liveness evidence.

#### Scenario: registry count after close is measured separately

- **WHEN** all local runtime workspaces are closed and diagnostics are sampled after the documented wait window
- **THEN** registered active process count MUST be reported from runtime registries
- **AND** a zero registry count MUST only mean no known child handles remain registered

#### Scenario: OS liveness sampling is explicit

- **WHEN** OS child process liveness is sampled after workspace close
- **THEN** the evidence MUST state measured, proxy, manual-only, or unsupported
- **AND** unsupported OS sampling MUST include a bounded rationale instead of being inferred from registry diagnostics

