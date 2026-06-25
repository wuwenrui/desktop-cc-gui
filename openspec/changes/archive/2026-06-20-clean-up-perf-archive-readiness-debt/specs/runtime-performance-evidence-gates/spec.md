## ADDED Requirements

### Requirement: Archive Readiness Debt Cleanup MUST Close Known Residual Budgets

The performance archive-readiness gate MUST provide a closure path for known `budget-missing` residual records without inventing synthetic thresholds. A metric MAY stop appearing in `BUDGET_RESIDUALS` only after the evidence artifacts include an owner-approved budget block or an explicit measured-evidence prerequisite that keeps the residual visible through another audited check.

#### Scenario: known residual metric gains owner-approved budget

- **WHEN** a known residual metric such as `S-LL-200/commitDurationP50`, `S-CI-50/compositionToCommit`, `S-RS-PE/assemblerLatency`, or `S-CS-COLD/firstPaintMs` gains a `budget` block in `docs/perf/baseline.json`
- **THEN** the budget block MUST include `target` or `hardFail`, `unit`, `owner`, `source`, and `status` or `rollout`
- **AND** `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` MUST NOT contain that metric
- **AND** `npm run perf:archive-readiness -- --json` MUST NOT report that metric as `budget-missing`

#### Scenario: known residual metric is not yet budgetable

- **WHEN** a known residual metric cannot receive an owner-approved budget because runtime evidence is missing or platform support is incomplete
- **THEN** the readiness artifacts MUST keep the metric visible with owner, source, reason, and next action
- **AND** the implementation MUST NOT delete the residual entry solely to reduce warning count
- **AND** the readiness report MUST keep a non-passing status until the residual is budgeted or explicitly accepted by a governance decision

#### Scenario: residual table stays synchronized with baseline budgets

- **WHEN** parser tests load `docs/perf/baseline.json` and `scripts/perf-archive-readiness.mjs`
- **THEN** the tests MUST fail if any metric with an actual budget block remains listed in `BUDGET_RESIDUALS`
- **AND** the tests MUST fail if a residual entry lacks owner and next-action guidance

### Requirement: Proxy Evidence Debt MUST Be Reduced Or Explicitly Accepted Without Relaxing Gate Semantics

The archive-readiness gate MUST keep proxy evidence pressure visible until the evidence mix is upgraded to measured runtime evidence or explicitly accepted as release debt. The implementation MUST NOT raise `PROXY_RATIO_WARN_THRESHOLD`, remove the proxy-ratio rule, or relabel proxy records as measured without a runtime source artifact.

#### Scenario: proxy ratio exceeds threshold without accepted disposition

- **WHEN** `npm run perf:archive-readiness -- --json` computes `proxyRatio` above `PROXY_RATIO_WARN_THRESHOLD`
- **AND** no accepted proxy evidence disposition is present for normal-mode readiness
- **THEN** the report MUST emit `proxy-ratio-too-high`
- **AND** the warning MUST include measured, proxy, synthetic, unsupported, and manual-only counts
- **AND** the warning MUST include owner and next action

#### Scenario: proxy metric is upgraded to measured

- **WHEN** a proxy metric is upgraded to `evidenceClass: "measured"`
- **THEN** the record MUST point to a runtime source artifact that produced the measurement
- **AND** the readiness evidence summary MUST reflect the new measured count
- **AND** the change MUST NOT alter the metric's unit or budget metadata unless the budget source also changes

#### Scenario: remaining proxy evidence is accepted debt

- **WHEN** proxy evidence remains after the cleanup
- **THEN** the readiness artifacts MUST identify the owner, reason, release decision, and next action for the remaining proxy records
- **AND** normal-mode readiness MAY report `status=pass` only when that accepted disposition is present and complete
- **AND** release-mode readiness MUST continue to apply stricter release evidence rules

### Requirement: Unsupported Runtime Evidence MUST Have Explicit Disposition

Runtime evidence records with `evidenceClass: "unsupported"` MUST resolve to measured evidence or an explicit unsupported disposition before the archive-readiness gate reports a clean normal-mode pass.

#### Scenario: cold-start unsupported evidence is resolved

- **WHEN** `S-CS-COLD/firstPaintMs` or `S-CS-COLD/firstInteractiveMs` appears in runtime evidence
- **THEN** the record MUST be measured from a cold-start runtime artifact or carry an explicit unsupported disposition with platform qualifier, owner, reason, release decision, and next action
- **AND** the readiness report MUST NOT silently drop the record from unsupported summaries

#### Scenario: long-running runtime unsupported evidence is resolved

- **WHEN** long-running runtime metrics such as `S-LR-101/sampledOsChildLivenessAfterClose` or `S-LR-200/moduleSwitchP95Ms` remain unsupported
- **THEN** the record MUST include owner, platform qualifier, reason, release decision, and next action
- **AND** release mode MUST still treat unsupported release-required records according to the stricter release evidence rules

#### Scenario: unsupported disposition keeps audit truthfulness

- **WHEN** an unsupported record has an accepted disposition
- **THEN** the readiness output MUST distinguish accepted unsupported debt from measured pass
- **AND** the output MUST preserve enough metadata for reviewers to identify the owner and follow-up path
