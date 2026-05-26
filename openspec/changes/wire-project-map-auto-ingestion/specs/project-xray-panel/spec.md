## ADDED Requirements

### Requirement: Project memory auto ingestion run lifecycle

The Project Knowledge Map SHALL wire Auto Ingestion settings into the Project Map generation queue rather than using a hidden synchronous write path.

#### Scenario: Threshold creates queued auto run
- **GIVEN** Auto Ingestion is enabled
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **WHEN** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use `scope.kind="auto"` and include the consumed message hashes
- **AND** the background task drawer SHALL be able to render the run using the existing run lifecycle

#### Scenario: Interval prevents repeated scans
- **GIVEN** Auto Ingestion is enabled
- **AND** `memoryCursor.lastCheckedAt` is newer than the configured interval window
- **WHEN** the Project Map panel rerenders or remounts
- **THEN** the system SHALL NOT scan Project Memory again
- **AND** the system SHALL NOT enqueue a duplicate auto run

#### Scenario: Existing auto run prevents duplicate queueing
- **GIVEN** an Auto Ingestion run is already pending or running
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT enqueue another Auto Ingestion run

#### Scenario: Successful auto run marks memory processed
- **GIVEN** an Auto Ingestion run was created from unprocessed Project Memory messages
- **WHEN** the run completes successfully
- **THEN** the consumed message hashes SHALL be added to `memoryCursor.processedMessages`
- **AND** `memoryCursor.lastRunId` SHALL reference the completed auto run

#### Scenario: Failed auto run does not mark memory processed
- **GIVEN** an Auto Ingestion run was created from unprocessed Project Memory messages
- **WHEN** the run fails or is cancelled
- **THEN** the consumed message hashes SHALL NOT be added to `memoryCursor.processedMessages`
- **AND** the messages SHALL remain eligible for a later retry after the interval gate allows another scan

### Requirement: Auto Ingestion candidate safety

The Project Knowledge Map SHALL keep automatic Project Memory ingestion conservative by default.

#### Scenario: Default candidate mode requires review
- **GIVEN** Auto Ingestion apply mode is `createCandidate`
- **WHEN** an auto run returns generated Project Map nodes or updates
- **THEN** generated updates SHALL remain candidate review items or candidate nodes
- **AND** they SHALL require the existing manual confirm/reject flow before becoming trusted active-map facts

#### Scenario: Advanced apply mode still performs work
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **WHEN** unprocessed Project Memory reaches the threshold
- **THEN** the system SHALL still enqueue a real auto run
- **AND** weak or memory-only claims SHALL remain candidates rather than being silently trusted

### Requirement: Auto Ingestion enablement configuration

The Project Knowledge Map SHALL require an explicit engine and model selection before Auto Ingestion becomes enabled.

#### Scenario: Enable flow selects engine and model
- **GIVEN** Auto Ingestion is currently disabled
- **WHEN** the user clicks the Auto Ingestion enable control
- **THEN** the system SHALL show engine and model controls before persisting `enabled=true`
- **AND** confirmation SHALL persist the selected `engine` and `model` together with `enabled=true`

#### Scenario: Cancelled enable flow remains disabled
- **GIVEN** Auto Ingestion is currently disabled
- **WHEN** the user opens the enable configuration flow and cancels it
- **THEN** the system SHALL keep `enabled=false`
- **AND** the scheduler SHALL NOT enqueue auto runs from hidden default engine or model values

### Requirement: Auto Ingestion graph reachability

The Project Knowledge Map SHALL preserve a single navigable root topology after automatic ingestion.

#### Scenario: Auto-generated top-level concepts remain reachable
- **GIVEN** an Auto Ingestion run returns a new node whose parent is the existing project root
- **AND** the AI payload does not repeat the existing project root node
- **WHEN** the generated result is merged into the dataset
- **THEN** the new node SHALL keep its parent link to the existing root
- **AND** the existing root SHALL include the new node in its children

#### Scenario: Persisted orphan roots are repaired on read
- **GIVEN** a persisted Project Map snapshot contains non-root nodes with no parent link
- **WHEN** the snapshot is read into the Project Map dataset
- **THEN** those orphan nodes SHALL be attached to the project root
- **AND** the map SHALL remain navigable from the project root

### Requirement: Project Map structured output repair

The Project Knowledge Map worker SHALL keep strict JSON validation while allowing one bounded repair attempt for invalid AI output.

#### Scenario: Non-JSON first response is repaired
- **GIVEN** a Project Map generation run receives an AI response that does not contain a valid JSON payload
- **WHEN** the worker detects the structured output validation failure
- **THEN** the worker SHALL request one JSON-only repair response from the same configured engine and model
- **AND** the run SHALL continue only if the repaired response validates as a Project Map payload

#### Scenario: Repair failure keeps the run failed
- **GIVEN** a Project Map generation run receives invalid structured output
- **AND** the one repair response is also invalid
- **WHEN** validation completes
- **THEN** the run SHALL remain failed
- **AND** no Project Map dataset write or Auto Ingestion processed marker update SHALL be treated as successful

### Requirement: Project Map generation dialog layout

The Project Knowledge Map SHALL render generation configuration dialogs with compact defaults and content-adaptive desktop width.

#### Scenario: Confirmation dialog expands for wide content
- **GIVEN** the Confirm Generation dialog contains long write paths or multiple read source chips
- **WHEN** the dialog is rendered on a desktop-sized viewport
- **THEN** the dialog SHALL keep the existing compact width as its minimum width
- **AND** the dialog SHALL expand when content needs more horizontal room
- **AND** the dialog SHALL remain bounded by the viewport-safe maximum width
- **AND** labels, title text, source chips, and footer actions SHALL NOT be clipped by the dialog edge

#### Scenario: Narrow viewport remains usable
- **GIVEN** the Confirm Generation dialog is rendered on a narrow viewport
- **WHEN** available width is below the desktop layout threshold
- **THEN** the dialog SHALL use a single-column layout
- **AND** long write paths and source chips SHALL wrap or truncate within the dialog instead of forcing page-level horizontal overflow

#### Scenario: Enable dialog keeps inline model refresh action
- **GIVEN** the Auto Ingestion enable dialog is rendered with engine and model controls
- **WHEN** the model refresh action is visible
- **THEN** the refresh action SHALL share the model control row on desktop
- **AND** the layout SHALL avoid a dedicated blank row for the refresh action

### Requirement: Project Map canvas controls collapsed preference

The Project Knowledge Map SHALL keep canvas layout controls compact by default while preserving the user's explicit expanded/collapsed preference.

#### Scenario: Canvas controls default collapsed
- **GIVEN** no canvas controls preference has been stored
- **WHEN** the Project Map graph canvas is rendered
- **THEN** the canvas controls SHALL render as a compact collapsed entry
- **AND** zoom, reset, auto layout, reset layout, and layout preset controls SHALL remain hidden until the user expands the control group

#### Scenario: User preference is restored
- **GIVEN** the user explicitly expands or collapses the canvas controls
- **WHEN** the Project Map panel remounts or reloads
- **THEN** the controls SHALL restore the user's last explicit collapsed/expanded preference
- **AND** that preference SHALL be stored as local UI chrome state rather than Project Map dataset content

#### Scenario: Graph actions do not mutate toolbar preference
- **GIVEN** the user has expanded the canvas controls
- **WHEN** the user zooms, resets the view, runs auto layout, resets layout, changes layout preset, drills into a node, returns to previous view, or returns to overview
- **THEN** the canvas controls SHALL remain expanded
- **AND** those graph actions SHALL NOT overwrite the stored collapsed/expanded preference
