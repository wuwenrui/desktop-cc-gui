## ADDED Requirements

### Requirement: Workspace Session Projection SHALL Apply Automatic Visibility Classification
Workspace session catalog projection SHALL apply automatic session visibility metadata before producing root, folder, Sidebar, Workspace Home, and Session Management active lists.

#### Scenario: Hidden automatic rows are filtered before surface projection
- **WHEN** backend catalog sources return a session classified as `hidden`
- **THEN** shared workspace session projection SHALL exclude it from normal active user-facing membership
- **AND** Sidebar, Workspace Home, and Session Management SHALL NOT re-add it from native engine lists or runtime overlays

#### Scenario: System-auto rows are excluded from root membership
- **WHEN** backend catalog sources return a session classified as `system-auto`
- **THEN** shared workspace session projection SHALL exclude it from root session rows
- **AND** the projection SHALL expose it through the reserved system-auto grouping contract

#### Scenario: Missing metadata preserves existing behavior
- **WHEN** backend catalog sources return a session without automatic visibility metadata
- **THEN** shared workspace session projection SHALL preserve existing membership behavior
- **AND** it SHALL NOT infer hidden status from title text alone

#### Scenario: Compatibility hide signal is normalized
- **WHEN** a Codex background hide signal or equivalent legacy compatibility marker exists for a session
- **THEN** shared workspace session projection SHALL treat the session as hidden automatic metadata
- **AND** all surfaces SHALL consume the normalized classification rather than parsing engine-specific hide events independently
