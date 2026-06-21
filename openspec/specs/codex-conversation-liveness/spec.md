# codex-conversation-liveness Specification

## Purpose

Defines the codex-conversation-liveness behavior contract, covering Codex Conversation Liveness MUST Separate Draft, Identity, Runtime, And Turn State.
## Requirements
### Requirement: Codex Conversation Liveness MUST Separate Draft, Identity, Runtime, And Turn State

Codex conversation liveness MUST be modeled as separate draft, thread identity, runtime generation, and foreground turn states rather than treating a `threadId` or runtime-ready result as complete conversation health.

#### Scenario: runtime readiness does not prove thread identity readiness
- **WHEN** a Codex runtime reconnect or `ensureRuntimeReady` action succeeds
- **AND** the active `threadId` cannot be verified by `thread/resume`, `turn/start`, alias resolution, or an equivalent identity check
- **THEN** the system MUST keep thread identity liveness in `stale`, `unrecoverable`, or equivalent non-ready state
- **AND** the UI MUST NOT claim the old conversation has been restored solely because the runtime is ready

#### Scenario: runtime generation guards stale lifecycle updates
- **WHEN** a Codex runtime is replaced, reacquired, or restarted for the same workspace
- **THEN** the system MUST associate subsequent liveness diagnostics with a distinguishable runtime generation or equivalent session identity
- **AND** late events or shutdown diagnostics from an older runtime generation MUST NOT overwrite the active generation's conversation state

#### Scenario: turn liveness settles independently from thread liveness
- **WHEN** a Codex foreground turn stops receiving progress evidence
- **THEN** the system MUST evaluate that turn's liveness using bounded turn-level evidence
- **AND** the thread identity MUST NOT be marked recovered, replaced, or unrecoverable merely because the turn entered stalled state

### Requirement: First-Turn Codex Drafts MUST Be Disposable Until A Turn Is Accepted

A Codex conversation created before any user turn is accepted MUST be treated as a disposable draft, even if the implementation has already created a provisional backend `threadId`.

#### Scenario: idle before first send falls back to fresh create and send
- **WHEN** the user creates a new Codex conversation
- **AND** no user turn has been accepted for that conversation
- **AND** the user waits long enough that the provisional `threadId` becomes unavailable or returns `thread not found`
- **THEN** the first user send MUST create or acquire a fresh Codex thread and send the user prompt there
- **AND** the system MUST NOT show a stale old-session recovery card as the primary path for that first prompt

#### Scenario: empty draft fresh fallback is not presented as old-session recovery
- **WHEN** a first-turn Codex draft falls back to a fresh thread
- **THEN** lifecycle state MUST identify the fresh thread as the active target
- **AND** user-visible copy MUST express fresh continuation or draft replacement rather than restored old conversation continuity

#### Scenario: accepted first turn promotes draft to durable identity
- **WHEN** Codex accepts the first user turn for a draft conversation
- **THEN** the conversation MUST promote the resulting thread identity to durable active identity
- **AND** later failures MUST follow stale-thread, runtime-ended, or stalled-turn recovery semantics instead of disposable draft semantics

### Requirement: Draft And Durable Boundaries MUST Use Canonical Activity Facts

Codex liveness MUST decide draft replacement from canonical accepted-turn and durable-activity facts, not from a frontend-only guess.

#### Scenario: accepted-turn fact promotes durable-safe behavior
- **WHEN** the canonical lifecycle fact says a Codex identity has accepted a user turn or has durable activity
- **THEN** the identity MUST be treated as durable for recovery purposes
- **AND** the system MUST NOT silently replace it as an empty draft even if the current frontend item list is empty, stale, filtered, or not yet loaded

#### Scenario: unknown accepted-turn fact defaults durable-safe
- **WHEN** the system cannot determine whether a Codex identity has accepted user work
- **AND** there is no current pre-accept first-send user intent being retried
- **THEN** the identity MUST enter a durable-safe recovery path such as verify, rebind, explicit fresh continuation, or failed retryable state
- **AND** the system MUST NOT use automatic first-turn draft replacement until the authoritative fact is known to be false

#### Scenario: lost draft marker during current first send can fresh continue
- **WHEN** the accepted-turn marker is unavailable because the local draft state was lost or reloaded
- **AND** the current user prompt has not received a `turn/start` acceptance
- **AND** local durable activity facts remain absent except for the current optimistic user intent
- **AND** the identity failure is `thread not found`, `[session_not_found]`, `session not found`, or equivalent missing-thread evidence rather than a malformed id
- **THEN** the system MAY treat the source as a local first-send draft and create a fresh Codex thread
- **AND** it MUST replay the current prompt visibly in the fresh thread without recording the stale draft as durable activity

#### Scenario: frontend local items can only narrow obvious false state
- **WHEN** frontend local items show no user, assistant, tool, approval, or persisted durable activity
- **AND** the canonical accepted-turn fact is available and false
- **THEN** the system MAY treat the conversation as disposable draft
- **AND** diagnostics MUST record that draft replacement was based on an authoritative no-accepted-turn fact

### Requirement: Codex Recovery Outcomes MUST Be Classified

Codex recovery actions MUST return and consume classified outcomes so UI, runtime, and messaging paths can make consistent decisions.

#### Scenario: verified rebind reports rebound
- **WHEN** recovery verifies the same thread or a canonical replacement that preserves old conversation identity
- **THEN** the outcome MUST be classified as `rebound`
- **AND** duplicate user prompt suppression MAY remain enabled for resend paths

#### Scenario: explicit new target reports fresh
- **WHEN** recovery cannot verify old identity but creates a new Codex thread for user continuation
- **THEN** the outcome MUST be classified as `fresh`
- **AND** resend paths MUST visibly send or render the replayed user prompt in the fresh thread

#### Scenario: no usable target reports failed
- **WHEN** recovery cannot verify old identity and cannot create a fresh continuation target
- **THEN** the outcome MUST be classified as `failed`
- **AND** the current surface MUST remain visibly failed or retryable rather than silently clearing the recovery affordance

#### Scenario: user stop after liveness stall reports abandoned
- **WHEN** the user stops a Codex turn that has already entered stalled or dead-recoverable liveness state
- **THEN** the outcome MUST be classified as `abandoned` or an equivalent terminal state
- **AND** subsequent sends MUST NOT remain blocked by the abandoned turn's in-flight state

### Requirement: Codex Liveness Diagnostics MUST Be Correlatable

Every Codex liveness failure covered by this capability MUST leave enough structured evidence to correlate frontend conversation state with backend runtime state.

#### Scenario: liveness failure captures core dimensions
- **WHEN** Codex liveness transitions to stale, stalled, runtime-ended, failed, fresh, or abandoned
- **THEN** diagnostics MUST preserve `workspaceId`, engine, active thread identity when available, runtime generation when available, turn id when available, liveness stage, and recovery outcome
- **AND** these fields MUST be visible through existing debug, runtime log, runtime pool, or thread diagnostic surfaces without requiring a new incident store

#### Scenario: first-turn draft fallback records draft context
- **WHEN** an empty Codex draft falls back to a fresh thread on first send
- **THEN** diagnostics MUST indicate that no accepted user turn existed for the old draft identity
- **AND** operators MUST be able to distinguish draft replacement from stale durable conversation recovery

#### Scenario: long stall records last progress evidence age
- **WHEN** a Codex turn enters stalled or dead-recoverable state due to missing progress evidence
- **THEN** diagnostics MUST include the last known progress signal or last event timestamp when available
- **AND** operators MUST be able to distinguish quiet protected work from bounded liveness failure

### Requirement: Codex Stalled Or Abandoned Turn MUST Not Revive From Stale Progress Evidence

Codex conversation liveness MUST treat stalled or abandoned turn settlement as terminal for that turn's UI processing state unless a verified successor turn identity is active.

#### Scenario: stale progress after settlement cannot restore generating state
- **WHEN** a Codex turn has been settled as stalled, dead-recoverable, abandoned, interrupted, failed, or equivalent terminal liveness state
- **AND** stale progress evidence later arrives for the same settled turn identity
- **THEN** the system MUST NOT restore normal generating or processing state for that old turn
- **AND** diagnostics MUST identify the evidence as stale late progress

#### Scenario: verified successor identity can continue
- **WHEN** a Codex turn has been settled as stalled
- **AND** the user starts or recovers into a verified successor turn identity
- **THEN** realtime evidence for the successor identity MUST be allowed to update the conversation
- **AND** the old stalled identity MUST remain quarantined from mutating active state

### Requirement: Codex Silent Turn Suspicion MUST Remain Non-Terminal Until Authoritative Settlement

Codex conversation liveness MUST model frontend-observed silent turns as non-terminal suspicion until an authoritative runtime, backend, or user action settles the turn.

#### Scenario: frontend silence does not terminalize active turn
- **WHEN** a Codex foreground turn enters `suspected-silent` or an equivalent soft state because the frontend has not observed progress within the configured no-progress window
- **THEN** the turn MUST remain non-terminal
- **AND** active turn identity MUST remain eligible to consume matching realtime progress
- **AND** the system MUST NOT emit terminal external settlement for that turn solely from the frontend suspicion

#### Scenario: backend terminal event overrides suspicion
- **WHEN** a Codex foreground turn is in `suspected-silent`
- **AND** backend emits `turn/completed`, `turn/error`, `turn/stalled`, `runtime/ended`, or an equivalent authoritative terminal event for the same active turn identity
- **THEN** lifecycle MUST settle the turn according to that authoritative event
- **AND** the suspected state MUST be cleared or superseded by the terminal state

#### Scenario: user stop after suspicion settles deterministically
- **WHEN** the user stops a Codex turn that is in `suspected-silent`
- **THEN** the turn MUST settle as abandoned, interrupted, failed, or an equivalent terminal state
- **AND** subsequent sends MUST NOT remain blocked by that old suspected turn

### Requirement: Codex Progress Evidence MUST Include Non-Text Runtime Activity

Codex turn liveness MUST treat normalized runtime activity as progress evidence even when no assistant text delta is visible.

#### Scenario: heartbeat refreshes liveness
- **WHEN** a `processing/heartbeat` or equivalent runtime heartbeat is correlated to the current Codex thread, runtime generation, and active turn when available
- **THEN** the system MUST treat it as progress evidence
- **AND** the no-progress window MUST be measured from that heartbeat

#### Scenario: active status refreshes liveness
- **WHEN** `thread/status/changed`, runtime status, or equivalent event reports active, running, processing, or alive state for the current Codex thread and runtime generation
- **THEN** the system MUST treat it as progress evidence
- **AND** the turn MUST NOT enter suspected-silent based on an older frontend timestamp

#### Scenario: item and tool state refresh liveness
- **WHEN** an item, command, tool, file-change, approval, request-user-input, token usage, or equivalent structured runtime activity changes for the active Codex turn
- **THEN** the system MUST treat that change as progress evidence
- **AND** liveness diagnostics MUST record the progress source when available

### Requirement: Codex Soft-Suspect UI MUST Be Low-Interruption And Self-Recovering

Codex soft-suspect state MUST inform the user without requiring manual debug interaction and MUST recover automatically when matching progress arrives.

#### Scenario: suspected silence shows passive status
- **WHEN** a Codex foreground turn enters `suspected-silent`
- **THEN** UI MUST show passive waiting copy or equivalent low-interruption status
- **AND** UI MUST keep Stop available
- **AND** UI MUST NOT require the user to open a debug panel to continue normal monitoring

#### Scenario: matching late progress clears passive status
- **WHEN** UI is showing suspected-silent status for a Codex turn
- **AND** matching realtime progress arrives for the active turn identity
- **THEN** UI MUST clear suspected-silent status automatically
- **AND** UI MUST return to normal waiting or ingress processing presentation

### Requirement: Codex Silent Liveness Diagnostics MUST Distinguish Suspicion From Settlement

Codex liveness diagnostics MUST preserve the difference between frontend-observed suspected silence and authoritative stalled settlement.

#### Scenario: frontend suspicion records non-terminal source
- **WHEN** a Codex turn enters suspected-silent due to frontend no-progress observation
- **THEN** diagnostics MUST record source `frontend-no-progress-suspected` or an equivalent non-terminal source
- **AND** diagnostics MUST include last progress evidence source and age when available

#### Scenario: authoritative stalled records terminal source
- **WHEN** a Codex turn enters stalled, dead-recoverable, abandoned, runtime-ended, or equivalent terminal liveness state
- **THEN** diagnostics MUST record the authoritative source such as `backend-authoritative-stalled`, `runtime-ended`, or `user-abandoned`
- **AND** diagnostics MUST NOT conflate that source with frontend-only suspected silence

#### Scenario: recovery records suspicion duration
- **WHEN** a suspected-silent Codex turn later receives matching progress or terminal settlement
- **THEN** diagnostics MUST preserve that the turn was previously suspected
- **AND** diagnostics SHOULD include the suspected duration when available

### Requirement: Mature Codex Streaming Liveness MUST Survive Refactors

Codex streaming and liveness handling are considered mature. Refactors MUST preserve the separation between realtime progress evidence, frontend suspicion, authoritative terminal settlement, and history reconciliation.

#### Scenario: refactor preserves non-terminal suspicion
- **WHEN** developers refactor Codex realtime event handling, conversation lifecycle reducers, liveness timers, runtime diagnostics, or history reconciliation
- **THEN** frontend-observed silence MUST remain a non-terminal `suspected-silent` style state
- **AND** only authoritative runtime, backend, user stop, or terminal turn evidence MAY settle the active turn

#### Scenario: non-text activity remains progress evidence
- **WHEN** a Codex turn emits runtime heartbeat, thread status, tool progress, command output, file-change activity, approval state, token usage, request-user-input, or equivalent structured activity
- **THEN** liveness MUST treat that activity as progress evidence even if assistant text has not changed
- **AND** refactors MUST NOT regress to a text-delta-only definition of progress

#### Scenario: history reconciliation is not required for live convergence
- **WHEN** realtime Codex events have enough evidence to update active turn state or visible assistant/tool rows
- **THEN** the UI MUST converge through the realtime path first
- **AND** history reconciliation MUST remain a validation or replay aid rather than the only path that clears loading, suspected silence, duplicate assistant rows, or final visible state

#### Scenario: settled turns stay quarantined
- **WHEN** a Codex turn has settled as stalled, abandoned, interrupted, failed, or completed
- **THEN** late stale progress for that old turn identity MUST remain quarantined
- **AND** refactors MUST NOT let stale evidence revive processing state unless a verified successor turn identity is active

### Requirement: First-Turn Draft Replacement MUST Cover Recovery Entrypoints

Codex first-turn draft replacement MUST apply to every user-visible entrypoint that attempts to continue the current first prompt before `turn/start` acceptance, including direct send retry, runtime resume, and recovery-card resend.

#### Scenario: recovery card does not bypass empty draft replacement
- **WHEN** a newly created Codex draft has no accepted user turn and no durable local activity
- **AND** the provisional thread identity fails with `thread not found` before the current first prompt is accepted
- **THEN** the primary continuation path MUST create or acquire a fresh Codex thread and replay the current prompt there
- **AND** the UI MUST NOT require stale old-session recovery as the primary action for that first prompt

#### Scenario: durable boundary keeps recovery card semantics
- **WHEN** the Codex thread has accepted user work, durable local activity, or unknown accepted-turn facts
- **AND** the thread identity fails with `thread not found`
- **THEN** the system MUST keep durable-safe stale recovery semantics
- **AND** it MUST NOT silently replace the conversation as an empty draft

### Requirement: Codex Liveness Diagnostics MUST Preserve Settlement Source Without Changing Suspicion Semantics
Codex foreground liveness diagnostics MUST record why a turn did or did not settle while preserving the existing separation between frontend suspicion and authoritative terminal settlement.

#### Scenario: progress evidence records latest source
- **WHEN** a Codex foreground turn receives stream delta, heartbeat, status-active event, item update, tool update, file-change update, approval update, user-input request, or equivalent progress evidence
- **THEN** diagnostics MUST record the latest progress evidence source and timestamp for the active turn
- **AND** this record MUST NOT itself mark the turn terminal or clear active-turn state

#### Scenario: suspected silent remains non-terminal in diagnostics
- **WHEN** a Codex foreground turn enters suspected-silent because frontend no-progress observation expires
- **THEN** diagnostics MUST identify the source as frontend no-progress suspicion
- **AND** diagnostics MUST NOT report this as completed, stalled, runtime-ended, or otherwise authoritative terminal settlement

#### Scenario: authoritative settlement includes previous suspicion and progress evidence
- **WHEN** a Codex foreground turn later receives `turn/completed`, `turn/error`, `turn/stalled`, `runtime/ended`, user stop, or equivalent authoritative terminal evidence
- **THEN** diagnostics MUST include the authoritative settlement source
- **AND** diagnostics MUST preserve whether the same turn was previously suspected-silent and the latest known progress evidence source when available

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
