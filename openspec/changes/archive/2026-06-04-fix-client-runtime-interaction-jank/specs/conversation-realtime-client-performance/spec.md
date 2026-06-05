## ADDED Requirements

### Requirement: Realtime Composer Input SHALL Remain Responsive During Streaming

The client SHALL keep Composer user input on an immediate source-of-truth path while realtime conversation output is streaming.

#### Scenario: active typing does not wait for live timeline derivation
- **WHEN** a Codex, Claude Code, Gemini, or OpenCode turn is streaming
- **AND** the user types into the Composer
- **THEN** draft text, selection, IME composition state, attachments, and final send payload MUST update from immediate Composer state
- **AND** timeline grouping, message anchors, sticky header, status panel, or session catalog updates MUST NOT become prerequisites for accepting the input event

#### Scenario: advisory stream props may lag without corrupting send state
- **WHEN** stream activity, context usage, rate limits, account status, or status panel summary changes during active typing
- **THEN** the client MAY defer or reuse last-good advisory props
- **AND** the Composer MUST converge to canonical latest advisory props after typing idle or turn settlement
- **AND** the final send payload MUST NOT include stale or deferred draft text

### Requirement: Composer Adapter SHALL Ignore Structurally Equal Streaming Props

Composer adapter memoization SHALL treat structurally equal stream-facing props as no-op updates so object identity churn does not re-render the input subtree.

#### Scenario: equal advisory payloads do not re-render input subtree
- **WHEN** context usage, dual context usage, Claude context usage, account rate limits, stream activity, selected context chips, queue summaries, or status panel summary are rebuilt with equal user-visible values
- **THEN** the Composer adapter MUST treat the update as equivalent
- **AND** the ChatInputBox subtree MUST NOT re-render solely because those object or array references changed

#### Scenario: send-critical changes still re-render
- **WHEN** draft text, disabled state, selected engine, selected model, attachments, send readiness, permission mode, or selected agent actually changes
- **THEN** the Composer adapter MUST allow the update through
- **AND** the user-visible control state MUST remain correct

### Requirement: Status Projection SHALL Stay Out Of The Input Hot Path

Status panel and subagent projection SHALL avoid full multi-thread scans during active streaming input.

#### Scenario: scoped projection is used during streaming
- **WHEN** an active thread is streaming and the user is interacting with the Composer
- **THEN** status projection MUST use scoped indexes, cached summaries, deferred summaries, or active-root-only derivation
- **AND** it MUST NOT rebuild fallback parent maps or scan every thread item on each text delta

#### Scenario: status summary converges after interaction
- **WHEN** active typing or IME composition ends
- **THEN** deferred status projection MUST refresh from canonical thread state
- **AND** subagent counts, running status, file changes, commands, and navigation targets MUST converge without changing conversation state

### Requirement: Realtime Interactive Controls SHALL Remain Responsive During Streaming

Streaming conversation controls SHALL remain on an immediate interaction path even when live output, status projection, sidebar projection, or catalog hydration is busy.

#### Scenario: stop control does not wait for render-heavy derivations
- **WHEN** a realtime turn is streaming and the user activates Stop
- **THEN** the Stop action MUST be accepted from the current control state without waiting for timeline grouping, status projection, catalog hydration, sidebar projection, or scroll work to finish
- **AND** disabling or settling the control MUST follow canonical runtime state, not a deferred advisory snapshot

#### Scenario: message and context controls stay clickable during live output
- **WHEN** long assistant output is streaming
- **AND** the user clicks message toolbar actions, copy, fork, rewind, context controls, or scroll controls
- **THEN** the click handler MUST be reachable without depending on per-delta full timeline recomputation
- **AND** any deferred visual summary MUST converge after idle or turn settlement without dropping the user action

### Requirement: Thread Switching SHALL Prioritize Foreground Selection

The client SHALL split thread switching into foreground selection and deferred hydration so visible navigation is not blocked by catalog or history work.

#### Scenario: foreground transition commits first
- **WHEN** the user selects a different workspace thread
- **THEN** active workspace/thread identity and the visible chat shell MUST update before non-critical hydration work completes
- **AND** history restore, workspace thread-list hydration, related catalog prewarm, right-panel collapse, and non-active sidebar projection MAY run in transition, staged async work, or idle work

#### Scenario: stale switch work cannot overwrite current thread
- **WHEN** the user switches from thread A to thread B before thread A restore or hydration completes
- **THEN** late results for thread A MUST be ignored or scoped to thread A
- **AND** they MUST NOT replace thread B messages, processing state, active engine, draft text, or selected workspace

### Requirement: Realtime Interaction Evidence SHALL Include Input And Switch Metrics

Realtime performance diagnostics SHALL correlate streaming output with input responsiveness and thread switch responsiveness.

#### Scenario: streaming typing evidence is correlated by turn
- **WHEN** a streaming typing performance report is produced
- **THEN** the report MUST include workspace id, thread id, engine, turn id when available, input event cadence, adapter render count or equivalent, React commit cost where available, long task evidence, and visible text cadence
- **AND** the report MUST classify evidence as measured, proxy, manual-only, or unsupported

#### Scenario: thread switch evidence distinguishes foreground and hydration cost
- **WHEN** a thread switch performance report is produced
- **THEN** the report MUST separate foreground visible switch latency from history restore, catalog hydration, sidebar projection, and backend request cost
- **AND** it MUST NOT attribute all switch lag to provider or transcript loading without correlated evidence
