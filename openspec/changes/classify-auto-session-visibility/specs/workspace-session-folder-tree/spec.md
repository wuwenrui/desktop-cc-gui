## ADDED Requirements

### Requirement: Workspace Session Folder Tree SHALL Expose Reserved System-Auto Grouping
The workspace session folder tree SHALL expose `system-auto` sessions through a reserved system-owned grouping that is separate from user-created folders and root rows.

#### Scenario: System-auto group is stable and reserved
- **WHEN** a workspace has one or more `system-auto` sessions
- **THEN** the folder tree SHALL expose a stable reserved group for those sessions
- **AND** user-created folders SHALL NOT be allowed to reuse the reserved system group identity

#### Scenario: System-auto group does not change owner
- **WHEN** a session appears under the reserved system-auto group
- **THEN** the session SHALL retain its true owner workspace and stable session key
- **AND** archive, delete, unarchive, and open actions SHALL route by that true owner

#### Scenario: Empty system-auto group is not noisy
- **WHEN** a workspace has no active `system-auto` sessions
- **THEN** the folder tree SHALL NOT render an empty system-auto group as if user sessions are missing
- **AND** root user sessions SHALL continue to render normally

#### Scenario: User organization cannot move hidden helpers into root
- **WHEN** a session is classified as `hidden`
- **THEN** folder tree projection SHALL NOT expose it as a movable user session
- **AND** existing folder metadata SHALL NOT force it back into root or a user folder
