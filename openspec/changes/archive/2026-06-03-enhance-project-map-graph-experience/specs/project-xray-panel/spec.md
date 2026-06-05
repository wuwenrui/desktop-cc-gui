# project-xray-panel Delta Spec

## ADDED Requirements

### Requirement: Project Map SHALL Prioritize The Knowledge Canvas

The Project Map surface SHALL present the graph canvas as the primary user focus, with navigation and secondary workflow affordances arranged around it.

#### Scenario: graph canvas is visually primary

- **WHEN** the user opens Project Map with a valid dataset
- **THEN** the graph canvas SHALL be the dominant surface
- **AND** search, tour, path, repair, evidence, and task controls SHALL NOT visually compete as equal primary panels

#### Scenario: graph command bar groups navigation primitives

- **WHEN** search, guided tour, path finder, lens selection, graph health, or task status are available
- **THEN** Project Map SHALL expose them as a compact graph navigation command surface
- **AND** each command SHALL preserve its existing behavior or clearly indicate why it is unavailable

### Requirement: Node Inspector SHALL Explain Understanding, Evidence, Relations, And Actions

The selected node detail area SHALL be structured around the user's graph-understanding workflow.

#### Scenario: selected node explains trust and relation context

- **WHEN** user selects a node
- **THEN** the inspector SHALL show the node summary, key facts, key logic, risk signals, evidence refs, confidence/stale context, incoming/outgoing relations, and bounded actions in a clear hierarchy
- **AND** relation and evidence entries SHOULD remain navigable when existing callbacks support navigation

#### Scenario: dead or future-only actions are not primary

- **WHEN** an action is not wired to a reliable end-to-end behavior
- **THEN** the UI SHALL hide it or render it disabled with an explicit reason
- **AND** the action SHALL NOT be styled as a primary completed workflow

### Requirement: Graph Health And Work Queue SHALL Be Secondary Affordances

Graph repair and Work Queue SHALL remain accessible without dominating the graph experience.

#### Scenario: graph repair is compact by default

- **WHEN** graph integrity issues or repair actions exist
- **THEN** Project Map SHALL summarize them through a compact health affordance
- **AND** detailed repair information SHALL be available on demand

#### Scenario: Work Queue is downgraded

- **WHEN** orchestration or task affordances are available from Project Map
- **THEN** Project Map SHALL present them as secondary actions or compact status
- **AND** unfinished Work Queue controls SHALL NOT dominate the first-screen Project Map experience

### Requirement: Existing Project Map Data Contracts SHALL Remain Compatible

The experience pass SHALL reuse the current Project Map model and utilities unless a later change explicitly expands the schema.

#### Scenario: no schema migration is required

- **WHEN** an existing Project Map dataset is loaded
- **THEN** the redesigned surface SHALL render using the existing nodes, relations, tours, evidence, repair summary, and view state
- **AND** no dataset migration SHALL be required for this change
