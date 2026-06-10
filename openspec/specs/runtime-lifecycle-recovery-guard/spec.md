# runtime-lifecycle-recovery-guard Specification

## Purpose
TBD - created by archiving change harden-client-runtime-environment-recovery. Update Purpose after archive.
## Requirements
### Requirement: Runtime Acquire MUST Be Guarded By Workspace Engine And Generation

系统 MUST guard managed runtime acquire/recovery by `workspaceId + engine + runtime generation` so cleanup, reconnect, and helper reads cannot create concurrent acquire storms.

#### Scenario: automatic acquire sources share one leader

- **WHEN** multiple automatic sources request runtime access for the same workspace and engine
- **THEN** system MUST allow at most one in-flight automatic acquire or recovery leader
- **AND** other automatic callers MUST await that leader, reuse its result, or receive a typed degraded outcome

#### Scenario: stopping runtime is not reused for foreground execution

- **WHEN** a runtime generation is marked `stopping`, `manual-shutdown`, `runtime-ended`, or `stale-reuse-cleanup`
- **THEN** system MUST reject that generation as a foreground execution target
- **AND** user-initiated work MUST start or await a fresh guarded generation

#### Scenario: predecessor diagnostics cannot poison successor generation

- **WHEN** a predecessor runtime generation emits late shutdown or stdout diagnostics after a successor generation exists
- **THEN** diagnostics MUST remain associated with the predecessor generation
- **AND** successor foreground work MUST NOT be failed unless affected work identity matches

### Requirement: Helper Runtime Reads MUST Degrade Without Recovery Storms

model list, account rate limit, history load, thread list, and similar helper reads MUST NOT independently trigger unbounded runtime recovery.

#### Scenario: daemon helper reads use the shared acquire guard

- **WHEN** daemon-mode `model/list` or `account/rateLimits/read` needs a live Codex session for a workspace
- **THEN** the system MUST enter the shared guarded Codex session ensure path before sending the live helper request
- **AND** acquire contention or quarantine MUST be surfaced from the shared runtime recovery guard instead of a separate helper-read recovery path

### Requirement: Passive and helper reads MUST NOT create unbounded runtime acquisition or process growth
The system SHALL keep passive reads and helper reads within guarded runtime acquisition boundaries and SHALL make helper process growth observable.

#### Scenario: passive read does not acquire runtime
- **WHEN** the user passively selects history, views session visibility, opens local metadata, or reads already persisted conversation state
- **THEN** the system MUST NOT acquire a new runtime session unless an explicit runtime-required action is invoked
- **AND** any fallback to local durable history MUST preserve existing runtime acquisition boundaries

#### Scenario: helper read uses shared runtime guard
- **WHEN** model list, account rate limit, thread list, or similar helper read requires a live runtime
- **THEN** the system MUST enter the shared guarded runtime acquisition path
- **AND** acquire contention or quarantine MUST be surfaced from that shared guard instead of a separate helper recovery storm

#### Scenario: helper process growth is diagnosed
- **WHEN** node, codex, claude, or related helper process starts are observable on the platform
- **THEN** the system MUST record bounded process-count or process-start diagnostics by engine and workspace scope
- **AND** unsupported platforms MUST record the metric as unsupported rather than silently omitting it from evidence reports

