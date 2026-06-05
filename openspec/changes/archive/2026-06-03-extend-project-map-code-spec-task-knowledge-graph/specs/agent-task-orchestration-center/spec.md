## ADDED Requirements

### Requirement: Agent tasks can consume Project Map spec task context
Agent Task Orchestration SHALL be able to consume Project Map context packs that include deterministic spec and task evidence.

#### Scenario: Task context includes Project Map governance evidence
- **WHEN** an agent task is created from a Project Map context pack with spec/task evidence
- **THEN** the task receives that evidence without treating inferred relations as deterministic facts
