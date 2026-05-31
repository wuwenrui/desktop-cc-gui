## ADDED Requirements

### Requirement: Project Map Automatic Sessions SHALL Declare Visibility By Purpose
Project Map AI sessions SHALL declare automatic session visibility according to whether they are traceable generation runs or pure internal helper runs.

#### Scenario: Project Map generation is system-auto
- **WHEN** Project Map global generation, node completion, calibration, or auto-ingestion creates a new session or thread
- **THEN** the session SHALL be classified with `sessionPurpose=project-map-generation`
- **AND** the session SHALL use `visibility=system-auto`

#### Scenario: Project Map organizer is hidden
- **WHEN** Project Map organizer creates a new session or sync engine helper to propose parent moves
- **THEN** the session SHALL be classified with `sessionPurpose=project-map-organizer`
- **AND** the session SHALL use `visibility=hidden`

#### Scenario: Project Map task history remains traceable
- **WHEN** a Project Map system-auto generation run completes, fails, or is archived
- **THEN** run metadata SHALL preserve enough thread/session reference for audit or recovery
- **AND** the session SHALL NOT appear at workspace root
