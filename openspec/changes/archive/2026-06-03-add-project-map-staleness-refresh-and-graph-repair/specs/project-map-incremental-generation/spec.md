## ADDED Requirements

### Requirement: Project Map fingerprint refresh classification
Project Map incremental generation SHALL classify source changes before recommending skip, partial refresh, architecture refresh, or full refresh.

#### Scenario: Cosmetic or ignored changes are detected
- **WHEN** changed files are cosmetic or ignored by Project Map policy
- **THEN** Project Map does not require a refresh recommendation

### Requirement: Project Map graph integrity validation
Project Map generation SHALL validate node references, relation endpoints, and evidence references before using graph data for rendering or context packs.

#### Scenario: Relation endpoint is missing
- **WHEN** a relation references a missing source or target node
- **THEN** Project Map reports or removes the invalid relation before using it
