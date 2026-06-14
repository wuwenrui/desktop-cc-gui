## ADDED Requirements

### Requirement: Desktop Drag Leave MUST Clear Hover Feedback

The desktop drag-drop bridge MUST deliver leave events that allow frontend hover overlays to recover when an external file-system drag exits the app surface or a native WebView boundary before drop.

#### Scenario: external drag leaves workspace drop area before drop

- **GIVEN** an external file or folder drag has activated workspace drop hover feedback
- **WHEN** the drag leaves the app window or a child WebView boundary before a drop occurs
- **THEN** the workspace drop hover feedback MUST clear without requiring app restart
- **AND** the client MUST NOT rely on a subsequent drop event to restore the normal surface

#### Scenario: forwarded leave has no coordinates

- **WHEN** the backend forwards a native drag leave event
- **THEN** the frontend drag-drop payload MAY omit `position`
- **AND** consumers MUST handle `leave` before any hit-test that requires coordinates

#### Scenario: composer drag feedback clears on forwarded leave

- **GIVEN** Composer drag-hover feedback is visible from a forwarded drag enter or over event
- **WHEN** a forwarded drag leave event arrives without coordinates
- **THEN** Composer MUST clear drag-hover feedback
- **AND** no file reference insertion side effect MUST run
