## ADDED Requirements

### Requirement: Status Query Reconciliation Diagnostics MUST Be Bounded And Distinguishable

Phase 2a reconciliation diagnostics MUST make status-query attempts and outcomes visible without changing runtime or UI behavior.

#### Scenario: query attempt is distinguishable from provider delay

- **WHEN** lifecycle arbitration requests authoritative status because terminal evidence is missing and progress is stale
- **THEN** diagnostics MUST record a bounded reconciliation-query attempt with a label or category distinct from upstream provider delay, render delay, normal long-task protection, and terminal busy residue
- **AND** the diagnostic MUST include scoped ids, status-query source, timestamps, progress age, and decision reason when available

#### Scenario: query result records conservative outcome

- **WHEN** authoritative status query returns `completed`, `running`, `failed`, `stalled`, `runtime-ended`, `unknown`, or `query-failed`
- **THEN** diagnostics MUST record the bounded status enum, scope match result, status source, and bounded reason
- **AND** diagnostics MUST show whether the response was accepted as Terminal Evidence candidate, kept running, rejected as stale, or deferred

#### Scenario: recovery context remains separate

- **WHEN** status reconciliation overlaps with runtime recovery quarantine, concurrent runtime acquire timeout, stale runtime cleanup, or stopping-runtime race
- **THEN** diagnostics MAY include bounded recovery context fields such as recovery state, acquire state, ended source, retry delay, and query failure reason
- **AND** those fields MUST remain separate from terminal status and MUST NOT imply completed settlement

#### Scenario: normal query consistency does not flood error log

- **WHEN** status query confirms a normal running or normally completed state without residue, stale scope, or query failure
- **THEN** the client SHOULD avoid persisting high-volume normal consistency records to the global error log
- **AND** abnormal outcomes such as stale scope, query failure, unknown status, terminal-confirmed busy residue, or rejected scope SHOULD be persistable as bounded core diagnostics

#### Scenario: reconciliation diagnostics exclude content

- **WHEN** reconciliation query diagnostics are persisted or shown in debug entries
- **THEN** they MUST use bounded ids, booleans, counts, timestamps, enum status, and bounded reason strings
- **AND** they MUST NOT include full prompts, assistant responses, tool outputs, command outputs, stdout, stderr, file diffs, auth files, or secret values
