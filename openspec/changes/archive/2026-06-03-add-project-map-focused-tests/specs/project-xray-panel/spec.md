## ADDED Requirements

### Requirement: Project Map SHALL Maintain Focused Regression Coverage For Core Derived Behavior

Project Map core derived projections SHALL have focused regression coverage so navigation, evidence, relation, impact, governance, freshness, and graph integrity behavior remains stable across future changes.

#### Scenario: navigation utilities have deterministic coverage

- **WHEN** Project Map navigation utilities are changed
- **THEN** focused tests SHALL cover guided tour generation, node search, shortest path, hierarchy fallback, and no-path results

#### Scenario: impact and governance projections have evidence coverage

- **WHEN** Project Map impact or governance graph utilities are changed
- **THEN** focused tests SHALL cover changed-file impact matching, no-impact fallback, OpenSpec metadata extraction, Trellis task metadata extraction, and Agent Task context source refs

#### Scenario: freshness and integrity helpers cover degraded states

- **WHEN** Project Map freshness or graph integrity utilities are changed
- **THEN** focused tests SHALL cover stale reasons, missing evidence, missing relation endpoints, duplicate relation ids, and repair summaries

#### Scenario: persistence normalization covers legacy relation data

- **WHEN** Project Map relation persistence or normalization is changed
- **THEN** focused tests SHALL cover relation payload roundtrip and legacy datasets without relation payloads where practical

#### Scenario: tests use portable compact fixtures

- **WHEN** Project Map focused tests create dataset fixtures
- **THEN** fixtures SHALL use compact representative nodes and workspace-relative paths
- **AND** fixtures SHALL NOT rely on user-local absolute paths
