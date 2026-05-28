## MODIFIED Requirements

### Requirement: Project memory auto ingestion run lifecycle

The Project Knowledge Map SHALL wire Auto Ingestion settings into the Project Map generation queue rather than using a hidden synchronous write path, and scheduling SHALL be owned by the active workspace lifecycle rather than by the Project Knowledge Map panel mount lifecycle.

#### Scenario: Threshold creates queued auto run
- **GIVEN** Auto Ingestion is enabled
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **WHEN** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use `scope.kind="auto"` and include the consumed message hashes
- **AND** the background task drawer SHALL be able to render the run using the existing run lifecycle

#### Scenario: Hidden Project Map still queues auto run
- **GIVEN** Auto Ingestion is enabled for the active workspace
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **AND** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **AND** the Project Knowledge Map panel is not currently rendered or mounted
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use the existing Auto Ingestion request shape, consumed message hashes, and Project Memory evidence metadata
- **AND** opening the Project Knowledge Map panel later SHALL show the queued, running, completed, or failed run through the existing task drawer

#### Scenario: Interval prevents repeated scans
- **GIVEN** Auto Ingestion is enabled
- **AND** `memoryCursor.lastCheckedAt` is newer than the configured interval window
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT scan Project Memory again
- **AND** the system SHALL NOT enqueue a duplicate auto run

#### Scenario: Existing auto run prevents duplicate queueing
- **GIVEN** an Auto Ingestion run is already pending or running
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT enqueue another Auto Ingestion run

#### Scenario: View lifecycle does not create duplicate scheduler
- **GIVEN** the workspace-level Auto Ingestion scheduler is mounted
- **AND** the Project Knowledge Map panel is also rendered
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL use a single scheduling owner for the active workspace
- **AND** it SHALL NOT enqueue a duplicate auto run because both the app layer and view layer evaluated the same interval window

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

The Project Knowledge Map SHALL keep automatic Project Memory ingestion conservative by default while preserving the advanced evidence-backed apply mode.

#### Scenario: Default candidate mode requires review
- **GIVEN** Auto Ingestion apply mode is `createCandidate`
- **WHEN** an auto run returns generated Project Map nodes or updates
- **THEN** generated updates SHALL remain candidate review items or candidate nodes
- **AND** they SHALL require the existing manual confirm/reject flow before becoming trusted active-map facts

#### Scenario: Advanced apply mode can apply evidence-backed updates
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **WHEN** unprocessed Project Memory reaches the threshold
- **THEN** the system SHALL still enqueue a real auto run
- **AND** updates with sufficient evidence MAY be written into active map lenses through the existing evidence gate
- **AND** weak, unsupported, or memory-only claims SHALL remain candidates rather than being silently trusted

#### Scenario: Auto apply still preserves candidate visibility
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **AND** a generated update cannot satisfy the evidence gate
- **WHEN** the auto run completes
- **THEN** the unsupported update SHALL remain visible as a candidate or rejected candidate result
- **AND** the run SHALL NOT promote the unsupported update into trusted active-map facts

## ADDED Requirements

### Requirement: Project Map stabilization preserves renderer dependency boundary
The Project Knowledge Map stabilization work SHALL preserve the existing in-house SVG/HTML rendering boundary.

#### Scenario: No new graph dependency is introduced
- **WHEN** Project Map stabilization is implemented
- **THEN** the graph SHALL continue using the existing in-house SVG/HTML rendering boundary
- **AND** the implementation SHALL NOT add a third-party graph rendering or graph editing dependency

### Requirement: Project Map generation model fallback
The Project Knowledge Map SHALL keep Codex generation entry available when runtime model catalogs are temporarily unavailable.

#### Scenario: Codex catalog outage still exposes fallback models
- **GIVEN** the selected Project Map generation engine is `codex`
- **AND** runtime engine models, Codex model list, and workspace config do not provide any model option
- **WHEN** Project Map generation options are loaded
- **THEN** the UI SHALL expose fallback Codex model options from the canonical Codex model catalog
- **AND** Project Map SHALL NOT maintain a separate hard-coded Codex fallback model list
