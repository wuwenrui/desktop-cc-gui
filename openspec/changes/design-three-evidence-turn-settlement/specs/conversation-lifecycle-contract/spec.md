## ADDED Requirements

### Requirement: Turn Settlement MUST Use Three-Evidence Lifecycle Arbitration

The system MUST evaluate foreground turn settlement through a shared conversation lifecycle arbitration model that combines terminal evidence, state evidence, and progress evidence across all supported engines.

#### Scenario: lifecycle arbitration uses a pure decision helper before side effects

- **WHEN** lifecycle arbitration evaluates whether to settle, reject, defer, keep running, request reconciliation, or clean up busy residue
- **THEN** it MUST first call a pure decision helper with explicit evidence, policy, and caller-provided current time
- **AND** the helper MUST return a decision reason, scope match result, accepted evidence classes, reconciliation status, and bounded diagnostics
- **AND** the helper MUST NOT mutate conversation state, call backend or Tauri APIs, read frontend stores directly, write debug logs, or read wall-clock time by itself

#### Scenario: side effects happen only after decision interpretation

- **WHEN** the pure decision helper returns a settlement, reconciliation, or cleanup decision
- **THEN** the caller MAY perform guarded side effects according to the active rollout phase and policy
- **AND** the side-effecting caller MUST preserve the helper's decision reason and scope match result in diagnostics when recording the outcome

#### Scenario: normal completion path is not immediately replaced

- **WHEN** Phase 2 guard observation is enabled
- **THEN** existing normal terminal handlers MAY continue to append messages, update history, and finish streaming through the current path
- **AND** three-evidence arbitration MUST observe and diagnose normal settlement consistency without blocking or replacing that path

#### Scenario: terminal evidence is required for automatic completed settlement

- **WHEN** a foreground turn is still marked processing
- **AND** the system has no authoritative terminal evidence such as `turn/completed`, `turn/error`, `turn/stalled`, `runtime/ended`, user stop, status-query-confirmed terminal, replayed terminal, or equivalent normalized engine signal
- **THEN** lifecycle arbitration MUST NOT settle the turn as completed solely from elapsed time, frontend silence, visible text, or history presence
- **AND** the turn MAY enter suspected, degraded, recoverable stalled, or reconciliation-needed state according to existing lifecycle contracts

#### Scenario: matched terminal evidence can settle active state

- **WHEN** authoritative terminal evidence is correlated to the current workspace, engine, thread, active turn identity or a verified alias, and current runtime session or lease when available
- **THEN** lifecycle arbitration MAY clear processing state and the matching active turn marker according to the active rollout phase
- **AND** the settlement record MUST preserve the terminal source, engine, workspace id, thread id, turn id, runtime session or lease id when available, and decision reason

#### Scenario: mismatched terminal evidence is rejected, not force-applied

- **WHEN** terminal evidence reaches the client
- **AND** the evidence cannot be bound to the current active workspace, engine, thread, active turn identity, verified alias, or active runtime lease when available
- **THEN** lifecycle arbitration MUST reject or defer that settlement
- **AND** it MUST NOT clear unrelated processing state
- **AND** diagnostics MUST include incoming scope, current active scope, and reason when available

#### Scenario: evidence without conversation scope is diagnostic-only

- **WHEN** terminal, state, progress, status-query, or replay evidence lacks the minimum conversation scope required to identify workspace, engine, thread, and active turn or verified alias
- **THEN** lifecycle arbitration MUST treat that evidence as diagnostic-only
- **AND** it MUST NOT clear processing state, replace active turn identity, or settle the visible foreground turn

#### Scenario: stale session evidence cannot settle a newer turn

- **WHEN** evidence belongs to the same thread but an older turn, older runtime session, older lease, or previous foreground ownership
- **AND** the current lifecycle state points at a newer active turn or newer active runtime lease
- **THEN** lifecycle arbitration MUST reject or defer the stale evidence for current-state settlement
- **AND** it MUST NOT clear the newer active turn or foreground processing state

#### Scenario: foreground and background conversations remain isolated

- **WHEN** background conversation evidence reaches the client while a different foreground conversation is active
- **THEN** lifecycle arbitration MAY update diagnostics or background state for the matching conversation scope
- **AND** it MUST NOT settle, stop, or mark completed the unrelated foreground conversation

#### Scenario: fresh progress evidence protects long-running work

- **WHEN** a foreground turn remains processing without terminal evidence
- **AND** correlated progress evidence remains fresh, including heartbeat, active status, tool activity, file change, approval, user-input request, token usage, stream delta, or equivalent runtime activity
- **THEN** lifecycle arbitration MUST treat the turn as still plausibly active
- **AND** it MUST NOT classify the turn as stuck solely from elapsed wall time

#### Scenario: terminal handling leaves busy residue

- **WHEN** terminal evidence is accepted or handled for a foreground turn
- **AND** state evidence still shows `isProcessing`, the same `activeTurnId`, or equivalent blocker residue after handling
- **THEN** lifecycle arbitration MUST classify the condition as busy residue
- **AND** the first rollout stage MUST record dry-run or diagnostic evidence before enabling any guarded cleanup behavior

### Requirement: Missing Terminal Evidence MUST Use Authoritative Reconciliation

When frontend lifecycle state remains busy but no terminal evidence is available, the system MUST use authoritative backend or runtime reconciliation before treating the turn as terminal.

#### Scenario: stale progress requests reconciliation instead of completed settlement

- **WHEN** a foreground turn is busy
- **AND** terminal evidence is absent
- **AND** correlated progress evidence is stale or absent
- **THEN** lifecycle arbitration MUST request authoritative reconciliation or enter a degraded/reconnect state
- **AND** it MUST NOT mark the turn completed from timeout, silence, visible content, or history presence

#### Scenario: status query confirmed terminal becomes terminal evidence

- **WHEN** a scoped backend or runtime status query confirms `completed`, `error`, `stalled`, or `runtime-ended` for the same workspace, engine, thread, turn or verified alias, and runtime lease when available
- **THEN** lifecycle arbitration MAY treat that result as Terminal Evidence
- **AND** the result MUST be re-evaluated through the same scope gate and three-evidence helper before any state cleanup occurs

#### Scenario: status query says running keeps the turn active

- **WHEN** a scoped backend or runtime status query reports that the turn or runtime lease is still running or active
- **THEN** lifecycle arbitration MUST keep the foreground turn running
- **AND** it MUST NOT clear `isProcessing`, `activeTurnId`, or blocker residue as completed settlement

#### Scenario: unknown or failed reconciliation is degraded, not completed

- **WHEN** reconciliation returns `unknown`, lacks sufficient scope, fails, or times out
- **THEN** lifecycle arbitration MUST defer settlement or enter a degraded/reconnect path
- **AND** it MUST NOT classify the turn as completed

#### Scenario: replayed terminal events must remain scoped

- **WHEN** the client requests missed terminal replay
- **AND** the replay returns a terminal event with matching workspace, engine, thread, turn or verified alias, and runtime lease when available
- **THEN** lifecycle arbitration MAY treat the replayed event as Terminal Evidence
- **AND** unscoped, stale, or mismatched replayed events MUST remain diagnostic-only

### Requirement: Three-Evidence Settlement MUST Be Cross-Engine And Content-Safe

Three-evidence settlement MUST apply consistently to Claude, Codex, Gemini, and OpenCode while avoiding full conversation content in evidence records.

#### Scenario: all engines use the same arbitration semantics

- **WHEN** equivalent terminal, state, progress, and reconciliation evidence is observed for Claude, Codex, Gemini, or OpenCode
- **THEN** lifecycle arbitration MUST produce equivalent settlement, rejection, deferral, keep-running, reconciliation, or residue decisions
- **AND** engine-specific differences MUST remain inside evidence normalization or adapter layers

#### Scenario: evidence records exclude full content

- **WHEN** settlement evidence is recorded for diagnostics, dry-run analysis, error-log persistence, reconciliation, replay, or tests
- **THEN** the evidence MUST use ids, event names, counts, booleans, timestamps, bounded reason strings, and status enums
- **AND** it MUST NOT include full user prompts, assistant responses, tool outputs, command outputs, file diffs, auth files, or secret values
