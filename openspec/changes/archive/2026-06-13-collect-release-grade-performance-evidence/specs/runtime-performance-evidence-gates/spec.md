## ADDED Requirements

### Requirement: Release-Grade Performance Evidence MUST Use Runtime Measurements

Release-target performance closure MUST distinguish runtime-measured evidence from fixture, replay, jsdom, proxy, and manual-only evidence. A release-grade claim MUST NOT be based only on proxy evidence when a runtime collection path is available.

#### Scenario: release claim uses measured runtime evidence
- **WHEN** a performance report claims release-grade improvement for Tauri cold-start, realtime visible lag, reducer amplification, batch flush duration, terminal settlement, Composer typing, file editor typing, or browser scroll stability
- **THEN** the report MUST mark the scenario as `measured`
- **AND** it MUST include the runtime source artifact, collection environment, metric unit, and collection timestamp

#### Scenario: proxy evidence remains regression-only
- **WHEN** a scenario is backed only by fixture, replay, jsdom, static analysis, or synthetic proxy evidence
- **THEN** the report MUST classify it as `proxy`
- **AND** release archive-readiness MUST list the scenario as residual evidence debt unless the change explicitly scopes it out with a platform qualifier

### Requirement: Tauri Cold-Start Evidence MUST Capture Webview Timing

Release-grade cold-start evidence MUST capture user-visible Tauri/webview timing in addition to bundle size. Bundle size alone MUST NOT satisfy first-paint or first-interactive evidence.

#### Scenario: cold-start runner captures first paint
- **WHEN** the cold-start performance runner launches the desktop app on a supported local or CI platform
- **THEN** it MUST record `S-CS-COLD/firstPaintMs` with `evidenceClass: "measured"`
- **AND** the record MUST include the platform, app version, git commit, source artifact path, unit, and budget status

#### Scenario: cold-start runner captures first interactive
- **WHEN** the cold-start performance runner detects the app can accept primary user input
- **THEN** it MUST record `S-CS-COLD/firstInteractiveMs` with `evidenceClass: "measured"`
- **AND** it MUST NOT infer interactivity only from bundle generation or process start completion

#### Scenario: platform cannot collect webview timing
- **WHEN** a platform cannot expose Tauri/webview first paint or first interactive timing
- **THEN** the evidence artifact MUST keep the metric as `unsupported`
- **AND** it MUST include the platform, failure reason, next action, and release decision qualifier

### Requirement: Realtime Runtime Evidence MUST Replace Replay-Only Closure

Realtime release evidence MUST collect runtime-correlated renderer data for visible lag, reducer amplification, batch flush duration, and terminal settlement. Replay-derived evidence MAY remain as regression baseline but MUST NOT be the only release proof.

#### Scenario: visible lag is measured in runtime
- **WHEN** a realtime streaming fixture runs in the desktop runtime
- **THEN** the evidence report MUST compute visible text lag from assistant text ingress to first visible text growth using correlated runtime milestones
- **AND** it MUST keep prompt text, assistant body, tool output, and terminal output out of the diagnostic payload

#### Scenario: reducer and batch pressure are measured in runtime
- **WHEN** the runtime receives streaming deltas through the batching path
- **THEN** the report MUST record reducer amplification and batch flush duration from runtime counters or timing probes
- **AND** it MUST preserve turn/session/workspace correlation using ids, counts, timings, and bounded status strings only

#### Scenario: terminal settlement is measured in runtime
- **WHEN** a streaming turn reaches provider completion and terminal settlement
- **THEN** the report MUST record terminal settlement timing from runtime milestones
- **AND** it MUST classify missing provider or terminal signals as `unsupported` rather than estimating them from replay data

### Requirement: Release Archive Readiness MUST Fail On Unaccepted Hard Breaches

Release archive-readiness MUST treat hard budget breaches as failures unless the release explicitly records a blocker or rollback decision. Hard breaches MUST NOT be downgraded to ordinary warnings by archive wording.

#### Scenario: hard budget breach blocks release readiness
- **WHEN** a metric value exceeds `budget.hardFail`
- **AND** the metric does not carry an accepted release blocker or rollback decision
- **THEN** the release-grade readiness gate MUST fail
- **AND** the output MUST list the metric, observed value, hardFail value, unit, owner, and next action

#### Scenario: bundle size breach is resolved before archive
- **WHEN** `S-CS-COLD/bundleSizeMain` is included in release evidence
- **THEN** its observed `bytes-gzip` value MUST be less than or equal to `budget.hardFail`
- **AND** if it remains above `budget.hardFail`, the change MUST stay unarchived or record an explicit release blocker

### Requirement: Budget Metadata MUST Have Ownership Or Remain Residual

Budget metadata used by release gates MUST have an owner-approved source. Missing budgets MUST remain residual evidence debt rather than being filled with synthetic thresholds.

#### Scenario: budgeted metric has source and owner
- **WHEN** a metric includes `budget.target` or `budget.hardFail`
- **THEN** the budget metadata MUST include source, owner, unit, and status or rollout annotation
- **AND** archive-readiness MUST be able to identify who owns follow-up when the budget fails or remains advisory

#### Scenario: metric has no approved budget
- **WHEN** a metric has no owner-approved budget threshold
- **THEN** the report MUST classify it as `budget-missing`
- **AND** release readiness MUST list it as residual debt instead of inventing target or hardFail values
