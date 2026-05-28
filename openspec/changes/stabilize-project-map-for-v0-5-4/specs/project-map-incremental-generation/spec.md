## ADDED Requirements

### Requirement: Project Map structured-output failure visibility
The Project Map worker SHALL treat model output as untrusted and SHALL expose parse or repair failures as visible run failures instead of writing incomplete datasets.

#### Scenario: Malformed output fails closed
- **WHEN** a generation, completion, calibration, or auto-ingestion run receives malformed model output
- **AND** structured-output repair cannot produce a valid Project Map payload
- **THEN** the run SHALL enter a failed state with a diagnostic reason
- **AND** the worker SHALL NOT write partial lenses, partial candidates, or partial manifest data as trusted Project Map knowledge

#### Scenario: Failure diagnostics are visible without blocking review
- **WHEN** a Project Map run fails because output parsing, ownership validation, evidence reading, or persistence fails
- **THEN** the task drawer SHALL expose the failure category and latest diagnostic message
- **AND** existing persisted Project Map data SHALL remain reviewable
