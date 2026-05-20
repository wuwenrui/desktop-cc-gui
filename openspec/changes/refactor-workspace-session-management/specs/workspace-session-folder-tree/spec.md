## ADDED Requirements

### Requirement: Session Folder Tree SHALL Participate In Management Navigation

The project session folder tree MUST be usable from the Session Management hierarchy as an organization and filtering surface.

#### Scenario: folder appears under selected project
- **WHEN** a project has persisted session folders
- **THEN** the Session Management left hierarchy SHOULD render those folders under the project/worktree scope
- **AND** folder rows MUST remain scoped to their owner workspace

#### Scenario: folder cleanup follows delete cleanup
- **WHEN** a session is physically deleted or cleaned as already missing
- **THEN** any folder assignment metadata for that session MUST be removed
- **AND** the folder itself MUST remain unless explicitly deleted

#### Scenario: missing session does not make folder non-empty forever
- **GIVEN** a folder only contains assignments to sessions missing on disk
- **WHEN** those missing assignments are cleaned
- **THEN** the folder SHOULD become deletable if it has no child folders or live session assignments
