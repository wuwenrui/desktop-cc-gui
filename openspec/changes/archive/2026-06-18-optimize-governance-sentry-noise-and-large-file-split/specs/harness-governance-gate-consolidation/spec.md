## MODIFIED Requirements

### Requirement: Advisory Gates MUST NOT Block Release Alone

Heavy-test-noise sentry results and large-file near-threshold watchlist results MUST be treated as advisory unless they represent repo-owned noise gate failure or hard large-file debt. Advisory contributions MUST remain visible without becoming the only release-blocking reason.

#### Scenario: near-threshold large-file alone never blocks release

- **WHEN** large-file near-threshold is the only gate reporting an issue
- **THEN** the consolidated status MUST NOT be `fail`
- **AND** the evidence MUST remain visible as advisory watch output

#### Scenario: hard large-file debt remains blocking

- **WHEN** large-file hard-debt gate reports new or regressed fail-threshold debt
- **THEN** the consolidated status MAY be `fail`
- **AND** the decision MUST cite the hard-debt source separately from near-threshold advisory watch output

#### Scenario: heavy-test-noise failure remains distinct from artifact availability

- **WHEN** heavy-test-noise fails because of repo-owned act/stdout/stderr noise
- **THEN** the consolidated status MAY be `fail`
- **AND** missing success-path log artifacts MUST NOT be interpreted as a failed heavy-test-noise gate
