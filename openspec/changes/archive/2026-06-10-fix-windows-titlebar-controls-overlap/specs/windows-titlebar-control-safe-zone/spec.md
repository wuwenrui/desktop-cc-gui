## ADDED Requirements

### Requirement: Windows Titlebar Controls MUST Own A Reserved Right-Side Safe Zone

Windows desktop titlebar chrome MUST prevent custom window controls from overlapping floating titlebar actions.

#### Scenario: window controls remain far right

- **WHEN** the app renders on Windows desktop
- **THEN** minimize, maximize/restore, and close controls MUST remain grouped at the far-right titlebar edge
- **AND** that group MUST own a stable reserved width for layout avoidance

#### Scenario: swapped floating sidebar toggle avoids window controls

- **GIVEN** the app is in desktop layout-swapped mode
- **AND** the sidebar is collapsed such that a floating titlebar sidebar restore control is shown on the right side
- **AND** the app renders on Windows desktop
- **WHEN** titlebar controls are laid out
- **THEN** the floating sidebar restore control MUST be offset left of the Windows window controls safe zone
- **AND** it MUST NOT share the same raw right anchor as the window controls group
- **AND** a visible gap MUST remain between the two control groups

#### Scenario: non-Windows titlebar placement remains unchanged

- **WHEN** the app renders on macOS or non-Windows desktop
- **THEN** the Windows reserved right-side safe zone MUST NOT move macOS traffic-light inset handling
- **AND** existing non-Windows floating sidebar toggle placement MUST remain unchanged

#### Scenario: main topbar content does not invade the Windows safe zone

- **WHEN** Windows desktop topbar content is rendered near the right edge
- **THEN** main topbar actions and session tabs MUST continue to respect the window-controls safe zone
- **AND** titlebar overlay controls MUST remain clickable with `no-drag` semantics
