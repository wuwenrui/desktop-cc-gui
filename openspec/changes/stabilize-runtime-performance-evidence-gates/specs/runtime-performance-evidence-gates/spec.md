## ADDED Requirements

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

The system MUST generate guidance that separates task-complete OpenSpec changes from archive-ready OpenSpec changes.

#### Scenario: completed active changes are listed separately
- **WHEN** OpenSpec active-change state is inspected
- **THEN** task-complete changes MUST be listed separately from in-progress changes
- **AND** each completed active change MUST retain validation, manual-test, and platform qualifier notes when available

#### Scenario: in-progress changes remain explicit
- **WHEN** an active change has incomplete tasks
- **THEN** the report MUST list it as in-progress
- **AND** the report MUST NOT include it in archive-ready recommendations

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
