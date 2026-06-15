# realtime-input-render-budget delta

## ADDED Requirements

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
