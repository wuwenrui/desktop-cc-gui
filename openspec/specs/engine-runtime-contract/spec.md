# engine-runtime-contract Specification

## Purpose

Defines the canonical runtime realtime and history contract across supported engines.
## Requirements
### Requirement: Engine Runtime Realtime Event Contract MUST Be Canonical

The system MUST treat the `NormalizedThreadEvent` shape defined in `src/features/threads/contracts/conversationCurtainContracts.ts` as the canonical realtime event contract for all supported engines (`claude` / `codex` / `gemini` / `opencode`). Each `NormalizedThreadEvent` MUST identify its semantics by the pair `(itemKind, operation)` plus the supporting fields `engine`, `workspaceId`, `threadId`, `eventId`, `timestampMs`, `item`, and `sourceMethod`. Engine-private event names captured as `sourceMethod` MAY exist as compatibility inputs but MUST NOT be treated as canonical semantics; canonical semantics live only in `(itemKind, operation)`.

#### Scenario: canonical semantics are expressed by (itemKind, operation)

- **WHEN** the system maps an engine realtime event to a `NormalizedThreadEvent`
- **THEN** the `itemKind` field MUST be one of the documented `NormalizedConversationItemKind` values (`message` / `reasoning` / `diff` / `review` / `explore` / `generatedImage` / `tool`)
- **AND** the `operation` field MUST be one of the documented operations: `itemStarted` / `itemUpdated` / `itemCompleted` / `appendAgentMessageDelta` / `completeAgentMessage` / `appendReasoningSummaryDelta` / `appendReasoningSummaryBoundary` / `appendReasoningContentDelta` / `appendToolOutputDelta`
- **AND** the rest of the payload MUST conform to the field shape declared by `NormalizedThreadEvent`

#### Scenario: engine-private event names are normalized through NORMALIZED_EVENT_DICTIONARY and recorded in sourceMethod

- **WHEN** an engine emits an event whose private name appears in `NORMALIZED_EVENT_DICTIONARY` (e.g. `assistant_message_delta`, `reasoning_delta`, `tool_call`, `tool_result`, `generated_image`, `image_generation_call`)
- **THEN** the adapter MUST normalize that private name to the corresponding `itemKind` via the dictionary
- **AND** the adapter MUST preserve the private name in `sourceMethod` so that legacy aliases remain traceable without being promoted to canonical semantics

#### Scenario: unknown realtime event MUST be dropped, MUST NOT mutate state, and MUST be assertable in tests

- **WHEN** an engine emits a realtime event whose private name is neither in `NORMALIZED_EVENT_DICTIONARY` nor matched by an adapter's documented branch
- **THEN** the adapter's `mapEvent(input)` MUST return `null`
- **AND** the adapter MUST NOT mutate normalized thread state for that event
- **AND** parity tests MUST assert this `null` outcome for at least one unknown-event fixture per engine
- **AND** this contract MUST NOT require a new "structured unknown event signal" runtime API on `RealtimeAdapter`; the existing `NormalizedThreadEvent | null` return is sufficient

### Requirement: Non-NormalizedThreadEvent Realtime Signals Are Out Of This Contract

The system's `NormalizedThreadEvent` shape covers conversation item evolution only. Other realtime signals — including turn lifecycle (`turn started / completed / error`), processing heartbeats, token usage updates, runtime lifecycle, and rate-limit notifications — flow through separate hooks and reducer paths and MUST NOT be re-expressed as `NormalizedThreadEvent` operations by this contract.

#### Scenario: turn lifecycle and usage signals are not encoded as NormalizedThreadEvent operations

- **WHEN** the system observes a turn lifecycle change or a usage update
- **THEN** that observation MUST flow through its existing dedicated channel (turn / usage / runtime hooks)
- **AND** it MUST NOT be encoded as a new `operation` value on `NormalizedThreadEvent`

#### Scenario: future runtime signal contracts are deferred to follow-up changes

- **WHEN** a future requirement proposes formalizing turn-lifecycle or usage-update contracts
- **THEN** that work MUST be introduced via a separate OpenSpec change with its own capability spec
- **AND** it MUST NOT silently extend `NormalizedThreadEvent`

### Requirement: Engine History Snapshot Contract MUST Be Semantically Equivalent To Replayed Realtime

The system MUST guarantee that, for the same conversation, applying a history snapshot from `HistoryLoader` and then resuming realtime ingestion produces a reducer state semantically equivalent to a full-realtime ingestion. History snapshots MAY compress reasoning / tool output deltas but MUST preserve user and assistant message identity, ordering, and completion status.

#### Scenario: history snapshot replay converges to the same reducer state as full realtime

- **WHEN** the system loads history via `sharedHistoryLoader` and then receives subsequent realtime events
- **THEN** the resulting reducer state for user message identity, assistant message identity, and turn lifecycle MUST equal the state produced by processing those same events purely via realtime path

#### Scenario: history snapshot does not duplicate already-visible realtime rows

- **WHEN** realtime path has already settled an assistant message
- **AND** history replay later provides an equivalent assistant message
- **THEN** the loader MUST recognize the equivalence and MUST NOT append a duplicate row

### Requirement: Adapter Registry MUST Be Statically Exhaustive Over Every EngineType

The `realtimeAdapterRegistry` MUST be a static `Record<ConversationEngine, RealtimeAdapter>` mapping that exhaustively covers every variant of `ConversationEngine`. Adding a new `ConversationEngine` variant MUST require adding the corresponding adapter in the same change set; otherwise the TypeScript compiler MUST reject the build.

#### Scenario: every ConversationEngine variant has a registered adapter

- **WHEN** the codebase is compiled with `tsc --noEmit`
- **THEN** every variant of `ConversationEngine` MUST be present as a key in `realtimeAdapterRegistry`
- **AND** the absence of any variant MUST be a typecheck failure

#### Scenario: no runtime registration or override path is introduced by this contract

- **WHEN** an adapter is needed at runtime
- **THEN** the resolution MUST use the static registry lookup
- **AND** there MUST NOT be a `registerAdapter()` or `overrideAdapter()` runtime API introduced by this contract

### Requirement: HistoryLoader Registry MUST Be Statically Exhaustive Over Every EngineType

The history loader entry points (`claudeHistoryLoader`, `codexHistoryLoader`, `geminiHistoryLoader`, `opencodeHistoryLoader` and `sharedHistoryLoader`) MUST collectively cover every supported engine. Adding a new engine MUST require providing a corresponding history loader in the same change set.

#### Scenario: every supported engine has a history loader

- **WHEN** the codebase is compiled
- **THEN** every supported engine MUST have a history loader entry point reachable from `sharedHistoryLoader`
- **AND** a missing loader MUST be detectable by typecheck or by the loader parity test

### Requirement: Cross-Engine Parity Test Matrix MUST Cover Canonical Event And History Semantics

The system MUST provide a cross-engine parity test matrix that exercises canonical realtime events and history snapshot semantics across all four supported engines. The matrix MUST live in `src/features/threads/contracts/` or `src/features/threads/adapters/` and be runnable via the standard `npm run test` path.

#### Scenario: parity tests cover the canonical (itemKind, operation) pairs and history equivalence for all four engines

- **WHEN** the parity test suite is executed
- **THEN** for each of `claude` / `codex` / `gemini` / `opencode`, the suite MUST assert correct `NormalizedThreadEvent` normalization for at least: assistant message delta (`itemKind=message`, `operation=appendAgentMessageDelta`), assistant message completion (`operation=completeAgentMessage`), reasoning delta (`itemKind=reasoning`, one of the `appendReasoning*` operations) **or** a documented "not supported" marker for that engine, tool output delta (`itemKind=tool`, `operation=appendToolOutputDelta`), and history-realtime convergence
- **AND** turn-lifecycle / usage / processing-heartbeat signals are explicitly out of this parity matrix per the prior requirement

#### Scenario: parity gaps are reported as test failures rather than silent skips

- **WHEN** a parity dimension is not yet supported by an engine
- **THEN** the test suite MUST encode this as an explicit "documented gap" marker, not as a silent skip
- **AND** removing the gap marker without replacement test MUST cause a test failure

### Requirement: Legacy Realtime Aliases MUST Be Documented As Compatibility Inputs

For every legacy realtime event alias accepted by adapters, the system MUST document the alias, the canonical event it maps to, and the engines that emit it. Legacy aliases MUST be classified as compatibility input only and MUST NOT appear as new canonical names in this contract.

#### Scenario: legacy alias list is enumerable and testable

- **WHEN** a legacy alias is accepted by `sharedRealtimeAdapter`
- **THEN** the alias MUST appear in a documented list (e.g. fixture, test table, or spec annex)
- **AND** removing acceptance of a documented alias MUST require an explicit follow-up change

### Requirement: Engine Runtime Contract MUST Be Validated By CI

The system MUST run focused TypeScript tests for adapter normalization, history equivalence, replay boundary, and cross-engine parity on every CI run. These tests MUST be platform-neutral and MUST pass on `ubuntu-latest`, `macos-latest`, and `windows-latest`.

#### Scenario: CI runs realtime contract tests on three platforms

- **WHEN** CI executes the frontend test job
- **THEN** `realtimeEventContract.test.ts`, `realtimeAdapters.test.ts`, `historyLoaders.test.ts`, `sharedHistoryLoader.test.ts`, `realtimeBoundaryGuard.test.ts`, and `realtimeReplayHarness.test.ts` MUST pass
- **AND** the same tests MUST pass on Linux, macOS, and Windows runners

#### Scenario: OpenSpec strict validation gates this capability

- **WHEN** CI or release validation runs OpenSpec validation
- **THEN** `openspec validate formalize-engine-runtime-contract --strict --no-interactive` MUST pass

### Requirement: Engine Runtime MUST Normalize Settlement Evidence For All Engines

The engine runtime contract MUST expose enough normalized evidence for the lifecycle layer to evaluate three-evidence turn settlement consistently across Claude, Codex, Gemini, and OpenCode.

#### Scenario: terminal signals map to normalized terminal evidence

- **WHEN** an engine emits a completion, error, stalled, runtime-ended, interruption, or equivalent terminal signal
- **THEN** the engine adapter or runtime bridge MUST map it to normalized terminal evidence consumable by conversation lifecycle arbitration
- **AND** the evidence MUST preserve source method, workspace id, thread id, turn id when available, engine, runtime session or lease id when available, timestamp, and terminal kind

#### Scenario: progress signals map to normalized progress evidence

- **WHEN** an engine emits heartbeat, active status, stream delta, tool activity, file change, approval, user-input request, token usage, or equivalent non-terminal activity
- **THEN** the adapter or runtime bridge MUST map it to normalized progress evidence when it can be correlated to a foreground thread or turn
- **AND** progress evidence MUST NOT itself be treated as terminal state

#### Scenario: unscoped runtime evidence cannot drive settlement

- **WHEN** an engine adapter or runtime bridge cannot identify the workspace, engine, thread, and relevant turn or runtime lease for a terminal or progress event
- **THEN** it MUST either attach an explicit diagnostic-only marker or withhold the event from lifecycle settlement inputs
- **AND** lifecycle arbitration MUST NOT infer the missing scope from the most recent active foreground turn

#### Scenario: runtime lease changes isolate old terminal events

- **WHEN** a runtime reconnect, restart, retry, or adapter replacement creates a newer active runtime session or lease for the same thread
- **AND** terminal evidence later arrives from the older runtime session or lease
- **THEN** the adapter or lifecycle arbitration MUST classify that evidence as stale for current-turn settlement unless a verified alias explicitly binds it to the active turn
- **AND** stale lease evidence MUST NOT clear the newer active lease's processing state

#### Scenario: state evidence remains lifecycle-owned

- **WHEN** lifecycle arbitration needs `isProcessing`, active turn identity, alias resolution, pending blockers, or foreground ownership
- **THEN** that state evidence MUST be read from conversation lifecycle state
- **AND** engine adapters MUST NOT independently mutate or reinterpret lifecycle-owned state outside documented settlement paths

### Requirement: Engine Runtime MUST Provide Authoritative Reconciliation Sources

The engine runtime and backend bridge MUST provide scoped authoritative status or replay mechanisms for cases where frontend terminal evidence may have been missed.

#### Scenario: scoped turn status can confirm terminal or running state

- **WHEN** the frontend requests turn or runtime lease status for reconciliation
- **THEN** the backend or runtime bridge MUST require workspace id, engine, thread id, turn id or verified alias, and runtime lease id when available
- **AND** it SHOULD return a bounded status such as `completed`, `running`, `failed`, `stalled`, `runtime-ended`, or `unknown`
- **AND** the response MUST preserve the scope used to compute the answer

#### Scenario: status responses avoid full content

- **WHEN** the backend or runtime bridge responds to settlement reconciliation
- **THEN** it MUST return scoped ids, status enum, timestamps, source method, and bounded reason when available
- **AND** it MUST NOT return full user prompts, assistant responses, tool outputs, stdout/stderr, file diffs, auth files, or secret values as settlement evidence

#### Scenario: missed terminal replay remains scoped

- **WHEN** the client asks to replay missed terminal events
- **THEN** the backend or runtime bridge MUST only replay terminal events that match the requested workspace, engine, thread, turn or verified alias, and runtime lease when available
- **AND** replayed events that cannot be scoped MUST be marked diagnostic-only or omitted from lifecycle settlement inputs

#### Scenario: status unknown does not imply completed

- **WHEN** the backend or runtime bridge cannot determine whether a turn is completed or running
- **THEN** it MUST return `unknown` or an equivalent bounded status
- **AND** clients MUST NOT interpret that response as completed settlement evidence

#### Scenario: new engine variants must join evidence parity

- **WHEN** a new supported engine is added
- **THEN** the same change set MUST document how terminal, progress, status-query, and replay evidence is normalized for that engine
- **AND** missing evidence normalization MUST be visible as a typecheck, parity test, or OpenSpec validation gap rather than silent behavior drift

### Requirement: Engine Runtime Status Query MUST Be Scoped And Conservative

Engine runtime and backend bridges MUST expose future authoritative status-query behavior using scoped request and response data, and MUST avoid optimistic completed inference.

#### Scenario: status query request includes conversation scope

- **WHEN** the frontend lifecycle coordinator requests authoritative status for three-evidence reconciliation
- **THEN** the request MUST include workspace id, engine, thread id, turn id or verified alias when available, runtime session id or runtime lease id when available, request source, and request timestamp
- **AND** backend/runtime MUST reject or return diagnostic-only status for requests that lack workspace id, engine, or thread id

#### Scenario: status query response echoes computed scope

- **WHEN** backend/runtime returns a status query response
- **THEN** the response MUST echo the workspace id, engine, thread id, turn id or verified alias when used, runtime session id or runtime lease id when used, status source, observed timestamp, status enum, and bounded reason
- **AND** the frontend MUST NOT use a response for settlement if the echoed scope does not match the current lifecycle scope

#### Scenario: status enum is bounded

- **WHEN** backend/runtime reports turn or lease status for reconciliation
- **THEN** it MUST use a bounded status enum containing only terminal, running, unknown, or query-failed states such as `completed`, `running`, `failed`, `stalled`, `runtime-ended`, `unknown`, and `query-failed`
- **AND** it MUST NOT encode full prompt, assistant output, tool output, stdout, stderr, file diff, auth data, or secrets in the status value or reason

#### Scenario: unsupported engine status is explicit

- **WHEN** an engine cannot provide authoritative turn or lease status
- **THEN** backend/runtime MUST return `unknown` or `query-failed` with a bounded reason
- **AND** it MUST NOT synthesize `completed` from elapsed time, history content, visible text, or frontend silence

#### Scenario: stale lease status is not current terminal proof

- **WHEN** backend/runtime can only answer status for an older runtime session or older lease
- **AND** the frontend current lifecycle scope has a newer runtime session or lease for the same thread
- **THEN** the response MUST be treated as stale for current-state settlement
- **AND** it MUST NOT clear the newer active runtime lease or foreground processing state

### Requirement: Runtime Reconciliation Status Query MUST Be Conversation Scoped

Backend/runtime MUST expose a bounded status-query contract for three-evidence reconciliation.

#### Scenario: required scope is enforced

- **WHEN** a status query request lacks workspace id, engine, or thread id
- **THEN** backend/runtime MUST return `query-failed` or diagnostic-only `unknown`
- **AND** it MUST NOT infer completion

#### Scenario: active matching runtime work reports running

- **WHEN** runtime manager has active turn lease, stream lease, or foreground work matching the requested workspace, engine, thread, and turn when available
- **THEN** backend/runtime MUST return `running`
- **AND** it MUST echo the matched scope

#### Scenario: scoped runtime-ended context reports runtime-ended

- **WHEN** runtime manager has a recent runtime-ended context for the same workspace and engine
- **AND** the affected thread/turn scope matches the request
- **THEN** backend/runtime MAY return `runtime-ended`
- **AND** it MUST include a bounded reason and observed timestamp

#### Scenario: unscoped runtime failure remains unknown

- **WHEN** runtime manager has runtime failure or recovery context but cannot match the requested thread/turn
- **THEN** backend/runtime MUST return `unknown`
- **AND** it MUST NOT return `completed` or `runtime-ended` for the active turn

### Requirement: Engine Runtime Cleanup MUST Consume Only Accepted Scoped Settlement Evidence

The lifecycle layer MUST only clear foreground processing residue from accepted scoped settlement evidence. Cleanup is a state transaction applied after arbitration, not a new completion inference mechanism.

#### Scenario: terminal reconciliation evidence can cleanup matching residue

- **WHEN** a status-query response has matched `workspaceId`, `engine`, `threadId`, `turnId` or verified alias, and runtime lease/session when available
- **AND** the status is `runtime-ended`, `failed`, `stalled`, or `completed`
- **AND** three-evidence arbitration returns `cleanup-residue`
- **THEN** the lifecycle layer MAY clear the matching foreground processing residue
- **AND** it MUST NOT mutate message content or synthesize assistant output

#### Scenario: matched terminal event evidence can cleanup without a new query

- **WHEN** lifecycle arbitration already has accepted terminal evidence and accepted state evidence for the matching foreground turn
- **AND** arbitration returns `cleanup-residue`
- **THEN** cleanup MAY proceed without issuing an additional reconciliation query

#### Scenario: non-terminal or uncertain statuses never cleanup

- **WHEN** reconciliation status is `running`, `unknown`, `query-failed`, rejected, missing scope, or stale for the current lifecycle scope
- **THEN** the lifecycle layer MUST NOT clear current foreground processing state
- **AND** it MUST NOT infer completion from the absence of progress

#### Scenario: cleanup does not cross active turn boundaries

- **WHEN** a newer active turn exists for the same workspace, engine, and thread
- **AND** settlement evidence belongs to an older turn or older runtime lease/session
- **THEN** cleanup MUST be denied for the newer active turn
- **AND** the older evidence MAY be recorded as diagnostic-only

#### Scenario: cleanup payloads stay bounded

- **WHEN** the system records cleanup applied or skipped diagnostics
- **THEN** payloads MUST include only scoped ids, decision fields, evidence booleans, scope booleans, bounded reasons, and affected-field booleans
- **AND** payloads MUST NOT include full prompt, assistant output, tool output, stdout, stderr, file diff, auth data, tokens, or secrets
