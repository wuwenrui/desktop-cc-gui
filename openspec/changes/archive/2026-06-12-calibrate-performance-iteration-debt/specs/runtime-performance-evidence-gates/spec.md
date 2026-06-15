## ADDED Requirements

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
