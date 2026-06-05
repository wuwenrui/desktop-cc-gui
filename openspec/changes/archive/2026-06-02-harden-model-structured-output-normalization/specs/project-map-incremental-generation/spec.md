## ADDED Requirements

### Requirement: Project Map uses shared model structured-output normalization

Project Map generation and organizer runs SHALL normalize untrusted model responses through the shared model structured-output path before applying map payloads or organizer candidates.

#### Scenario: Main generation uses shared normalization

- **WHEN** a Project Map generation, completion, calibration, or auto-ingestion run receives model text
- **THEN** the worker MUST parse and validate the response through the shared structured-output normalization path before applying the Project Map payload

#### Scenario: Organizer uses shared normalization

- **WHEN** a Project Map AI organizer run receives model text for parent move suggestions
- **THEN** the organizer MUST parse and validate the response through the shared structured-output normalization path before creating parent-move candidates, skipped records, or unsafe records

#### Scenario: Organizer malformed JSON gets bounded repair

- **WHEN** an organizer response is malformed and initial normalization fails
- **THEN** the organizer MUST request one JSON-only repair attempt using the original organizer prompt and the invalid response
- **AND** it MUST use the repaired payload only if it satisfies the organizer payload validator

#### Scenario: Organizer repair failure remains fail-closed

- **WHEN** both organizer initial normalization and repair normalization fail
- **THEN** the organizer run MUST fail with a visible parse diagnostic
- **AND** the worker MUST NOT write partial organizer candidates or map metadata from the failed response
