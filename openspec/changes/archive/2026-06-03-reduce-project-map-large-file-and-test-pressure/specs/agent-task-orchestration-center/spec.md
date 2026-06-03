# agent-task-orchestration-center Delta Spec

## ADDED Requirements

### Requirement: Orchestration Center Unit Tests SHALL Isolate Runtime Bridges

Orchestration Center component tests SHALL mock Tauri bridge calls when the test assertions do not cover bridge behavior.

#### Scenario: queue UI tests do not load runtime model bridge

- **WHEN** a unit test renders `OrchestrationCenterView` to assert queue, filter, dispatch, review, or source-ref UI behavior
- **THEN** the test SHALL mock model discovery bridge calls such as `getEngineModels`, `getModelList`, and `getConfigModel`
- **AND** the test SHALL NOT import heavy runtime bridge side effects as an incidental dependency

