## ADDED Requirements

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
