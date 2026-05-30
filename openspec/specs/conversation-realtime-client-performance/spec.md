# conversation-realtime-client-performance Specification

## Purpose

Defines the conversation-realtime-client-performance behavior contract, covering Realtime Conversation Client MUST Expose A Three-Engine Performance Budget.
## Requirements
### Requirement: Realtime Conversation Client MUST Expose A Three-Engine Performance Budget
The client MUST define a shared performance budget for Codex, Claude Code, and Gemini realtime conversation turns so optimization decisions are evaluated against the same observable contract.

#### Scenario: streaming turn records client-side budget evidence
- **WHEN** a Codex, Claude Code, or Gemini turn enters realtime streaming
- **THEN** the client MUST be able to correlate event ingress cadence, batching flush cadence, reducer derivation cost, render-visible text cadence, and composer responsiveness evidence to the same workspace/thread/turn identity
- **AND** this evidence MUST remain bounded for long streaming turns

#### Scenario: budget evidence distinguishes engine-specific symptoms from shared client amplification
- **WHEN** Gemini, Claude Code, or Codex shows slow or choppy visible output
- **THEN** diagnostics MUST distinguish provider/upstream delay, backend forwarding stall, client reducer amplification, render amplification, and composer responsiveness degradation
- **AND** the system MUST NOT classify a shared client hot-path issue as a provider-specific issue solely because one engine exposed it first

### Requirement: Streaming Optimizations MUST Preserve Send-Critical Composer State
Realtime conversation optimizations MUST isolate high-frequency live conversation props from the composer without delaying or rewriting user-owned input state.

#### Scenario: live curtain updates do not drive composer input source of truth
- **WHEN** a conversation is streaming and the user is typing in the composer
- **THEN** deferred or throttled live props MAY be used for advisory status, context usage, rate limits, stream activity, and message items
- **AND** draft text, selection, IME composition state, attachments, and final send payload MUST remain immediate and canonical

#### Scenario: streaming completion converges deferred composer props
- **WHEN** a streaming turn completes after composer-facing live props were deferred
- **THEN** the composer MUST naturally converge to the latest canonical status and usage data
- **AND** stale advisory props MUST NOT remain visible after the turn has settled

### Requirement: Realtime Client Performance Changes MUST Be Rollback-Safe
Each client performance optimization layer MUST have a safe rollback path that restores baseline-compatible semantics without breaking session continuity.

#### Scenario: rollback disables one optimization layer without disabling diagnostics
- **WHEN** batching, incremental derivation, render pacing, or mitigation profile changes are disabled by a rollback flag
- **THEN** the client MUST continue processing realtime events with baseline-compatible semantics
- **AND** diagnostics MUST continue collecting enough evidence to compare baseline and optimized behavior

#### Scenario: rollback remains scoped to affected engine or layer
- **WHEN** a Claude/Gemini/Codex-specific profile or fast path is rolled back
- **THEN** unrelated engines and unrelated optimization layers MUST keep their existing behavior
- **AND** disabling one layer MUST NOT silently disable all realtime performance protections

### Requirement: Realtime Diagnostics MUST Distinguish Terminal Settlement Failure
Realtime client diagnostics MUST distinguish upstream or runtime stalls from frontend terminal settlement failures that leave processing state visible after final output is rendered.

#### Scenario: final output visible but processing remains true is classified as settlement failure
- **WHEN** final assistant output has been accepted by the client
- **AND** the thread remains in processing mode after terminal completion handling
- **THEN** diagnostics MUST classify the issue as frontend terminal settlement failure unless evidence shows the runtime turn is still active
- **AND** diagnostics MUST include workspace, thread, turn, engine, active turn, alias, and processing state dimensions

#### Scenario: missing terminal event remains distinguishable from rejected terminal event
- **WHEN** a user reports a stuck generating state
- **THEN** diagnostics MUST allow troubleshooting to distinguish no `turn/completed` event received from a received event rejected by settlement guards
- **AND** the system MUST NOT classify both cases as generic render or provider delay

### Requirement: Client Scheduling MUST Respect Terminal Turn Fences
Client-side realtime batching, throttling, and scheduled rendering MUST preserve terminal lifecycle semantics by checking terminal turn fences at the point where queued work executes.

#### Scenario: batched realtime operations observe terminal state at flush time
- **WHEN** realtime delta operations are buffered for client-side batching
- **AND** the associated turn reaches terminal state before the batch flushes
- **THEN** the batch flush MUST drop operations for the terminal turn
- **AND** the flush MUST NOT re-open processing or append stale visible output for that turn

#### Scenario: scheduled normalized event observes terminal state at dispatch time
- **WHEN** a normalized realtime event is queued through client scheduling before terminal settlement
- **AND** the event executes after the same turn has reached terminal state
- **THEN** the scheduled dispatch MUST skip state mutation for the terminal turn
- **AND** the thread's completed, errored, or stalled lifecycle result MUST remain unchanged

#### Scenario: integration path preserves completed state after late normalized update
- **WHEN** a full `useThreads` realtime path processes final assistant completion and turn completion
- **AND** a late normalized update for the same turn arrives afterward
- **THEN** the thread MUST remain non-processing
- **AND** the previously visible final assistant output MUST NOT be replaced or extended by the stale update

### Requirement: Realtime Performance Routing MUST Preserve Exact Turn Filtering
Realtime client performance and fallback routing optimizations MUST preserve exact turn identity so terminal filtering remains correct under high-frequency or delayed event delivery.

#### Scenario: fallback routing keeps turn id through optional handler shapes
- **WHEN** fallback routing adapts an event to agent completion, reasoning, command output, terminal interaction, or file-change handlers
- **THEN** the adapted call MUST pass through the original `turnId` when present
- **AND** the handler signature MUST remain typechecked across call sites

#### Scenario: event-handler prefilter avoids unnecessary scheduled work
- **WHEN** the event handler receives a raw item, normalized event, or agent delta for a turn already known as terminal
- **THEN** the handler MUST skip downstream realtime scheduling for that event
- **AND** no additional high-frequency client work MUST be created for the terminal turn

#### Scenario: rollback preserves baseline-compatible processing
- **WHEN** batching or scheduling optimizations are disabled by runtime flags
- **THEN** terminal turn filtering MUST still protect direct realtime execution paths
- **AND** the client MUST preserve baseline-compatible event handling for non-terminal turns

### Requirement: Realtime Performance Budget MUST Include Session Visibility
Realtime conversation performance evidence MUST include active, inactive, and restoring session visibility so regressions can distinguish provider delay from client render amplification.

#### Scenario: diagnostics correlate visibility with stream and render cost
- **WHEN** a Codex, Claude Code, or Gemini session is streaming
- **THEN** diagnostics MUST be able to correlate workspace, thread, engine, turn, visibility state, ingress cadence, buffer depth, flush latency, render cost, and long task evidence
- **AND** the evidence MUST remain bounded for long-running sessions

#### Scenario: background render amplification is distinguishable from upstream delay
- **WHEN** users report switching lag between running sessions
- **THEN** diagnostics MUST distinguish provider or backend first-token delay from runtime ingress delay, background buffer flush delay, React render amplification, and layout or scroll work
- **AND** the system MUST NOT classify background UI render amplification as an upstream provider issue without evidence

### Requirement: Background Scheduling Optimizations MUST Be Layer-Rollback Safe
Background session scheduling optimizations MUST be independently rollback-safe without breaking realtime session continuity.

#### Scenario: disabling render gating restores baseline rendering without disconnecting runtime
- **WHEN** background render gating is disabled by a rollback flag
- **THEN** the client MUST return to baseline-compatible realtime rendering behavior
- **AND** active runtime connections and in-flight session tasks MUST NOT be disconnected, restarted, or cancelled by that rollback

#### Scenario: disabling staged hydration preserves diagnostics
- **WHEN** staged hydration is disabled by a rollback flag
- **THEN** the client MAY restore baseline foreground rendering behavior for switched sessions
- **AND** diagnostics MUST continue collecting enough ingress, flush, render, and long task evidence to compare baseline and optimized behavior

### Requirement: Realtime Evidence MUST Correlate Visible-Lag Risk

Realtime performance reports MUST correlate first-token latency, inter-token jitter, batching behavior, terminal pressure, and visible-lag risk for the same scenario.

#### Scenario: realtime summary includes visible-lag risk
- **WHEN** realtime performance evidence is generated
- **THEN** the summary MUST include first-token latency and inter-token jitter where available
- **AND** the summary MUST classify visible-lag risk without hiding terminal-settlement pressure

#### Scenario: terminal pressure remains separate from provider delay
- **WHEN** realtime evidence shows terminal or batching pressure
- **THEN** the report MUST distinguish client-side terminal pressure from provider first-token delay
- **AND** it MUST NOT attribute all lag to the provider without correlated evidence

### Requirement: Realtime Performance Budget MUST Cover Single Long Live Assistant Rows

Realtime client performance evidence MUST include the cost of a single active assistant row growing to large text sizes, because list virtualization alone does not bound reducer, Markdown, layout, or scroll work inside that row. The P0 evidence target is Claude Code long output; other engines MAY opt in through the same budget.

#### Scenario: Claude Code long live row diagnostics distinguish local amplification
- **WHEN** Claude Code streams a long assistant message
- **AND** the assistant text grows beyond ordinary preview limits
- **THEN** diagnostics MUST be able to correlate delta ingress cadence, reducer merge cost, normalization cost, render cost, visible text growth, and long task evidence for the same turn
- **AND** diagnostics MUST distinguish local reducer or render amplification from upstream provider delay

#### Scenario: canonical text is not truncated on active append paths
- **WHEN** an active assistant message receives text deltas beyond the display preview budget
- **THEN** the reducer MUST preserve the canonical assistant text without applying preview truncation
- **AND** later deltas MUST merge onto the untruncated canonical body
 - **AND** this MUST hold for both reducer fast path normalization and fallback `prepareThreadItems` normalization

#### Scenario: rollback keeps diagnostics available
- **WHEN** long-row render fallback or shadow recovery is disabled by a rollback flag
- **THEN** realtime diagnostics MUST still record enough ingress, reducer, render, and visible-growth evidence to compare baseline and optimized behavior

### Requirement: Foreground Terminal Settlement Diagnostics MUST Identify The Failure Class
Realtime client diagnostics MUST emit enough structured evidence to classify foreground turns that render final output but remain in processing state.

#### Scenario: terminal event reaches frontend
- **WHEN** the app-server bridge receives `turn/completed`, `turn/error`, `turn/stalled`, or `runtime/ended` for a foreground conversation turn
- **THEN** diagnostics MUST record that the terminal event reached the frontend bridge
- **AND** the record MUST include workspace id, thread id, turn id when available, event type, and whether final content was present when known

#### Scenario: terminal event is rejected by settlement guard
- **WHEN** a terminal event reaches frontend turn settlement
- **AND** active turn identity or alias guards prevent clearing processing state
- **THEN** diagnostics MUST classify the result as rejected terminal settlement
- **AND** the record MUST include incoming turn id, current active turn id, target thread id, resolved alias when available, and processing state

#### Scenario: terminal event is deferred by lifecycle blockers
- **WHEN** a terminal completion event is intentionally deferred because lifecycle blockers still exist
- **THEN** diagnostics MUST classify the result as deferred terminal settlement
- **AND** the record MUST include blocker names or counts, assistant ingress evidence, and current active turn id

#### Scenario: terminal handling leaves busy residue
- **WHEN** terminal event handling finishes for a foreground turn
- **AND** the thread remains in processing mode or keeps the same active turn id
- **THEN** diagnostics MUST classify the result as terminal settlement busy residue
- **AND** the record MUST distinguish this case from missing terminal event and provider streaming delay

### Requirement: Foreground Settlement Diagnostics MUST Stay Bounded And Content-Safe
Settlement diagnostics MUST be safe to collect during long conversations without storing prompt or assistant body text.

#### Scenario: diagnostic payload excludes conversation content
- **WHEN** frontend emits foreground settlement diagnostics
- **THEN** the payload MUST NOT include full user prompt, assistant response, tool output, command output, or file diff content
- **AND** it MAY include ids, event labels, counts, status strings, timestamps, booleans, and bounded reason strings

#### Scenario: repeated progress evidence remains bounded
- **WHEN** a long-running foreground turn receives many progress events before terminal settlement
- **THEN** diagnostics MUST retain the latest progress evidence source and timestamp rather than appending unbounded per-event content
- **AND** terminal settlement diagnostics MUST be able to reference that latest progress evidence

### Requirement: Settlement Diagnostics MUST Support Three-Evidence Dry-Run Decisions

Realtime diagnostics MUST support dry-run three-evidence settlement decisions before guarded settlement behavior is enabled.

#### Scenario: dry-run decision records why settlement would or would not occur

- **WHEN** the client receives terminal evidence, observes busy residue, evaluates a suspected stuck foreground turn, or requests reconciliation
- **THEN** diagnostics SHOULD record the dry-run settlement decision such as `wouldSettle`, `wouldReject`, `wouldDefer`, `wouldKeepRunning`, `wouldRequestReconciliation`, or `wouldCleanupResidue`
- **AND** the record MUST include the terminal/state/progress/reconciliation evidence classes and conversation scope match result used for the decision without full conversation content

#### Scenario: scope mismatch remains visible without touching current UI

- **WHEN** dry-run settlement sees terminal, progress, status-query, or replay evidence from another thread, another engine, an older turn, an older runtime lease, or a previous foreground owner
- **THEN** diagnostics MUST classify the decision as scope mismatch, stale evidence, or equivalent
- **AND** the foreground UI state MUST remain unchanged by that evidence

#### Scenario: long-task protection remains distinguishable from stuck settlement

- **WHEN** a foreground turn has no terminal evidence but has fresh progress evidence
- **THEN** diagnostics MUST classify the decision as progress-protected or equivalent
- **AND** the system MUST NOT report the case as completed, terminal settlement failure, or provider delay without additional evidence

#### Scenario: busy residue remains separate from provider or render delay

- **WHEN** final output is visible or terminal evidence was handled
- **AND** state evidence still shows processing residue
- **THEN** diagnostics MUST classify the issue as settlement busy residue or equivalent
- **AND** it MUST remain distinguishable from upstream provider delay, backend forwarding stall, event delivery failure, and client render amplification

#### Scenario: reconciliation outcome is visible

- **WHEN** the frontend requests authoritative turn status or missed terminal replay because terminal evidence is absent and progress is stale
- **THEN** diagnostics MUST record a bounded reconciliation outcome such as `status-completed`, `status-running`, `status-unknown`, `query-failed`, `replay-terminal`, or `replay-unscoped`
- **AND** the record MUST include scope match result and decision reason without full conversation content

#### Scenario: Phase 2 behavior is kill-switchable

- **WHEN** guarded busy-residue cleanup or stale-progress reconciliation application is enabled
- **THEN** diagnostics MUST identify whether the behavior was dry-run, feature-flagged active, or disabled by kill switch
- **AND** disabling the behavior MUST leave the original normal completion path available

### Requirement: Dry-Run Settlement Diagnostics MUST Be Bounded And Distinguishable

Phase 1 diagnostics MUST expose settlement arbitration outcomes without changing runtime or UI behavior.

#### Scenario: dry-run actions are recorded as would-decisions

- **WHEN** Phase 1 records a settlement arbitration result
- **THEN** diagnostics SHOULD map helper actions to dry-run labels such as `wouldSettle`, `wouldReject`, `wouldDefer`, `wouldKeepRunning`, `wouldRequestReconciliation`, or `wouldCleanupResidue`
- **AND** the record MUST include scope match result and decision reason without full conversation content

#### Scenario: busy residue remains diagnostic-only

- **WHEN** terminal evidence is matched but state evidence still indicates busy residue
- **THEN** Phase 1 diagnostics MAY record `wouldCleanupResidue`
- **AND** the integration MUST NOT perform cleanup or alter visible conversation state

#### Scenario: reconciliation-needed is separate from provider delay

- **WHEN** terminal evidence is absent and progress is stale or absent
- **THEN** diagnostics SHOULD record reconciliation-needed or equivalent
- **AND** the record MUST remain distinguishable from upstream provider delay, runtime still active, render delay, and normal long-task protection

#### Scenario: content safety is preserved

- **WHEN** dry-run settlement diagnostics are persisted or shown in debug entries
- **THEN** they MUST use bounded ids, booleans, counts, timestamps, enum status, and bounded reason strings
- **AND** they MUST NOT include full prompts, assistant responses, tool outputs, command outputs, file diffs, auth files, or secret values

### Requirement: Status Query Reconciliation Diagnostics MUST Be Bounded And Distinguishable

Phase 2a reconciliation diagnostics MUST make status-query attempts and outcomes visible without changing runtime or UI behavior.

#### Scenario: query attempt is distinguishable from provider delay

- **WHEN** lifecycle arbitration requests authoritative status because terminal evidence is missing and progress is stale
- **THEN** diagnostics MUST record a bounded reconciliation-query attempt with a label or category distinct from upstream provider delay, render delay, normal long-task protection, and terminal busy residue
- **AND** the diagnostic MUST include scoped ids, status-query source, timestamps, progress age, and decision reason when available

#### Scenario: query result records conservative outcome

- **WHEN** authoritative status query returns `completed`, `running`, `failed`, `stalled`, `runtime-ended`, `unknown`, or `query-failed`
- **THEN** diagnostics MUST record the bounded status enum, scope match result, status source, and bounded reason
- **AND** diagnostics MUST show whether the response was accepted as Terminal Evidence candidate, kept running, rejected as stale, or deferred

#### Scenario: recovery context remains separate

- **WHEN** status reconciliation overlaps with runtime recovery quarantine, concurrent runtime acquire timeout, stale runtime cleanup, or stopping-runtime race
- **THEN** diagnostics MAY include bounded recovery context fields such as recovery state, acquire state, ended source, retry delay, and query failure reason
- **AND** those fields MUST remain separate from terminal status and MUST NOT imply completed settlement

#### Scenario: normal query consistency does not flood error log

- **WHEN** status query confirms a normal running or normally completed state without residue, stale scope, or query failure
- **THEN** the client SHOULD avoid persisting high-volume normal consistency records to the global error log
- **AND** abnormal outcomes such as stale scope, query failure, unknown status, terminal-confirmed busy residue, or rejected scope SHOULD be persistable as bounded core diagnostics

#### Scenario: reconciliation diagnostics exclude content

- **WHEN** reconciliation query diagnostics are persisted or shown in debug entries
- **THEN** they MUST use bounded ids, booleans, counts, timestamps, enum status, and bounded reason strings
- **AND** they MUST NOT include full prompts, assistant responses, tool outputs, command outputs, stdout, stderr, file diffs, auth files, or secret values

### Requirement: Phase 2a Reconciliation Diagnostics MUST Be Bounded And Persist Abnormal Outcomes

Status-query reconciliation diagnostics MUST be distinguishable from normal provider delay and must avoid content payloads.

#### Scenario: query attempt is logged

- **WHEN** frontend issues a status query because the pure helper requested reconciliation
- **THEN** it MUST emit a bounded `query-requested` diagnostic with scope ids and progress age

#### Scenario: query result is logged

- **WHEN** frontend receives a status query response
- **THEN** it MUST emit a bounded `query-resolved` diagnostic containing status enum, scope match, status source, bounded reason, and helper decision

#### Scenario: rejected or failed query is persistable

- **WHEN** status response scope is rejected, status is unknown, or the query fails
- **THEN** the diagnostic SHOULD be eligible for global error-log persistence
- **AND** it MUST exclude prompts, assistant text, command output, stdout, stderr, file diffs, auth data, and secrets

#### Scenario: hanging query receives bounded failed outcome

- **WHEN** a reconciliation status query does not return within the diagnostic timeout window
- **THEN** the frontend MUST emit a bounded `query-failed` diagnostic for the same workspace, engine, thread, turn, and query scope
- **AND** timeout failure MUST NOT clear processing state, active turn id, messages, blockers, runtime leases, or history
