# project-map-relations-scan-loading Specification

## Purpose
TBD - created by archiving change add-project-map-relations-scan-loading. Update Purpose after archive.
## Requirements
### Requirement: Relationship scan loading is visible in the main workspace

The Project Map relationship workspace SHALL display a global loading indicator while a relationship scan is running.

#### Scenario: User starts relationship scan
- **WHEN** the user clicks `扫描关系` and the relationship scan status becomes `running`
- **THEN** the relationship main workspace displays a loading overlay with an indeterminate progress bar

#### Scenario: Scan succeeds
- **WHEN** the relationship scan status changes from `running` to `success`
- **THEN** the loading overlay disappears
- **THEN** the relationship graph or dashboard content renders through the existing success path

#### Scenario: Scan fails
- **WHEN** the relationship scan status changes from `running` to `failed`
- **THEN** the loading overlay disappears
- **THEN** the existing failure message remains available

### Requirement: Relationship scan loading is accessible

The relationship scan loading indicator SHALL expose accessible status semantics.

#### Scenario: Loading status announced
- **WHEN** the loading overlay is rendered
- **THEN** it exposes `role="status"` and `aria-live="polite"`

#### Scenario: No false loading state
- **WHEN** the relationship scan status is not `running`
- **THEN** the loading overlay is not rendered

### Requirement: Chrome visibility does not trigger relationship scanning

Project Map chrome collapse and expand actions SHALL NOT trigger relationship scan commands.

#### Scenario: User collapses and expands while file relations are open
- **WHEN** the file relations workspace is open
- **AND** the user collapses the Project Map header chrome
- **AND** the user expands the Project Map header chrome again
- **THEN** the previous relationship scan request is not replayed
- **AND** no new relationship scan starts unless the user explicitly clicks a scan action

#### Scenario: User collapses chrome while file relations are open
- **WHEN** the file relations workspace is open
- **AND** the user collapses the Project Map header chrome
- **THEN** the file relationship workspace remains visible in the main canvas area
- **AND** the base Project Map node graph remains hidden behind the selected file relationship workspace

#### Scenario: Historical scan request exists before remount
- **WHEN** `ProjectMapRelationshipSection` mounts with an existing non-zero relationship scan request id
- **THEN** that existing request id is treated as already observed
- **AND** the section waits for the next request id increment before starting a scan

