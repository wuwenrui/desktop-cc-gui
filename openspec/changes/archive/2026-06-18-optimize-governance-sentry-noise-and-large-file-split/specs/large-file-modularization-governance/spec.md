## MODIFIED Requirements

### Requirement: Large-File Regression Sentry

The system SHALL provide CI sentry checks that enforce domain-aware hard gates and baseline-aware debt growth controls, while keeping near-threshold watch output visible for triage.

#### Scenario: Hard gate for new oversized debt

- **WHEN** a pull request introduces a new file whose line count exceeds the matched policy fail threshold
- **THEN** CI sentry MUST fail the check
- **AND** remediation guidance MUST be shown in logs

#### Scenario: Hard gate for growing legacy debt

- **WHEN** a file already tracked in the baseline exceeds the matched policy fail threshold and its current line count is greater than the baseline line count
- **THEN** CI sentry MUST fail the check
- **AND** the failure output MUST show both the baseline line count and the current line count

#### Scenario: near-threshold watch stays advisory in high-frequency CI

- **WHEN** large-file governance runs for pull_request or push events
- **THEN** the blocking job MUST run parser tests and the hard-debt gate
- **AND** near-threshold watch output MUST NOT be required for the pull_request or push job to pass
- **AND** near-threshold watch MUST remain available through manual or scheduled advisory execution

#### Scenario: large-file sentry hard gate remains cross-platform

- **WHEN** large-file hard-debt governance checks run in CI
- **THEN** parser tests and hard-debt gate MUST run on ubuntu-latest, macos-latest, and windows-latest
- **AND** file matching and path output MUST remain platform-neutral

#### Scenario: advisory watch artifact remains inspectable

- **WHEN** the advisory near-threshold watch is run manually or by schedule
- **THEN** it MUST produce the same near-threshold JSON artifact shape used by governance evidence readers
- **AND** it MUST NOT change hard-debt gate pass/fail semantics
