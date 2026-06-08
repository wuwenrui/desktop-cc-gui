# large-file-modularization-governance Specification

## Purpose

Defines the large-file-modularization-governance behavior contract, covering Oversized File Detection Baseline.
## Requirements
### Requirement: Oversized File Detection Baseline
The system SHALL maintain version-traceable baseline artifacts for large-file governance, including a human-readable report and a machine-readable debt ledger keyed by the matched governance policy.

#### Scenario: Hard-debt baseline capture
- **WHEN** the large-file governance baseline scan runs for hard-debt tracking
- **THEN** every file whose line count exceeds its matched policy fail threshold MUST be recorded with path, line count, matched policy id, warn threshold, fail threshold, and priority tier
- **AND** the machine-readable baseline output MUST be committed in version control so later scans can compare debt growth

#### Scenario: Watchlist report generation
- **WHEN** the large-file governance watchlist scan runs
- **THEN** every file whose line count exceeds its matched policy warn threshold MUST be listed in the human-readable report
- **AND** the report MUST include the matched policy id and active threshold information for triage

### Requirement: Tiered Refactor Queue Governance
The system SHALL resolve each scanned file against an ordered set of governance policies and use the matched policy to determine thresholds, refactor priority, and staged modularization order.

#### Scenario: Domain-aware policy resolution
- **WHEN** a file is evaluated by the large-file governance scanner
- **THEN** the scanner MUST assign the file to exactly one governance policy based on its repo-relative path
- **AND** the matched policy MUST define warn threshold, fail threshold, and priority tier used in output and gate decisions

#### Scenario: Default policy fallback
- **WHEN** a file does not match any specialized governance policy
- **THEN** the scanner MUST evaluate it using the default governance policy
- **AND** the file MUST still receive a deterministic threshold and priority classification

#### Scenario: P0 and P1 near-threshold staged queue
- **WHEN** a file is classified as P0 or P1 and its line count exceeds the matched warn threshold
- **THEN** the file MUST be eligible for a staged modularization queue before it reaches the fail threshold
- **AND** the queue MUST sort work by priority tier, remaining headroom to fail threshold, and hot-path risk
- **AND** P2 test or i18n files MUST NOT displace P0/P1 runtime, feature-hotpath, or style files unless an explicit deferral rationale is recorded

#### Scenario: Coherent implementation batch scope
- **WHEN** a staged modularization batch is selected from the P0/P1 queue
- **THEN** the batch MUST declare one coherent code area, runtime module, feature surface, or stylesheet cascade area before code is moved
- **AND** unrelated hot paths MUST NOT be combined in the same implementation batch solely because they share near-threshold status
- **AND** TypeScript and CSS files MAY share a batch only when they belong to the same UI surface and the stylesheet cascade order is part of the same compatibility contract

### Requirement: Incremental Modularization with Facade Preservation
The system SHALL require incremental extraction behind compatibility facades for oversized or near-threshold P0/P1 files.

#### Scenario: Feature-preserving extraction
- **WHEN** a queued oversized file is refactored
- **THEN** external imports/command contracts MUST remain compatible for that batch
- **AND** behavior parity checks MUST pass before batch completion

#### Scenario: Compatibility facade preservation
- **WHEN** Rust, TypeScript, or CSS code is extracted from a queued P0/P1 file
- **THEN** the original entry file MUST keep public exports, command registration, hook/component entrypoints, or stylesheet import behavior compatible for the same batch
- **AND** callers MUST NOT be required to change Tauri command names, payload shapes, persisted state fields, CSS selectors, i18n keys, or public import paths solely because of the split

#### Scenario: Cross-platform module extraction
- **WHEN** a queued file is split into new modules or stylesheets
- **THEN** new file names MUST avoid case-only distinctions and MUST follow the existing repo naming style for that directory
- **AND** Rust path handling introduced by the split MUST use `Path`, `PathBuf`, or `join` instead of hard-coded `/` or `\\`
- **AND** runtime behavior introduced by the split MUST NOT depend on POSIX-only shell syntax, platform-specific newline assumptions, or macOS-only filesystem case-insensitivity

#### Scenario: Per-batch validation matrix
- **WHEN** a staged modularization batch is completed
- **THEN** the batch MUST run `npm run check:large-files:gate`
- **AND** the batch MUST run targeted Rust tests, Vitest tests, typecheck, or CSS/UI verification that correspond to the files touched
- **AND** the validation evidence MUST include public symbol or selector checks when a facade is expected to preserve compatibility

### Requirement: Large-File Regression Sentry

The system SHALL provide CI sentry checks that enforce domain-aware hard gates and baseline-aware debt growth controls, while keeping near-threshold watch output visible for triage.

#### Scenario: Hard gate for new oversized debt

- **WHEN** a pull request introduces a new file whose line count exceeds the matched policy fail threshold
- **THEN** CI sentry MUST fail the check
- **AND** remediation guidance MUST be shown in logs

#### Scenario: Hard gate for growing legacy debt

- **WHEN** a file already tracked in the baseline exceeds the matched policy fail threshold and its current line count is greater than the baseline line count
- **THEN** CI sentry MUST fail the check
- **AND** the failure output MUST show both the baseline line count and the current line count

#### Scenario: stabilization extraction does not create replacement hubs

- **WHEN** this core runtime/realtime stabilization change extracts AppShell, realtime, runtime, bridge, fixture, or test code
- **THEN** new modules MUST be split by responsibility rather than becoming replacement hub files
- **AND** the change MUST keep `node --test scripts/check-large-files.test.mjs`, `npm run check:large-files:near-threshold`, and `npm run check:large-files:gate` passing
- **AND** touched near-threshold files MUST be reduced, kept stable, or documented with explicit follow-up rationale

#### Scenario: large-file sentry remains cross-platform

- **WHEN** large-file governance checks run in CI
- **THEN** parser tests, near-threshold watch, and hard-debt gate MUST run on ubuntu-latest, macos-latest, and windows-latest
- **AND** file matching and path output MUST remain platform-neutral

### Requirement: Completion Criteria for Governance Milestones

The system SHALL define measurable completion criteria for the Deferred + JIT governance mode, retained hard-debt elimination, and staged P0/P1 modularization batches.

#### Scenario: Deferred strategy review
- **WHEN** governance review is performed
- **THEN** review MUST include hard-gate violations count, JIT remediation outcomes, and unresolved risk list
- **AND** retained near-threshold files MAY be documented as watchlist items without mandatory decomposition plan

#### Scenario: Staged P0/P1 split completion review
- **WHEN** a P0/P1 modularization batch is marked complete
- **THEN** the review MUST list the original line count, final line count, matched policy, warn threshold, fail threshold, and remaining headroom for each split file
- **AND** each P0 file MUST either be reduced below warn threshold or retain at least 150 lines of fail-threshold headroom with a recorded follow-up split rationale
- **AND** each P1 file MUST retain at least 200 lines of fail-threshold headroom unless an explicit risk acceptance is documented
- **AND** no batch MAY be marked complete if it introduces new large-file hard debt

#### Scenario: Retained hard-debt elimination
- **WHEN** a retained fail-scope baseline entry is selected for cleanup
- **THEN** the cleanup MUST reduce the source file below its matched fail threshold through boundary-driven modularization
- **AND** the baseline MUST be regenerated only after the retained source no longer exceeds the fail threshold
- **AND** the cleanup MUST preserve public facades, selector contracts, command names, payload shapes, and persisted fields for the same batch

#### Scenario: Four-file retained hard-debt cleanup
- **WHEN** this change is marked complete
- **THEN** `src/features/project-map/components/ProjectMapRelationshipSection.tsx` MUST be below the default-source fail threshold
- **AND** `src/features/layout/hooks/useLayoutNodes.tsx` MUST be below the default-source fail threshold
- **AND** `src-tauri/src/project_map_relations.rs` MUST be below the default-source fail threshold
- **AND** `src/styles/project-map.relationship.css` MUST be below the styles fail threshold
- **AND** the regenerated hard-debt baseline MUST NOT contain retained fail-scope entries for those four files

#### Scenario: Project Map relationship facade preservation
- **WHEN** `ProjectMapRelationshipSection.tsx` is split
- **THEN** the exported `ProjectMapRelationshipSection` component MUST remain available from the same module path
- **AND** existing props, callbacks, visible view modes, API contract entry behavior, graph/file/read view behavior, and class names MUST remain compatible

#### Scenario: Layout hook facade preservation
- **WHEN** `useLayoutNodes.tsx` is split
- **THEN** the exported `useLayoutNodes` hook MUST keep the same public input and return contracts
- **AND** existing panel ordering, selected tab behavior, code-selection relationship graph behavior, and lazy panel fallback behavior MUST remain compatible

#### Scenario: Rust relationship scanner facade preservation
- **WHEN** `project_map_relations.rs` is split
- **THEN** existing Tauri command names and registered backend entrypoints MUST remain available
- **AND** snapshot ownership validation, path safety validation, scan output schema, API contract enrichment, and stale-state summaries MUST remain compatible

#### Scenario: Project Map relationship stylesheet contract preservation
- **WHEN** `project-map.relationship.css` is split
- **THEN** existing class selectors MUST remain valid
- **AND** imported stylesheet order MUST preserve graph, inspector, file-list, action-output, loading, and responsive cascade behavior

### Requirement: Large-File Governance MUST Favor Boundary-Driven Splits
第一阶段 large-file 治理 MUST 优先执行 boundary-driven split，而不是只按行数机械切分。

#### Scenario: split plan declares architectural boundary
- **WHEN** 某个 near-threshold 或 oversized P0/P1 文件被纳入第一阶段收敛批次
- **THEN** split plan MUST 先声明其所属架构边界，例如 bridge、lifecycle、persistent state、shared-state 或 runtime-mode
- **AND** split MUST NOT 仅为了降行数而切出无独立职责的新模块

#### Scenario: extracted modules do not become replacement hubs
- **WHEN** large-file 模块被拆成多个子模块
- **THEN** 新模块 MUST 以职责分片而不是复制原 hub 结构
- **AND** 若某个新模块接近阈值，批次 MUST 记录继续拆分的 follow-up rationale

### Requirement: Near-Threshold Cleanup Recommendations MUST Be Risk-Ordered

Large-file cleanup recommendations MUST rank near-threshold files by hot-path risk, fail-threshold headroom, and compatibility boundary before proposing extraction.

#### Scenario: runtime hot paths outrank passive debt
- **WHEN** near-threshold files are summarized for optimization planning
- **THEN** runtime hot paths MUST be ranked before passive docs, i18n, or test-only debt
- **AND** the report MUST include remaining fail-threshold headroom

#### Scenario: split candidates preserve facades
- **WHEN** a near-threshold file is recommended for splitting
- **THEN** the recommendation MUST state the public facade or compatibility boundary to preserve
- **AND** unrelated hot paths MUST NOT be grouped into one split solely because they are near threshold

### Requirement: Large File Gate SHALL Distinguish Known Debt From New Regressions

The large-file gate SHALL record known hard-debt files in the baseline when immediate safe splitting is not part of the current change.

#### Scenario: known hard debt is baseline tracked

- **WHEN** a file remains above its hard-fail threshold after the safe refactor scope is complete
- **THEN** the file MAY be recorded in the large-file baseline
- **AND** future line-count growth SHALL be treated as a regression
- **AND** the baseline SHALL NOT be used to hide newly introduced large files without explicit review

### Requirement: Style Surface Splits SHALL Preserve Selector Contracts

Feature stylesheet splits SHALL preserve selector contracts when cohesive style regions are extracted to lower gate pressure.

#### Scenario: Project Map inspector styles are extracted

- **WHEN** Project Map inspector/detail styles grow the main stylesheet beyond the style hard-fail threshold
- **THEN** those styles MAY move to a feature-local imported stylesheet
- **AND** existing class names and component markup SHALL remain compatible
