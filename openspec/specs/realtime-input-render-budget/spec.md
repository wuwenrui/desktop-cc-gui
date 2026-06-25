# realtime-input-render-budget Specification

## Purpose
TBD - created by archiving change realtime-input-and-io-isolation-2026-06. Update Purpose after archive.
## Requirements
### Requirement: Live Assistant Delta MUST Use A Provider-Agnostic Fast Path

`appendAgentDelta` MUST use the incremental derivation fast path for claude, codex, gemini, and opencode threads when the assistant message is the last item, canonicalization is not required, and final metadata does not need to be preserved.

#### Scenario: non-claude tail delta hits the fast path

- **WHEN** a `codex:`, `gemini:`, or `opencode:` thread receives a streaming `appendAgentDelta` for the last assistant message
- **AND** `shouldCanonicalizeLegacyId === false`
- **AND** `keepFinalMetadata === false`
- **THEN** the reducer MUST update the message through the live assistant delta fast path
- **AND** MUST NOT call `prepareThreadItems` for that delta.

#### Scenario: slow path remains reachable for semantic derivation

- **WHEN** the assistant message is not the last item
- **OR** `shouldCanonicalizeLegacyId === true`
- **OR** `keepFinalMetadata === true`
- **THEN** the reducer MUST use the existing `prepareThreadItems` slow path.

#### Scenario: terminal message completion remains slow-path covered

- **WHEN** `completeAgentMessage` finalizes a streaming message
- **THEN** tests MUST prove the final item list matches the slow-path baseline
- **AND** final metadata MUST be preserved.

### Requirement: Fast Path Equivalence MUST Be Proven Across Streaming Edge Cases

Provider-agnostic fast path behavior MUST be covered by targeted tests before it is enabled by default.

#### Scenario: reasoning and assistant deltas interleave

- **WHEN** reasoning deltas and assistant deltas interleave during a codex streaming burst
- **THEN** reasoning item positions MUST remain stable
- **AND** the assistant message MUST continue to receive tail deltas correctly.

#### Scenario: tool or generated image items require derivation safety

- **WHEN** tool items or generated image items are present in the same turn
- **THEN** tests MUST verify that fast-path deltas do not break generated image anchor binding
- **AND** any reorder/canonicalization case MUST fall back to `prepareThreadItems`.

### Requirement: Realtime Reducer Evidence MUST Be Reported

Runtime evidence gates MUST report reducer hot-path metrics so streaming regressions can be detected.

#### Scenario: prepareThreadItems call rate is reported

- **WHEN** a 1000-delta streaming fixture runs
- **THEN** `prepareThreadItems_calls_per_1000_delta` MUST be present
- **AND** calls MUST only come from terminal/reorder/canonicalization scenarios.

#### Scenario: reducer and route timing are reported

- **WHEN** the realtime performance gate runs
- **THEN** `thread_reducer_flush_ms_p95` MUST be present
- **AND** `realtime_delta_route_ms_p95` MUST be present.

### Requirement: Realtime Runtime Evidence MUST Prefer Measured Runtime Over Replay Proxy

The system MUST prefer measured `realtime.turnTrace.summary` runtime data over `realtime-extended-baseline.json` proxy data when both are available, and MUST keep the budget table in `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` synchronized with the set of metrics that actually carry a `budget` block in `docs/perf/baseline.json`.

#### Scenario: measured runtime summary overrides proxy in the baseline

- **WHEN** `docs/perf/realtime-runtime-evidence.json` contains `evidenceClass: "measured"` rows for `S-RS-VL/visibleTextLagP95`, `S-RS-RA/reducerAmplificationMedian`, `S-RS-FD/batchFlushDurationP95`, or `S-RS-TS/terminalSettlementP95`
- **THEN** `scripts/generate-runtime-evidence-report.mjs` MUST keep those rows at `evidenceClass: "measured"` and MUST NOT overwrite their `source` with `docs/perf/realtime-extended-baseline.json`
- **AND** the proxy fallback path MUST only fire when `entry.evidenceClass !== "measured"`

#### Scenario: realtime metrics are budgeted with owner and source

- **WHEN** `docs/perf/baseline.json` carries a `budget` block for any of the four realtime metrics
- **THEN** the `budget` block MUST include `owner: "realtime-runtime-evidence"`, `source: "openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md"`, and `status: "approved-runtime-measured"`
- **AND** the `rollout` field MUST read `approved-pending-runtime-trace`
- **AND** `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` MUST NOT list those metrics as `budget-missing`

#### Scenario: release mode stops reporting proxy-only realtime

- **WHEN** the four realtime metrics are `evidenceClass: "measured"` in `docs/perf/baseline.json`
- **THEN** `npm run perf:archive-readiness -- --release --json` MUST NOT emit `release-evidence-proxy` or `release-evidence-unsupported` records for them
- **AND** they MUST remain visible in normal mode only as `budget-missing` warnings if `BUDGET_RESIDUALS` still references them

### Requirement: Composer And Control Feedback MUST Own An Interaction Budget

Composer typing, command controls, topbar buttons, session tabs, and sidebar clicks MUST retain an interaction-lane render budget while realtime canvas rendering is active.

#### Scenario: Composer typing is not blocked by canvas rendering

- **WHEN** the user types in Composer during an active realtime turn
- **AND** the center canvas is receiving repeated assistant/tool/markdown updates
- **THEN** the typed characters MUST be echoed through local interaction state before non-critical canvas heavy rendering
- **AND** Composer state MUST NOT synchronously depend on full conversation canvas projection

#### Scenario: session creation feedback is not blocked by active canvas stream

- **WHEN** the user clicks create/new-session controls while another realtime conversation is running
- **THEN** the click feedback and disabled/loading state MUST update through the interaction lane
- **AND** canvas-lane work MUST NOT delay the initial visible feedback for the create action

#### Scenario: sidebar and panel clicks remain lane-local

- **WHEN** the user selects a sidebar row, session tab, or right-panel control during active streaming
- **THEN** the selection feedback MUST use lane-local state or narrow selectors
- **AND** it MUST NOT wait for the active canvas to finish heavy Markdown/tool rendering

