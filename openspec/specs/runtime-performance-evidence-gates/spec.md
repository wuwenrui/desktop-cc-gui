# runtime-performance-evidence-gates Specification

## Purpose

Defines governance for runtime performance evidence gates. The spec requires every performance and stability closure claim to declare its evidence class (`measured`, `proxy`, `manual-only`, or `unsupported`), preserve platform qualifiers, keep archive-readiness explicit, and avoid treating proxy or registry-only evidence as release-grade measured proof.
## Requirements
### Requirement: Runtime Evidence Gate MUST Classify Closure Evidence

The system MUST classify performance and stability closure evidence before declaring a runtime optimization or stability change ready for archive.

#### Scenario: report classifies evidence source
- **WHEN** runtime performance evidence is generated
- **THEN** each scenario MUST be classified as `measured`, `proxy`, `unsupported`, or `manual-only`
- **AND** the report MUST include a short reason for that classification

#### Scenario: proxy evidence does not become release-grade proof
- **WHEN** a scenario is backed only by fixture, jsdom, static, or proxy evidence
- **THEN** the report MUST NOT describe the scenario as fully measured
- **AND** the report MUST include the next evidence action needed for release-grade closure

### Requirement: Runtime Evidence Gate MUST Preserve Platform Qualifiers

The system MUST preserve local, skipped, unsupported, and platform-specific qualifiers in generated closure reports.

#### Scenario: missing Windows evidence remains visible
- **WHEN** local validation lacks Windows execution
- **THEN** generated reports MUST keep Windows evidence as missing or unsupported
- **AND** the reports MUST NOT mark Windows as passed by inference from macOS or Linux evidence

#### Scenario: unsupported webview timing remains explicit
- **WHEN** cold-start webview timing cannot be collected in the current environment
- **THEN** generated reports MUST record an `unsupported` classification with a reason
- **AND** the report MUST include the remediation target for real webview timing

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

### Requirement: Runtime Evidence Gate MUST Separate Dead Code From Compatibility Code

The system MUST distinguish unreferenced dead code from intentional compatibility, diagnostic, and platform fallback paths.

#### Scenario: compatibility paths are not deleted by reference count alone
- **WHEN** a low-reference or externally invoked compatibility path is found
- **THEN** the cleanup report MUST classify it as compatibility or diagnostic before removal is considered
- **AND** deletion MUST require a dedicated removal change or explicit compatibility evidence

#### Scenario: true dead code is eligible for cleanup
- **WHEN** a code path has no imports, no command exposure, no external runtime entry, and no documented compatibility purpose
- **THEN** it MAY be listed as cleanup-eligible
- **AND** the report MUST include the verification method used to reach that conclusion

### Requirement: Runtime Evidence Gate MUST Keep Validation Noise Actionable

The system MUST treat validation noise as a stability defect when it comes from runtime cleanup that outlives the owning component or environment.

#### Scenario: virtualizer cleanup does not outlive jsdom teardown
- **WHEN** the Messages timeline virtualizer observes scroll offset changes
- **AND** the timeline unmounts before a scheduled scroll-end fallback fires
- **THEN** the pending fallback timer MUST be cleared during cleanup
- **AND** the cleanup MUST remove scroll listeners registered by the observer

#### Scenario: heavy-test-noise remains a usable stability gate
- **WHEN** `npm run check:heavy-test-noise` runs the full test inventory
- **THEN** async teardown errors from the Messages timeline virtualizer MUST NOT be reported after the owning test environment is destroyed

### Requirement: Client Interaction Performance Evidence SHALL Be Classified

Runtime performance closure evidence SHALL classify client interaction scenarios by evidence strength before an optimization is considered release-grade.

#### Scenario: realtime evidence source is explicit

- **WHEN** a performance report covers realtime streaming visible lag, render amplification, terminal settlement, Composer typing, file editor typing, thread switching, sidebar projection, or session catalog hydration
- **THEN** each scenario MUST be classified as `measured`, `proxy`, `manual-only`, or `unsupported`
- **AND** the report MUST explain the classification and list the next action for non-measured scenarios.

### Requirement: Client Interaction Budgets SHALL Track User-Visible Latency

Performance evidence SHALL capture metrics that map to user-visible responsiveness rather than only backend completion time.

#### Scenario: typing budget includes input-facing signals
- **WHEN** Composer typing, streaming typing, or file editor typing evidence is collected
- **THEN** it MUST include input event cadence, draft or editor update latency or proxy, relevant subtree render count or proxy, React commit duration where available, long task evidence where available, and dropped/stale advisory update count where available
- **AND** it MUST preserve workspace/thread/file/turn/engine correlation where applicable without storing prompt, assistant body text, terminal output, or file content

#### Scenario: thread switch budget separates phases
- **WHEN** thread switch evidence is collected
- **THEN** it MUST separately record foreground selection latency, message shell availability, history restore duration, sidebar projection duration or proxy, catalog request count, and stale response drops where available
- **AND** it MUST identify which phase dominates the lag

### Requirement: Performance Evidence SHALL Be Content-Safe And Bounded

Client performance diagnostics SHALL remain safe during long conversations and large workspaces.

#### Scenario: diagnostic payload excludes conversation content
- **WHEN** performance diagnostics record typing, streaming, render, switch, or catalog evidence
- **THEN** the payload MUST NOT include full prompt text, assistant body text, tool output, command output, or file diff content
- **AND** it MAY include ids, counts, lengths, timings, booleans, status labels, bounded reason strings, and evidence classifications

#### Scenario: long sessions do not produce unbounded diagnostics
- **WHEN** a long streaming session receives many deltas or a large workspace triggers many projection updates
- **THEN** diagnostics MUST aggregate, sample, or keep latest summaries instead of appending unbounded per-event records
- **AND** final reports MUST remain bounded enough for local collection and review

### Requirement: Performance Optimization Layers SHALL Be Rollback-Safe

Each client interaction optimization layer SHALL be independently reversible without breaking runtime correctness.

#### Scenario: disabling one layer preserves runtime continuity
- **WHEN** an optimization for Composer props, status projection, thread switch staging, sidebar projection, catalog pagination, or timeline rendering is disabled
- **THEN** the client MUST preserve baseline-compatible conversation rendering, terminal settlement, draft input, and session continuity
- **AND** diagnostics MUST remain available to compare baseline and optimized behavior

#### Scenario: rollback does not disable unrelated protections
- **WHEN** one optimization layer is rolled back
- **THEN** unrelated realtime batching, terminal fences, input source-of-truth, and membership truth protections MUST remain active
- **AND** the rollback scope MUST be documented in the change evidence

### Requirement: Renderer stability evidence MUST be classified before release or archive claims
Performance and stability evidence reports SHALL classify renderer pressure and recovery evidence by collection strength before claiming release-grade improvement.

#### Scenario: evidence report covers renderer stability
- **WHEN** a report claims improvement for white-screen, WebView/WebContent crash, renderer unresponsive, long-run pressure, or multi-engine streaming stability
- **THEN** the report MUST classify each evidence item as measured, proxy, manual-only, or unsupported
- **AND** measured evidence MUST identify the source such as native process event, backend heartbeat watchdog, WebView/Tauri profiler, PerformanceObserver, OS process snapshot, or equivalent platform signal

#### Scenario: platform evidence is unavailable
- **WHEN** a platform cannot provide memory, process, long-task, native process failure, or profiler evidence
- **THEN** the report MUST mark that signal as unsupported with reason
- **AND** it MUST NOT present proxy or manual-only evidence as release-grade measured evidence

### Requirement: Runtime Evidence Gates MUST Expose Release Budget Fields

Runtime evidence gate artifacts MUST 在 observed values 旁暴露 budget metadata，使后续 optimization changes 可以用结构化字段判断 pass/fail/unsupported。

#### Scenario: budget fields accompany observed values

- **WHEN** `docs/perf/runtime-evidence-gates.json` 重新生成
- **THEN** each budgeted scenario MUST include observed value, target value when defined, hard-fail threshold when defined, unit, evidence class, and source artifact path
- **AND** unsupported scenarios MUST keep `value: null` and include unsupported reason

#### Scenario: release checklist can fail on budget regression

- **WHEN** local or CI performance checklist reads runtime evidence gate artifacts
- **THEN** it MUST determine pass, fail, or unsupported from structured fields without scraping narrative markdown
- **AND** unsupported or proxy evidence MUST NOT be reported as release-grade measured evidence

### Requirement: Realtime Visible Lag Budgets SHALL Use Correlated Milestones

Realtime performance budgets SHALL use correlated turn milestones rather than isolated first-token or fixture-only timings.

#### Scenario: visible text lag budget uses ingress-to-visible timing

- **WHEN** realtime visible lag evidence is collected
- **THEN** the report SHOULD compute lag from first assistant text ingress to first visible text growth where measured timing exists
- **AND** it MUST preserve evidence class when the path is only fixture/proxy observable.

#### Scenario: render amplification budget remains content-safe

- **WHEN** render amplification evidence is collected
- **THEN** the report MAY include counts, durations, queue depths, and milestone deltas
- **AND** it MUST NOT include prompt text, assistant output body, tool output body, or terminal output content.

### Requirement: Performance Iteration Archive Readiness MUST Reconcile Residual Debt
Runtime performance archive readiness MUST reconcile completed task state with measured/proxy/manual evidence, known residual jank, and explicit technical-debt follow-up items before an active performance change is treated as archive-ready.

#### Scenario: task-complete change still has residual jank
- **WHEN** an active performance change has all tasks checked
- **AND** manual QA or runtime notes still report residual jank, missing profiler artifacts, or `unsupported` evidence for a required budget field
- **THEN** the evidence report MUST classify the change as task-complete but not fully archive-ready
- **AND** the report MUST list the blocking evidence gap or follow-up change instead of silently promoting the change to archive-ready

#### Scenario: compatibility fallback is intentionally retained
- **WHEN** a performance implementation keeps a single-channel fallback, worker unsupported fallback, disk-provider fallback, flat adapter, or rollback surface
- **THEN** the evidence report MUST classify that path as compatibility, adapter, diagnostic, or rollback code
- **AND** it MUST NOT describe the path as dead code or as a failed migration without evidence

### Requirement: Performance Evidence Language MUST Be Internally Consistent
Performance evidence artifacts MUST avoid contradictory closeout language for the same scenario, especially when manual QA and measured/proxy artifacts disagree.

#### Scenario: manual QA result conflicts with archive wording
- **WHEN** one artifact says a scenario has no visible jank
- **AND** another artifact for the same change says residual jank remains
- **THEN** the change MUST be recalibrated before archive
- **AND** the final status MUST choose one explicit classification: `measured`, `proxy`, `manual-only`, or `unsupported`, with a reason and next action

#### Scenario: profiler artifact is missing
- **WHEN** a report expects profiler-derived fields such as render counts, reducer counters, or realtime profile JSONL
- **AND** the source artifact is absent
- **THEN** the field MUST remain `unsupported` or `proxy` according to available evidence
- **AND** the report MUST NOT claim measured closure for that field

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

### Requirement: Input-Latency Budget Encoding MUST Land Candidate Budgets In Baseline

The system MUST encode owner-approved input-latency candidate budgets from `openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md` into `docs/perf/baseline.json` and MUST remove the corresponding records from `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` table.

#### Scenario: inputEventLossCount metrics gain budget block

- **WHEN** `S-CI-50/inputEventLossCount` and `S-CI-100-IME/inputEventLossCount` carry the `budgeted-next` decision with `target=0, hardFail=0, unit=count, owner=input-latency-budget` in the budget decision table
- **THEN** `docs/perf/baseline.json` MUST contain a `budget` block for both metrics
- **AND** the block MUST include `target: 0`, `hardFail: 0`, `unit: "count"`, `owner: "input-latency-budget"`, `source: "openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md"`, and `status: "approved"`
- **AND** `npm run perf:archive-readiness -- --json` MUST NOT list either metric as `budget-missing`

#### Scenario: owner rejection cannot fall back to budget-missing

- **WHEN** an owner rejects the `hardFail=0` value for inputEventLossCount
- **THEN** the implementation MAY change `target` / `hardFail` to a different approved value
- **AND** it MUST NOT remove the `budget` block and reclassify the metric as `budget-missing`

### Requirement: BUDGET_RESIDUALS Table MUST Stay In Sync With Baseline Budgets

The system MUST keep `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` table in lockstep with the set of metrics that have an actual `budget` block in `docs/perf/baseline.json`. Once a metric gains a `budget` block, the readiness gate MUST NOT list it as `budget-missing` anymore.

#### Scenario: realtime metrics already budgeted in baseline are not in BUDGET_RESIDUALS

- **WHEN** `docs/perf/baseline.json` carries a `budget` block for `S-RS-VL/visibleTextLagP95`, `S-RS-RA/reducerAmplificationMedian`, `S-RS-FD/batchFlushDurationP95`, or `S-RS-TS/terminalSettlementP95`
- **THEN** `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` MUST NOT contain those records
- **AND** `npm run perf:archive-readiness -- --json` MUST NOT list those records under `budget-missing`

#### Scenario: input-latency budgeted metrics are removed from BUDGET_RESIDUALS after encoding

- **WHEN** `S-CI-50/inputEventLossCount` and `S-CI-100-IME/inputEventLossCount` gain a `budget` block in `docs/perf/baseline.json`
- **THEN** `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` MUST NOT contain those records
- **AND** the normal-mode readiness report MUST drop its `budgetMissingCount` by exactly two for the input-latency pair (and by four for the realtime pair if those were not yet removed)

#### Scenario: residual 15 metrics remain visible

- **WHEN** all budgeted metrics are removed from `BUDGET_RESIDUALS`
- **THEN** the residual count MUST equal 15 (LL-200/500/1000 commit duration and first-paint = 9, CI compositionToCommit = 2, RS-PE dedupHitRatio and assemblerLatency = 2, CS-COLD firstPaintMs and firstInteractiveMs = 2)
- **AND** the readiness report MUST keep those 15 records as `budget-missing` warnings

### Requirement: Long-Running Client Runtime Evidence MUST Track Bounded Resources

Runtime performance evidence MUST track long-running client resources that can make module switching and streaming degrade over time.

#### Scenario: active engine process count is budgeted

- **WHEN** long-running client runtime evidence is collected
- **THEN** it MUST include `S-LR-100/activeEngineProcessCountAfterClose` or an explicit unsupported marker
- **AND** the metric MUST report whether the evidence is measured, proxy, manual-only, or unsupported
- **AND** a nonzero value after all local workspaces close MUST include a reason or external-process qualifier
- **AND** the metric MUST be described as registered runtime handle evidence, not OS process liveness evidence

#### Scenario: OS child liveness after close is explicit

- **WHEN** long-running client runtime evidence is collected after closing local runtime workspaces
- **THEN** it MUST include `S-LR-101/sampledOsChildLivenessAfterClose` or an explicit unsupported marker
- **AND** a measured/manual/proxy value MUST include platform qualifier and sampling method
- **AND** unsupported sampling MUST include bounded rationale

#### Scenario: stale child candidates are visible

- **WHEN** stale child reconciliation runs in diagnostics-only mode
- **THEN** it MUST report `S-LR-110/staleEngineChildCandidateCount` or an explicit unsupported marker
- **AND** diagnostics-only stale candidates MUST NOT be described as auto-killed
- **AND** age-only stale candidates MUST state when progress evidence is unsupported

#### Scenario: module switch latency is phase-aware

- **WHEN** module or workspace switch performance evidence is collected
- **THEN** it MUST include `S-LR-200/moduleSwitchP95Ms` or an explicit unsupported marker
- **AND** the report SHOULD separate selection latency, list mount/commit cost, projection cost, and history/message availability where observable

#### Scenario: long-list visible row count is bounded

- **WHEN** long-list evidence is collected for Home/Sidebar/ThreadList
- **THEN** it MUST include `S-LR-210/visibleListRowCount` or an explicit unsupported marker
- **AND** the row count MUST be compared against the virtualizer overscan budget or marked unsupported with rationale

#### Scenario: markdown worker pending requests are bounded

- **WHEN** Markdown worker evidence is collected
- **THEN** it MUST include `S-LR-300/markdownWorkerPendingRequests` or an explicit unsupported marker
- **AND** pending requests MUST return to zero after worker dispose or test teardown

#### Scenario: streaming visible lag is tracked or explicitly deferred

- **WHEN** streaming runtime evidence is collected for this change
- **THEN** it MUST include `S-LR-310/streamingVisibleLagP95Ms` or an explicit unsupported/manual-only marker
- **AND** the report MUST state whether the value reuses `chat-stream-render-isolation-2026-06` baseline evidence or comes from a fresh runtime trace

### Requirement: Long-Running Runtime Evidence MUST Remain Content-Safe

Long-running runtime diagnostics MUST remain safe and bounded even during multi-engine long conversations.

#### Scenario: long-run evidence excludes conversation content

- **WHEN** process, module switch, list, streaming, or worker evidence is emitted
- **THEN** the payload MUST NOT include prompt text, assistant body text, terminal output, tool output, file diff content, or raw Markdown body
- **AND** it MAY include ids, process ids, counts, durations, lengths, hashes, evidence class, and bounded reason strings

#### Scenario: proxy evidence is not promoted to measured

- **WHEN** evidence is produced by jsdom, static counters, fixtures, synthetic worker tests, or manual notes without runtime timing
- **THEN** it MUST be classified as `proxy` or `manual-only`
- **AND** archive-readiness MUST list the measured runtime/WebView follow-up if release-grade proof is required

### Requirement: V0511 Evidence Gates MUST Consume Producer Artifacts

Runtime performance evidence gates MUST consume v0.5.11 producer artifacts for supported `S-IO-*` scenarios before classifying a summary as unsupported.

#### Scenario: supported producer populates summary

- **WHEN** a producer artifact contains valid metric rows for `S-IO-RR`, `S-IO-AS`, `S-IO-FC`, `S-IO-FS`, or `S-IO-FP`
- **THEN** `scripts/generate-runtime-evidence-report.mjs` MUST populate the matching summary with those values
- **AND** the summary MUST expose the evidence class from the producer artifact

#### Scenario: missing producer remains explicit

- **WHEN** no trustworthy producer artifact exists for a v0.5.11 runtime evidence summary
- **THEN** the summary MUST remain `unsupported`
- **AND** it MUST include a concrete reason and next action instead of a silent null value

### Requirement: V0511 Archive Readiness MUST Distinguish Residual Warnings From Hard Failures

Archive-readiness output MUST keep hard failures separate from visible residual performance debt.

#### Scenario: warning result remains actionable

- **WHEN** `npm run perf:archive-readiness -- --json` exits with warnings but no hard failures
- **THEN** the JSON result MUST report `ok: true`
- **AND** every warning MUST include a record id, owner, and next action

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
