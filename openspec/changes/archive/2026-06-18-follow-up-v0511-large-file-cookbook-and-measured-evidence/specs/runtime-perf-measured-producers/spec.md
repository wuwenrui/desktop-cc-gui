# Spec Delta: runtime-perf-measured-producers

## Purpose

Move remaining proxy evidence toward measured evidence only when real runtime artifacts support the upgrade.

## ADDED Requirements

### Requirement: Proxy metrics MUST only become measured from real runtime artifacts

Performance evidence producers SHALL mark a metric as `measured` only when the metric is collected from a real dev environment or CI sandbox run and includes `sampleCount` plus `sourceArtifact`.

#### Scenario: Real runtime producer
- **WHEN** a producer reads a real runtime diagnostic artifact
- **THEN** it MAY emit `evidenceClass: "measured"`
- **AND** it SHALL include `sampleCount` and `sourceArtifact`

#### Scenario: Synthetic or fixture producer
- **WHEN** a metric is produced from deterministic fixture input only
- **THEN** it SHALL remain `proxy` or `synthetic`
- **AND** it SHALL NOT be counted as measured evidence

#### Scenario: Malformed diagnostic input
- **WHEN** the source artifact is missing required numeric fields
- **THEN** the producer SHALL ignore it or keep the proxy row
- **AND** tests SHALL cover the rejection path
