## ADDED Requirements

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
