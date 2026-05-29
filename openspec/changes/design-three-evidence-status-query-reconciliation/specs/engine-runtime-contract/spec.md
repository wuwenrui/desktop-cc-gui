## ADDED Requirements

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
