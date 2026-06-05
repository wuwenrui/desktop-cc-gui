## ADDED Requirements

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
