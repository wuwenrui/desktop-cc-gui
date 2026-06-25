## ADDED Requirements

### Requirement: Codex Lifecycle Mutations MUST Be Owner-Gated

Codex lifecycle and liveness mutations MUST require an explicit event owner or a bounded unique fallback before changing processing state, active turn state, terminal settlement, or liveness progress evidence. Active UI selection, visible thread selection, sidebar selection, and last-focused thread identity MUST NOT be treated as lifecycle ownership proof.

#### Scenario: explicit owner routes lifecycle mutation
- **WHEN** a Codex lifecycle-sensitive event includes explicit thread identity
- **AND** the event includes turn identity when the event semantics are turn-scoped
- **THEN** the system MUST route the mutation to that explicit owner
- **AND** it MUST NOT replace the owner with the currently active or visible Codex thread

#### Scenario: affected runtime-ended mapping has priority
- **WHEN** a Codex `runtime/ended` event includes `affectedThreadIds`, `affectedTurnIds`, `affectedActiveTurns`, or equivalent affected owner context
- **THEN** the system MUST route terminal settlement according to that affected context
- **AND** shared-session native thread bindings MUST be resolved before mutating the shared thread state
- **AND** active UI selection MUST NOT influence the target thread

#### Scenario: bounded unique fallback is allowed
- **WHEN** a Codex lifecycle-sensitive event lacks explicit owner context
- **AND** exactly one Codex thread in the same workspace is currently processing
- **THEN** the system MAY use that single processing Codex thread as a bounded fallback owner
- **AND** the mutation MUST remain limited to that one thread

#### Scenario: same-tick processing owner is visible to fallback
- **WHEN** a Codex thread starts processing
- **AND** another ownerless lifecycle or progress event is handled in the same React event tick before post-render ref synchronization
- **THEN** the system MUST expose the newly started thread as the unique processing Codex fallback owner
- **AND** owner fallback MUST NOT depend solely on state refs refreshed by `useEffect`

#### Scenario: ambiguous fallback cannot mutate lifecycle state
- **WHEN** a Codex lifecycle-sensitive event lacks explicit owner context
- **AND** zero or multiple Codex threads in the workspace are possible owners
- **THEN** the system MUST NOT use active thread selection, visible thread selection, sidebar selection, or last-focused thread as owner
- **AND** the event MUST NOT change processing state, active turn state, terminal settlement, or liveness progress evidence for a guessed thread

#### Scenario: ambiguous owner remains diagnosable
- **WHEN** a Codex event cannot be mapped to a safe owner
- **THEN** the system MAY record diagnostics containing workspace id, method, risk classification, candidate owners, and failure reason
- **AND** diagnostics MUST NOT mutate unrelated Codex conversation lifecycle state

#### Scenario: diagnostic-only events cannot consume lifecycle fallback
- **WHEN** a Codex event is classified as diagnostic-only
- **AND** it lacks explicit thread ownership
- **THEN** the system MUST NOT use bounded processing fallback to assign it to a conversation
- **AND** it MUST NOT mutate processing state, active turn state, terminal settlement, or liveness progress evidence

### Requirement: Settled Codex Turns MUST Not Revive From Late Or Ambiguous Events

Codex turns that have completed, failed, stalled, been abandoned, or otherwise entered terminal settlement MUST remain terminal unless a verified successor turn identity is active.

#### Scenario: late processing-start event cannot restore loading
- **WHEN** a Codex turn has already reached terminal settlement
- **AND** a late `turn/started`, status running/processing, item-start, heartbeat, token, reasoning, tool, request-user-input, or generated-image progress event arrives for the settled turn
- **THEN** the system MUST NOT mark the settled thread as processing again
- **AND** the event MUST be skipped, quarantined, or recorded only as stale diagnostics

#### Scenario: duplicate turn-start for settled turn cannot revive loading
- **WHEN** a Codex `threadId + turnId` has already completed and entered settled-turn quarantine
- **AND** the same `turn/started` event is delivered again after settlement
- **THEN** the system MUST NOT call processing-start mutation for that thread
- **AND** it MUST NOT restore the old turn as the active realtime or lifecycle turn

#### Scenario: transitioned realtime dispatch cannot revive completed loading
- **WHEN** a Codex normalized realtime content event is scheduled through React transition
- **AND** the same `threadId + turnId` reaches terminal settlement before the queued transition callback commits
- **THEN** the queued callback MUST NOT call `markProcessing(true)` for that thread
- **AND** it MUST re-check terminal quarantine before mutating message content
- **AND** sidebar/composer loading state MUST remain completed

#### Scenario: turnless terminal settlement quarantines the active Codex turn
- **WHEN** a Codex terminal event such as runtime-ended, parse-error, stalled, or completed settlement reaches the frontend without a `turnId`
- **AND** the target thread has a current active lifecycle turn or matching turn diagnostic
- **THEN** the system MUST resolve that active turn as the terminal settlement identity
- **AND** it MUST record realtime terminal state and settled-turn quarantine for that resolved turn
- **AND** later turnless raw or normalized item/progress events for the same thread MUST NOT mark the completed conversation processing again

#### Scenario: ambiguous progress event cannot revive completed session
- **WHEN** a Codex conversation is no longer processing
- **AND** a progress-only event lacks explicit thread and turn ownership
- **THEN** the system MUST NOT use active UI selection to record liveness progress for that completed conversation
- **AND** the conversation MUST remain non-processing

#### Scenario: terminal event consumed by wrong thread is forbidden
- **WHEN** two or more Codex conversations are processing in the same workspace
- **AND** a terminal event lacks explicit owner context
- **THEN** the system MUST NOT settle whichever Codex thread is active or visible
- **AND** the real owner MUST NOT be left unsettled because another thread consumed the event by fallback

#### Scenario: verified successor turn can receive new events
- **WHEN** a settled Codex turn is followed by a verified successor turn for the same thread
- **AND** a later event matches the successor turn identity
- **THEN** the system MUST allow the successor event to update lifecycle or progress state
- **AND** the old settled turn MUST remain quarantined from mutation

### Requirement: Codex Single-Session Liveness MUST Survive Ownership Hardening

Ownership hardening MUST preserve correct single-session Codex behavior. The system MUST NOT solve parallel contamination by disabling useful single-session lifecycle settlement or low-risk progress compatibility.

#### Scenario: single processing Codex thread can still settle from safe fallback
- **WHEN** exactly one Codex thread is processing in a workspace
- **AND** a non-benign lifecycle event lacks explicit owner context
- **THEN** the system MAY settle or update that unique processing thread through bounded fallback
- **AND** the thread MUST NOT remain stuck in loading solely because explicit owner fields were absent

#### Scenario: benign manual shutdown remains non-mutating
- **WHEN** a `runtime/ended` event represents benign manual shutdown
- **AND** it has no active lease, no pending requests, and no affected owner context
- **THEN** the system MUST preserve the existing no-op teardown behavior
- **AND** it MUST NOT synthesize a guessed terminal error for the active Codex thread

#### Scenario: explicit progress remains visible
- **WHEN** a Codex heartbeat, token usage, reasoning delta, tool output, request-user-input, or equivalent progress event includes explicit owner context
- **THEN** the system MUST continue recording the progress for that owner
- **AND** ownership hardening MUST NOT suppress valid progress for the active turn

#### Scenario: compatibility fallback is bounded by live ownership
- **WHEN** a progress-only Codex compatibility event lacks explicit owner context
- **AND** exactly one Codex thread in the workspace is processing
- **THEN** the system MAY route the event to that unique thread
- **AND** it MUST NOT create or revive processing state for a settled or non-processing thread

#### Scenario: background stuck Codex turn can reconcile by scoped status
- **WHEN** a background Codex conversation remains processing after progress becomes stale
- **AND** another conversation is currently active in the UI
- **AND** scoped backend reconciliation for the background `workspaceId + threadId + turnId` reports a terminal status such as `runtime-ended`, `completed`, `failed`, or `stalled`
- **THEN** the system MUST clear the background conversation's processing residue
- **AND** it MUST NOT require the background conversation to be the active tab
- **AND** cleanup MUST still be rejected if workspace, engine, thread, or turn scope does not match

#### Scenario: assistant message completion cannot replace terminal authority
- **WHEN** a Codex turn receives `onAgentMessageCompleted` or normalized `completeAgentMessage`
- **AND** no `turn/completed`, `turn/error`, `turn/stalled`, `runtime-ended`, or scoped backend terminal reconciliation result has arrived
- **THEN** the system MUST NOT settle the turn from assistant message completion alone
- **AND** it MUST NOT mark the realtime turn terminal, clear active turn state, clear sidebar/composer processing residue, or quarantine the turn
- **AND** later item, tool, reasoning, or progress events for the same active turn MUST remain eligible to update the conversation

#### Scenario: assistant message completion cannot flush blocked terminal deferral
- **WHEN** a Codex `turn/completed` event has already been deferred because active execution blockers were present
- **AND** assistant message completion or assistant text delta later arrives for the same thread
- **AND** at least one child/tool blocker is still running
- **THEN** the system MUST keep the completion deferred
- **AND** it MUST NOT clear processing, clear active turn state, or quarantine the turn until the blocker becomes terminal or scoped reconciliation returns a matching terminal owner

#### Scenario: scoped backend terminal status can flush blocked terminal deferral
- **WHEN** a Codex `turn/completed` event has been deferred because active execution blockers were present
- **AND** a scoped backend status query for the same `workspaceId + threadId + turnId` returns a terminal status
- **THEN** the system MUST flush the deferred completion and clear processing for that matching thread
- **AND** it MUST NOT require the conversation to be the active tab
- **AND** it MUST NOT mutate any other parallel Codex thread

#### Scenario: non-terminal deferred status keeps completion blocked
- **WHEN** a Codex `turn/completed` event has been deferred because active execution blockers were present
- **AND** the scoped backend status query returns `running`, `unknown`, `query-failed`, or a mismatched workspace/thread/turn
- **THEN** the system MUST keep the completion deferred
- **AND** it MUST NOT clear processing or active turn state

### Requirement: Codex Ownership Hardening MUST Be Protected By Regression Tests

Codex ownership hardening MUST be delivered with tests that protect both existing correct behavior and the parallel contamination regression. Tests MUST distinguish semantic behavior from unsafe implementation details such as active-thread lifecycle ownership.

#### Scenario: good behavior is locked before routing changes
- **WHEN** ownership hardening is implemented
- **THEN** tests MUST first preserve Codex single-session lifecycle behavior, explicit affected `runtime/ended` routing, shared-session native rebinding, and normalized late-event non-revival behavior
- **AND** those tests MUST pass before and after implementation

#### Scenario: pollution regressions cover parallel Codex sessions
- **WHEN** two or more Codex sessions are processing concurrently
- **THEN** tests MUST prove no-owner terminal, processing-start, and progress events cannot mutate active, visible, or completed Codex sessions by guess
- **AND** those tests MUST fail on the unsafe owner fallback and pass after the gate is implemented
