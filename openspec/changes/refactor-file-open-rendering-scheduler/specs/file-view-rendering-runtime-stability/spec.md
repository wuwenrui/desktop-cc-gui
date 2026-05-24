## MODIFIED Requirements

### Requirement: Large or high-cost file previews MUST protect runtime responsiveness

The system MUST protect runtime responsiveness when rendering large files or high-cost preview content, and it MUST support bounded degradation, viewport projection, or scheduled rendering instead of unbounded main-thread work.

#### Scenario: first-phase degradation uses static size and line-count thresholds
- **WHEN** the system decides whether a file can stay on a richer preview path
- **THEN** it MUST use deterministic thresholds derived from file size, line count, and the existing `truncated` signal
- **AND** it MUST NOT depend on machine-local timing or device-specific render speed as the primary degradation trigger

#### Scenario: large text preview can degrade instead of blocking indefinitely
- **WHEN** the user opens a text file whose preview cost exceeds the safe rendering budget
- **THEN** the system MUST degrade to a lower-cost readable rendering strategy, viewport-bounded rendering, or scheduled progressive rendering
- **AND** it MUST NOT block the UI indefinitely while attempting the richest preview

#### Scenario: truncated file bypasses richer preview paths
- **WHEN** the file read result already reports `truncated=true`
- **THEN** the file view MUST bypass richer Markdown, structured, and high-cost highlighted preview paths
- **AND** it MUST converge to the readable low-cost fallback defined by the render profile for that file

#### Scenario: renderer changes do not introduce high-frequency IPC churn
- **WHEN** the user scrolls, hovers, drags, or performs other high-frequency interactions inside the file view
- **THEN** the system MUST NOT introduce new per-interaction Tauri command calls as part of rendering stability handling
- **AND** render-state maintenance MUST remain local to the frontend unless a file content refresh is explicitly required

#### Scenario: large code preview does not synchronously render all lines
- **WHEN** a large code file is opened in preview mode
- **THEN** the file view MUST use viewport-bounded rows or an equivalent bounded strategy
- **AND** it MUST NOT synchronously split, highlight, and mount the entire document as DOM before first useful paint

#### Scenario: content metrics are not repeatedly recomputed during render
- **WHEN** large file rendering needs byte length, line count, content hash, or line access
- **THEN** those values MUST come from a document snapshot/render model boundary or equivalent memoized source
- **AND** preview components MUST NOT independently repeat full-document split/encode/hash work during ordinary render

#### Scenario: markdown progressive rendering respects foreground pressure
- **WHEN** Markdown preview uses progressive rendering
- **AND** the app is under foreground render pressure from active engine streaming or file interaction
- **THEN** progressive chunks and heavy blocks MUST be scheduled so they do not monopolize the frame budget
- **AND** the already visible preview MUST remain readable and stable

#### Scenario: external file monitoring does not disturb stable preview by default
- **WHEN** a file preview is open in default reading mode
- **AND** external monitoring detects a clean-buffer disk update
- **THEN** the file view MUST NOT automatically rebuild high-cost preview DOM during render pressure
- **AND** it MUST preserve the current preview snapshot until the user requests refresh or live preview explicitly advances it

#### Scenario: secondary preview surfaces follow the same budget
- **WHEN** hover preview or structured preview renders large text/code content
- **THEN** it MUST use the same bounded rendering or deterministic degradation rules as the main file preview
- **AND** it MUST NOT become a separate unbounded full-document rendering path
