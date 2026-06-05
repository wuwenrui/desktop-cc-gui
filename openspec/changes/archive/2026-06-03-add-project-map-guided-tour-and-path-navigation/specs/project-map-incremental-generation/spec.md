## ADDED Requirements

### Requirement: Project Map optional tour metadata
Project Map datasets SHALL tolerate optional tour metadata without requiring migration for existing datasets.

#### Scenario: Dataset includes tour steps
- **WHEN** a Project Map dataset includes tour steps
- **THEN** Project Map generation and persistence preserve those steps

#### Scenario: Dataset omits tour steps
- **WHEN** a Project Map dataset omits tour steps
- **THEN** Project Map continues to load and render normally
