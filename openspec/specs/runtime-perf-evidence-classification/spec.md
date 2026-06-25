# runtime-perf-evidence-classification Specification

## Purpose
TBD - created by archiving change refactor-v0511-thread-messaging-recovery-and-streaming. Update Purpose after archive.
## Requirements
### Requirement: Evidence MUST be classified into one of three classes

Each metric in `docs/perf/v0511-runtime-evidence.json` and its same-version successors SHALL carry an `evidenceClass` field with one of the values: `proxy`, `synthetic`, `measured`.

#### Scenario: Proxy evidence
- **WHEN** a metric is computed from a synthetic fixture (e.g., 1000-delta burst) without driving a real environment
- **THEN** `evidenceClass` SHALL be `proxy`

#### Scenario: Synthetic evidence
- **WHEN** a metric is derived from a synthetic input trace replayed against production code paths
- **THEN** `evidenceClass` SHALL be `synthetic`

#### Scenario: Measured evidence
- **WHEN** a metric is collected from a real dev environment or CI sandbox run on a real codebase
- **THEN** `evidenceClass` SHALL be `measured`
- **AND** the metric SHALL be accompanied by `sampleCount` and `sourceArtifact` fields

### Requirement: proxyRatio MUST be computed and reported

`scripts/perf-v0511-runtime-evidence.ts` SHALL compute `proxyRatio = proxy / (proxy + measured + synthetic)` and include it in the produced evidence report.

#### Scenario: proxyRatio above threshold triggers warning in v0.5.11
- **WHEN** `proxyRatio > 0.5`
- **THEN** `scripts/perf-archive-readiness.mjs` SHALL add `{ code: "proxy-ratio-too-high", ratio }` to `warnings`
- **AND** it SHALL NOT add `proxy-ratio-too-high` to `hardFailures` in this change

#### Scenario: Future hard failure promotion
- **WHEN** a later change promotes `proxyRatio > 0.5` from warn to hard failure
- **THEN** that change SHALL update both the OpenSpec contract and `scripts/perf-archive-readiness.mjs` in the same implementation

### Requirement: PR check MUST run perf:archive-readiness

`.github/workflows/perf-archive-readiness.yml` SHALL run `npm run perf:archive-readiness -- --json` on every pull request, posting the result as a PR comment, unless the PR carries the `no-perf-required` label.

#### Scenario: PR without perf label
- **WHEN** a pull request is opened or updated
- **AND** the `no-perf-required` label is absent
- **THEN** the workflow SHALL run perf:archive-readiness and post a comment with `ok`, `proxyRatio`, `warnings`, and `hardFailures`

#### Scenario: PR with no-perf-required label
- **WHEN** a pull request carries the `no-perf-required` label
- **THEN** the workflow SHALL skip the perf step
- **AND** SHALL post a `notApplicable` comment instead
