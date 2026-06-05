## ADDED Requirements

### Requirement: Project Map stale reason display
The Project X-Ray panel SHALL display stale reasons and refresh recommendations for Project Map nodes or maps when available.

#### Scenario: Node has stale reason
- **WHEN** a Project Map node is stale with a known reason
- **THEN** the inspector shows the reason and an appropriate refresh recommendation

### Requirement: Project Map repair result display
The Project X-Ray panel SHALL display graph validation and deterministic repair results when validation finds issues.

#### Scenario: Graph repair removes invalid relation
- **WHEN** deterministic repair removes or quarantines an invalid relation
- **THEN** Project Map shows a user-visible repair summary
