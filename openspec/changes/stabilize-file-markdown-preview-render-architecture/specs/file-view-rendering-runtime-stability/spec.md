## MODIFIED Requirements

### Requirement: Large or high-cost file previews MUST protect runtime responsiveness

The system MUST protect runtime responsiveness when rendering large files or high-cost preview content, and it MUST support bounded degradation instead of unbounded main-thread work.

#### Scenario: first-phase degradation uses static size and line-count thresholds
- **WHEN** the system decides whether a file can stay on a richer preview path
- **THEN** it MUST use deterministic thresholds derived from file size, line count, and the existing `truncated` signal
- **AND** it MUST NOT depend on machine-local timing or device-specific render speed as the primary degradation trigger

#### Scenario: large text preview can degrade instead of blocking indefinitely
- **WHEN** the user opens a text file whose preview cost exceeds the safe rendering budget
- **THEN** the system MUST degrade to a lower-cost readable rendering strategy
- **AND** it MUST NOT block the UI indefinitely while attempting the richest preview

#### Scenario: truncated file bypasses richer preview paths
- **WHEN** the file read result already reports `truncated=true`
- **THEN** the file view MUST bypass richer Markdown, structured, and high-cost highlighted preview paths
- **AND** it MUST converge to the readable low-cost fallback defined by the render profile for that file

#### Scenario: renderer changes do not introduce high-frequency IPC churn
- **WHEN** the user scrolls, hovers, drags, or performs other high-frequency interactions inside the file view
- **THEN** the system MUST NOT introduce new per-interaction Tauri command calls as part of rendering stability handling
- **AND** render-state maintenance MUST remain local to the frontend unless a file content refresh is explicitly required

#### Scenario: external file monitoring does not disturb stable preview by default
- **WHEN** a file preview is open in default reading mode
- **AND** external monitoring detects a clean-buffer disk update
- **THEN** the file view MUST NOT automatically rebuild high-cost preview DOM
- **AND** it MUST preserve the current preview snapshot until the user requests refresh or live preview explicitly advances it
