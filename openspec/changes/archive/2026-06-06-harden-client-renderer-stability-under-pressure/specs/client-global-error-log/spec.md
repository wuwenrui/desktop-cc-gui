## ADDED Requirements

### Requirement: Renderer stability diagnostics MUST be classified and capped in the global error log
The global client error log SHALL preserve renderer stability evidence without allowing repeated low-value diagnostics to hide crash evidence.

#### Scenario: renderer stability diagnostic is recorded
- **WHEN** renderer heartbeat miss, process failure, unresponsive state, recovery attempt, or pressure snapshot is recorded
- **THEN** the log entry MUST use a stable renderer diagnostic label
- **AND** the payload MUST be redacted and bounded
- **AND** repeated entries MUST be capped by label and time window

#### Scenario: noisy polling diagnostic repeats
- **WHEN** identical git branch polling failures repeat for the same non-repository workspace path
- **THEN** the global error log MUST dedupe, aggregate, or downgrade the repeated entries
- **AND** renderer crash or pressure diagnostics MUST remain visible in the log timeline
