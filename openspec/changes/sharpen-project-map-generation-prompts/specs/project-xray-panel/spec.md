## MODIFIED Requirements

### Requirement: Global AI collection

The system SHALL provide a global collection action that generates the project map framework using AI.

#### Scenario: Global collection uses concise framework prompt

- **WHEN** the user confirms a global Project Map collection request
- **THEN** the worker SHALL build a concise prompt for framework-level map generation
- **AND** the prompt SHALL avoid dumping the full existing profile JSON or every existing node id when a compact summary is enough
- **AND** the prompt SHALL still require strict pure JSON output, double-quoted property names, source-backed facts, and low/unknown confidence when evidence is insufficient

#### Scenario: AI output uses object literal syntax

- **WHEN** the AI returns a JSON-shaped object with unquoted property names, bare string values, or trailing commas
- **THEN** the worker SHALL attempt a bounded repair before failing the run
- **AND** the repair SHALL NOT execute arbitrary JavaScript
- **AND** the repaired payload SHALL still flow through the existing profile/node normalization path

### Requirement: Node-level AI generation

The system SHALL allow AI generation from any map node to complete, correct, or calibrate that node and its subtree.

#### Scenario: Node completion is scoped to the selected node

- **WHEN** the user starts a Complete Node action from a selected Project Map node
- **THEN** the generation request SHALL carry a `completeNode` intent
- **AND** the worker prompt SHALL include the selected node id, title, lens, current summary, confidence, sources, and child summary
- **AND** the prompt SHALL instruct the model to fill missing facts only for the selected node and allowed subtree
- **AND** the prompt SHALL NOT ask the model to rebuild unrelated global or sibling nodes

#### Scenario: Node calibration is scoped to verification

- **WHEN** the user starts a Calibrate Node action from a selected Project Map node
- **THEN** the generation request SHALL carry a `calibrateNode` intent
- **AND** the worker prompt SHALL instruct the model to verify, correct, lower confidence, mark stale/candidate, or improve evidence for the selected node
- **AND** the prompt SHALL treat expansion as secondary to factual correction
- **AND** the prompt SHALL NOT reuse the same task wording as Complete Node

#### Scenario: Legacy node runs remain compatible

- **WHEN** a persisted node generation run lacks an explicit generation intent
- **THEN** the worker SHALL infer a node completion intent from `requestScope.kind === "node"`
- **AND** the run SHALL continue through the existing evidence, AI dispatch, parse, normalize, and scoped merge flow
