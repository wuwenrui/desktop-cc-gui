## MODIFIED Requirements

### Requirement: CI SHALL enforce heavy test noise sentry

The system SHALL provide a CI sentry that runs the heavy regression noise checks on Linux, macOS, and Windows, and fails when repo-owned heavy test noise regresses.

#### Scenario: Repo-owned heavy noise fails the sentry

- **WHEN** the heavy test noise sentry runs in CI
- **THEN** any repo-owned `act(...)` warning, stdout payload leak, or stderr payload leak in the heavy suite SHALL fail the sentry

#### Scenario: Environment-owned warnings stay non-blocking

- **WHEN** the heavy test noise sentry encounters an explicitly allowlisted environment-owned warning
- **THEN** the sentry SHALL report it separately without failing the job

#### Scenario: Noise parser behavior stays testable

- **WHEN** the heavy test noise gate logic changes
- **THEN** parser-level automated tests SHALL validate clean-log acceptance and violation detection before the gate is trusted in CI

#### Scenario: heavy-test-noise artifacts are failure-scoped

- **WHEN** the heavy test noise sentry completes successfully in CI
- **THEN** the sentry SHOULD NOT upload the heavy test noise log artifact
- **AND** successful runs MUST still print the concise summary needed to audit pass status

#### Scenario: failing heavy-test-noise runs keep diagnostics

- **WHEN** the heavy test noise sentry fails in CI
- **THEN** the sentry MUST upload the heavy test noise log artifact for diagnosis
- **AND** the upload condition MUST NOT mask the original failing exit code
