## ADDED Requirements

### Requirement: Project Map Nodes SHALL Create Orchestration Task Drafts

Project Map SHALL allow users to create orchestration task drafts from map nodes without automatically starting agent execution.

#### Scenario: create task draft from selected node

- **WHEN** user triggers create-task from a Project Map node
- **THEN** the system SHALL create an orchestration task draft
- **AND** the draft SHALL reference the selected node id and node label
- **AND** execution SHALL NOT start until user confirms dispatch in Orchestration Center

#### Scenario: node evidence is carried into task draft

- **WHEN** a Project Map node has source files, specs, commits, tests, conversations, or other evidence refs
- **THEN** the task draft SHALL include those evidence refs where available
- **AND** missing evidence SHALL be represented as unavailable rather than invented

#### Scenario: stale or uncertain node creates risk-marked task

- **WHEN** a Project Map node is stale, candidate-only, low-confidence, or unknown-confidence
- **THEN** the created task draft SHALL expose that risk marker
- **AND** Orchestration Center SHALL require user review before marking the task ready

### Requirement: Project Map SHALL Link Back From Orchestration Tasks

Project Map SHALL support navigation from orchestration task details back to the source node when the node is still available.

#### Scenario: task opens source node

- **WHEN** user opens a Project Map source reference from an orchestration task
- **THEN** the system SHALL open the Project Map panel focused on the referenced node when it exists
- **AND** if the node no longer exists, the system SHALL show an explainable missing-source state

### Requirement: Project Map Work Queue SHALL Not Re-Own Graph Capability Expansion

Project Map graph primitives borrowed from Understand-Anything SHALL remain scoped to the dedicated Project Map changes, not this orchestration change.

#### Scenario: graph navigation capabilities are already covered by Project Map changes

- **WHEN** relation graph, guided tour, path finder, impact overlay, Evidence Files, staleness repair, or graph-focused tests are discussed
- **THEN** this orchestration change SHALL refer to the completed Project Map changes as dependencies
- **AND** this change SHALL only specify the execution bridge from Project Map evidence/candidates into OrchestrationTask, TaskRun, and review gate
