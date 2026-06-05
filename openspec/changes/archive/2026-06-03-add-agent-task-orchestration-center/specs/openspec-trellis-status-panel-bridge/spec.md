## ADDED Requirements

### Requirement: Governance Bridge SHALL Remain An Optional Orchestration Provider

The governance bridge SHALL expose OpenSpec, Trellis, scripts, workflows, and agent-rule signals only as optional orchestration providers.

#### Scenario: OpenSpec evidence is optional

- **WHEN** an OpenSpec workspace is detected
- **THEN** the bridge MAY provide provider candidates for related spec work
- **AND** Orchestration Center core SHALL remain usable when OpenSpec is absent

#### Scenario: Trellis evidence is optional

- **WHEN** Trellis task metadata is detected
- **THEN** the bridge MAY provide provider candidates for related workflow tasks
- **AND** Orchestration Center core SHALL remain usable when Trellis is absent

#### Scenario: governance candidate tolerates incomplete artifacts

- **WHEN** governance artifacts are incomplete, malformed, missing optional fields, or unsupported
- **THEN** the candidate SHALL be marked degraded or unknown
- **AND** other providers and core sources SHALL remain available

### Requirement: Orchestration Center SHALL Not Perform Background Governance Sync

The orchestration flow SHALL NOT introduce background synchronization that writes OpenSpec, Trellis, agent-rule, script, or workflow state.

#### Scenario: no automatic checkbox update

- **WHEN** a linked orchestration task or TaskRun changes state
- **THEN** the system SHALL NOT automatically check or uncheck lines in OpenSpec, Trellis, or other provider task files

#### Scenario: explicit governance write remains provider-specific workflow

- **WHEN** user wants to update governance artifacts from orchestration results
- **THEN** the system SHALL require an explicit provider action or separate workflow
- **AND** the action SHALL disclose the provider and files that may be written before writing
