## MODIFIED Requirements

### Requirement: Active Foreground Work MUST Receive Runtime-Ended Recovery

Runtime lifecycle diagnostics MUST distinguish idle/internal cleanup from runtime termination that affects active or startup-pending foreground work.

#### Scenario: active foreground work still receives runtime-ended recovery
- **WHEN** a Codex managed runtime ends while active turn, pending request, timed-out request, background callback, or foreground work continuity exists
- **THEN** backend MUST preserve enough identity to emit or surface structured recoverable diagnostics
- **AND** frontend recovery surfaces MUST remain able to offer rebind, fresh continuation, or failed outcome according to the identity recovery contract

#### Scenario: just-started Codex thread protects runtime from idle reconcile
- **WHEN** native Codex `thread/start` returns a valid non-empty thread id
- **AND** first-turn readiness or first send has not settled yet
- **THEN** runtime manager MUST record startup-pending foreground work continuity for that thread
- **AND** pool reconcile MUST NOT treat the runtime as idle/evictable until that foreground continuity is cleared or times out

#### Scenario: invalid thread-start response clears foreground work
- **WHEN** native Codex `thread/start` returns no parseable non-empty thread id
- **THEN** backend MUST reject the create-session response
- **AND** any pending Codex foreground work marker for that create attempt MUST be cleared

### Requirement: Codex Create Session Shutdown Race Retry MUST Stay Bounded Across Entrypoints

Codex create-session entrypoints MUST share stopping-runtime race semantics: reject a runtime that is already ending, perform bounded readiness/reacquire behavior where allowed, and settle persistent races as recoverable create-session errors.

#### Scenario: thread-start readiness confirmation is bounded
- **WHEN** `thread/start` returns a valid thread id
- **AND** immediate readiness confirmation reports `thread not found`
- **THEN** backend MUST retry same-runtime `thread/resume` with a finite delay schedule
- **AND** failure after the schedule MUST return a bounded readiness error
- **AND** backend MUST NOT route readiness confirmation to another provider or create a substitute thread

#### Scenario: thread-start readiness rejects false-ready resume responses
- **WHEN** `thread/start` returns a valid thread id
- **AND** `thread/resume` returns an RPC error other than a retryable missing-thread error
- **OR** `thread/resume` returns a different thread identity than the one being confirmed
- **THEN** backend MUST fail create-session readiness before frontend activation
- **AND** backend MUST NOT treat the response as ready merely because it was not classified as `thread not found`
- **AND** frontend MUST NOT retry by calling create-session again after a post-start readiness failure

#### Scenario: active workspace prewarms disk Codex runtime only
- **WHEN** a workspace is active and connected
- **THEN** the client MAY prewarm the disk/default Codex runtime by asking backend to ensure the workspace Codex app-server session exists
- **AND** the prewarm path MUST NOT call `thread/start` or create an empty Codex conversation
- **AND** the prewarm path MUST NOT prewarm managed provider profiles
- **AND** repeated prewarm attempts for the same active workspace SHOULD be deduped while in flight or after success

#### Scenario: thread-start readiness tolerates rollout-pending resume responses
- **WHEN** `thread/start` returns a valid thread id
- **AND** `thread/resume` returns `no rollout found for thread id` during the bounded readiness window
- **THEN** backend MUST treat the response as retryable not-ready for the same runtime and same thread
- **AND** backend MAY soft-confirm readiness after the bounded retry window if the last failure is rollout-pending
- **AND** frontend MUST NOT create a replacement session for that post-start readiness state
