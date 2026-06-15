## ADDED Requirements

### Requirement: AppShell file surfaces MUST use narrow runtime boundaries

AppShell and layout composition MUST pass file surfaces narrow, typed signals rather than broad realtime or workspace projection objects.

#### Scenario: file surface does not receive thread status map

- **WHEN** AppShell composes the main file view, detached file explorer, or editor split file surface
- **THEN** those file surfaces MUST NOT receive the whole `threadStatusById` map
- **AND** any engine-processing awareness MUST be represented as a narrow typed pressure signal

#### Scenario: layout recomputation isolates realtime status churn

- **WHEN** realtime status changes for non-file conversation rows
- **THEN** layout node construction for file surfaces MUST avoid recomputing file-specific props that are unrelated to the pressure signal
- **AND** file editor input state MUST remain owned by the file session boundary

#### Scenario: Sidebar aggregation does not leak into file props

- **WHEN** Sidebar or WorktreeSection derives running session indicators from realtime status
- **THEN** those derived values MUST remain sidebar/workspace UI concerns
- **AND** they MUST NOT be passed through to file view props except as an explicit narrow signal documented by the file render contract
