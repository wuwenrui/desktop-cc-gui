# realtime-input-render-budget Specification

## ADDED Requirements

### Requirement: Composer And Control Feedback MUST Own An Interaction Budget

Composer typing, command controls, topbar buttons, session tabs, and sidebar clicks MUST retain an interaction-lane render budget while realtime canvas rendering is active.

#### Scenario: Composer typing is not blocked by canvas rendering

- **WHEN** the user types in Composer during an active realtime turn
- **AND** the center canvas is receiving repeated assistant/tool/markdown updates
- **THEN** the typed characters MUST be echoed through local interaction state before non-critical canvas heavy rendering
- **AND** Composer state MUST NOT synchronously depend on full conversation canvas projection

#### Scenario: session creation feedback is not blocked by active canvas stream

- **WHEN** the user clicks create/new-session controls while another realtime conversation is running
- **THEN** the click feedback and disabled/loading state MUST update through the interaction lane
- **AND** canvas-lane work MUST NOT delay the initial visible feedback for the create action

#### Scenario: sidebar and panel clicks remain lane-local

- **WHEN** the user selects a sidebar row, session tab, or right-panel control during active streaming
- **THEN** the selection feedback MUST use lane-local state or narrow selectors
- **AND** it MUST NOT wait for the active canvas to finish heavy Markdown/tool rendering
