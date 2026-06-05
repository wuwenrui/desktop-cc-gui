## ADDED Requirements

### Requirement: OpenSpec metadata can feed Project Map evidence
The OpenSpec adapter SHALL expose capability and scenario metadata in a form Project Map can use as deterministic evidence.

#### Scenario: Project Map requests OpenSpec evidence
- **WHEN** Project Map builds a Code+Spec relationship from OpenSpec metadata
- **THEN** the relationship includes capability or scenario identity and source location where available
