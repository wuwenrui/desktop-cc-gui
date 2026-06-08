## ADDED Requirements

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
