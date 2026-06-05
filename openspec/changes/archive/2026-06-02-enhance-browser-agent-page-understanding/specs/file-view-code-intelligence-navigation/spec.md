## ADDED Requirements

### Requirement: Browser page-to-code candidates reuse code intelligence navigation
File view code intelligence navigation SHALL provide or expose navigation support for Browser Agent page-to-code candidates so Browser Agent does not duplicate source navigation behavior.

#### Scenario: Browser candidate points to a file
- **WHEN** Browser Snapshot v2 includes a candidate file path
- **THEN** the user SHALL be able to open or inspect that candidate through existing file/code navigation surfaces

#### Scenario: Candidate includes matched source text
- **WHEN** a browser code candidate includes matched text or symbol metadata
- **THEN** code navigation SHALL preserve that reason so the user can understand why the file was suggested

### Requirement: Browser candidates remain explainable
File view code intelligence navigation SHALL treat browser-derived code candidates as explainable suggestions, not guaranteed source ownership.

#### Scenario: Candidate confidence is low
- **WHEN** a browser code candidate has low confidence
- **THEN** the UI or AI context SHALL preserve the low confidence state and SHALL NOT present it as a confirmed file mapping
