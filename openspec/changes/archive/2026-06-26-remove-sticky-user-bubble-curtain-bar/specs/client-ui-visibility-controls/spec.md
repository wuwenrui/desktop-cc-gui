## MODIFIED Requirements

### Requirement: Visibility controls support icon-level hiding
The system SHALL allow supported icon buttons to be hidden independently when their parent panel is visible. The removed `curtain.stickyUserBubble` control SHALL NOT be treated as a supported icon button.

#### Scenario: Hide a single icon button
- **WHEN** user hides one supported icon button from appearance settings
- **THEN** system SHALL remove that icon button from the active client UI
- **AND** system SHALL keep sibling icon buttons visible when their own preference is visible

#### Scenario: Parent panel hidden overrides child icon visibility
- **WHEN** a parent panel is hidden
- **THEN** system SHALL hide all child icon buttons of that panel regardless of each child icon preference

#### Scenario: Child icon preference survives parent panel restore
- **WHEN** user hides a child icon button, hides the parent panel, and later shows the parent panel again
- **THEN** system SHALL keep the child icon button hidden
- **AND** system SHALL show sibling icon buttons that remain visible in preference

#### Scenario: Sticky user bubble is no longer configurable
- **WHEN** user opens the client UI visibility list in basic appearance settings
- **THEN** system SHALL NOT show a `curtain.stickyUserBubble` control
- **AND** the conversation canvas SHALL NOT receive visibility state for a sticky user bubble control

### Requirement: Visibility preference persists safely
The system SHALL persist client UI visibility preference across application restarts and recover safely from invalid stored data.

#### Scenario: Restore saved visibility preference after restart
- **WHEN** user hides supported panels or icon buttons and restarts the app
- **THEN** system SHALL restore the saved visibility preference after startup

#### Scenario: Invalid preference falls back to visible
- **WHEN** persisted visibility preference is missing, malformed, or contains unsupported values
- **THEN** system SHALL ignore invalid fields
- **AND** system SHALL treat affected panels and icon buttons as visible
- **AND** system SHALL keep the main conversation UI usable

#### Scenario: Unknown future keys are ignored
- **WHEN** persisted visibility preference contains unknown panel or icon ids
- **THEN** system SHALL ignore those unknown ids
- **AND** system SHALL continue applying known ids normally

#### Scenario: Legacy sticky user bubble key is ignored
- **WHEN** persisted visibility preference contains legacy `curtain.stickyUserBubble`
- **THEN** system SHALL ignore that key as unsupported
- **AND** system SHALL continue applying remaining known visibility preferences normally
