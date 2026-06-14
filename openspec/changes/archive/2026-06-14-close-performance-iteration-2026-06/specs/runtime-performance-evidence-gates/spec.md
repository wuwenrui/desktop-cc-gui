## ADDED Requirements

### Requirement: Performance Iteration Closure MUST Enforce Unit Consistency

Performance evidence artifacts MUST keep observed metric unit and budget unit consistent for the same metric record. Unit mismatch MUST block archive-readiness for P0/P1 performance changes.

#### Scenario: observed unit differs from budget unit

- **WHEN** `docs/perf/baseline.json` or `docs/perf/runtime-evidence-gates.json` contains a metric with both observed `unit` and `budget.unit`
- **AND** those units differ
- **THEN** `npm run perf:archive-readiness` MUST report `unit-conflict`
- **AND** it MUST exit with hard-fail status
- **AND** the report MUST name the scenario, metric, observed unit, and budget unit

#### Scenario: metric has no budget block

- **WHEN** a metric has observed value/unit but no `budget` block
- **THEN** the readiness gate MUST classify it separately as `budget-missing`
- **AND** it MUST NOT conflate the metric with `unit-conflict`

### Requirement: Performance Iteration Closure MUST Annotate HardFail Records

Performance evidence artifacts MUST annotate every hardFail threshold with rollout or status context. Bare hardFail thresholds MUST block archive-readiness because reviewers cannot distinguish blocking failure, advisory rollout, or tracked residual risk.

#### Scenario: hardFail threshold has no annotation

- **WHEN** a metric record contains `budget.hardFail`
- **AND** the record has no `budget.rollout`, top-level `rollout`, or top-level `status`
- **THEN** `npm run perf:archive-readiness` MUST report a malformed hardFail record
- **AND** it MUST exit with hard-fail status

#### Scenario: observed value breaches hardFail under advisory rollout

- **WHEN** a metric value exceeds `budget.hardFail`
- **AND** the metric carries an advisory rollout such as `advisory` or `advisory-until-bundle-optimization`
- **THEN** the readiness report MUST keep the breach visible as residual risk
- **AND** it MUST NOT report the metric as passed

#### Scenario: proxy realtime threshold waits for runtime trace

- **WHEN** a realtime correlation metric is derived from replay/proxy evidence
- **AND** the metric retains `budget.hardFail`
- **THEN** the metric MUST carry rollout/status context such as `budget.rollout: "advisory-until-runtime-trace"`
- **AND** the readiness report MUST keep the threshold visible as residual risk until measured runtime trace evidence exists
- **AND** the threshold MUST NOT be deleted merely to reduce gate noise

### Requirement: Performance Iteration Closure MUST Reconcile ArchiveReadiness With Current Active Changes

Performance evidence artifacts MUST derive current archive-readiness from current OpenSpec active-change state, not from stale generated history.

#### Scenario: completed active list contains archived changes

- **WHEN** `docs/perf/runtime-evidence-gates.json.archiveReadiness.completed` lists a change name
- **AND** that change name is absent from current `openspec list --json` active changes
- **THEN** `npm run perf:archive-readiness` MUST report the entry as stale
- **AND** it MUST exit with hard-fail status

#### Scenario: archived changes remain available as history

- **WHEN** a previously completed performance change has already been archived
- **THEN** runtime evidence MAY preserve it in history / previous archive context
- **AND** it MUST NOT present that change as a current completed active change

### Requirement: Performance Iteration Closure MUST Own P0/P1 Large-File Debt

Runtime evidence gate artifacts MUST attach owner and follow-up metadata to every P0/P1 large-file candidate that is deferred by a performance iteration.

#### Scenario: P0/P1 candidate lacks owner or followUp

- **WHEN** `docs/perf/runtime-evidence-gates.json.largeFileSummary.candidates[]` contains an entry with `priority` equal to `P0` or `P1`
- **AND** the entry has no `owner` or no `followUp`
- **THEN** `npm run perf:archive-readiness` MUST report ownerless structural debt
- **AND** it MUST exit with hard-fail status

#### Scenario: large-file debt is deferred

- **WHEN** a performance closure defers large-file modularization
- **THEN** the evidence report MUST keep the file path, line count, priority, owner, and follow-up change visible
- **AND** it MUST NOT describe the debt as completed

### Requirement: Performance Iteration Closure MUST Run Archive-Readiness Gate Before Archive

P0/P1 performance changes MUST run the archive-readiness gate before archive. The gate separates task-complete state from evidence-ready state.

#### Scenario: readiness gate passes

- **WHEN** `npm run perf:archive-readiness` exits with status 0
- **THEN** archive MAY proceed after normal OpenSpec validation

#### Scenario: readiness gate has residual warnings only

- **WHEN** `npm run perf:archive-readiness` exits with status 2
- **THEN** archive MAY proceed only if hard failures are zero
- **AND** the residual warnings are recorded in verification or archive notes
- **AND** the residual warnings are not silently converted into synthetic budgets or measured evidence

#### Scenario: readiness gate fails

- **WHEN** `npm run perf:archive-readiness` exits with status 1
- **THEN** archive MUST NOT proceed
- **AND** the listed metadata defects MUST be fixed or explicitly waived in a separate governance decision

## MODIFIED Requirements

### Requirement: Runtime Evidence Gate MUST Produce Archive-Readiness Guidance

The runtime evidence gate MUST produce archive-readiness guidance that separates OpenSpec task completion from evidence readiness. In addition to classifying evidence as `measured`, `proxy`, `manual-only`, or `unsupported`, the guidance MUST evaluate unit consistency, hardFail annotation, current active-change reconciliation, and structural-debt ownership.

#### Scenario: task-complete change has evidence metadata defects

- **WHEN** a performance change's `tasks.md` is fully checked
- **AND** the evidence report has unit conflicts, stale completed-active entries, malformed hardFail records, or P0/P1 large-file candidates without owner/followUp
- **THEN** the change MUST NOT be treated as archive-ready
- **AND** readiness output MUST list the defects by scenario, metric, or file path

#### Scenario: task-complete change has residual unsupported evidence

- **WHEN** a performance change's `tasks.md` is fully checked
- **AND** the evidence report still contains `unsupported` or `proxy` records
- **THEN** the readiness output MUST keep those records visible as residual risk
- **AND** it MUST NOT upgrade the evidence class without a measured source artifact
