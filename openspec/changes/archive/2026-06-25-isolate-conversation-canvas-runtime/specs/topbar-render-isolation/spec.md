# topbar-render-isolation Specification

## ADDED Requirements

### Requirement: Topbar Session Controls MUST Be Independent From Active Canvas Render Churn

Topbar session tabs and new-session controls MUST stay on the interaction lane and avoid invalidation from center canvas heavy rendering.

#### Scenario: active stream does not rebuild topbar controls

- **WHEN** the active conversation canvas processes repeated realtime render snapshots
- **THEN** `MainHeader`, topbar session tabs, and new-session controls MUST NOT rebuild solely because canvas row projection, Markdown hydration, or virtualization state changed
- **AND** any live indicator consumed by the topbar MUST be a narrow stable value rather than the full canvas state

#### Scenario: new-session button receives immediate feedback

- **WHEN** the user clicks the new-session button while a realtime canvas is active
- **THEN** the button feedback MUST update before canvas-lane heavy rendering resumes
- **AND** diagnostics SHOULD be able to attribute any delay to interaction-lane budget violations rather than canvas semantics
