## ADDED Requirements

### Requirement: Live Edit Preview MAY Gate Main File External Monitoring

The system MAY use the live edit preview opt-in state as an explicit enablement signal for main-window file external-change monitoring, but it MUST NOT treat an opened file alone as user consent for periodic file-content refresh.

#### Scenario: disabled live preview blocks main file monitoring

- **WHEN** live edit preview is disabled
- **AND** the main window has an active workspace file open
- **THEN** the main file view MUST keep external-change monitoring disabled

#### Scenario: enabled live preview permits main file monitoring

- **WHEN** live edit preview is enabled
- **AND** the main window has an active workspace file open
- **THEN** the main file view MAY enable external-change monitoring through the existing file-view synchronization pipeline

