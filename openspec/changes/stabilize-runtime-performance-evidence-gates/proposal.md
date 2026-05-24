## Why

The current performance and stability work has useful fixtures and completed task lists, but several release-critical claims still depend on proxy evidence: long-list scroll confidence is fixture/jsdom-based, cold-start webview timing can be `unsupported`, realtime batching lacks a single visible-lag evidence contract, and completed OpenSpec changes remain active.

This change turns performance optimization, stability optimization, and base capability stabilization into an evidence-first gate: the repo must distinguish measured runtime facts from unsupported/manual/platform qualifiers before claiming closure.

## Target And Boundary

- Establish runtime performance evidence gates for long-list, realtime streaming, cold-start, bundle, and large-file governance.
- Calibrate session/realtime stability claims against proposal artifacts and current code facts.
- Keep Windows and Claude-manual gaps explicit when the local environment cannot cover them.
- Preserve intentional compatibility/diagnostic paths unless a dedicated removal change proves they are no longer required.

## Non-Goals

- No broad UI redesign.
- No provider protocol rewrite.
- No removal of `listClaudeSessions`, `listProjectRelatedCodexSessions`, legacy bare-session metadata lookup, or legacy cursor parsing in this change.
- No claim of Windows pass without Windows evidence.
- No speculative optimization that lacks a before/after metric or a bounded rollback path.

## What Changes

- Add a consolidated evidence-gate contract for runtime performance and stability closure.
- Add or tighten machine-readable summaries that classify each performance scenario as measured, proxy, unsupported, or manual-only.
- Add a current cleanup/compatibility audit document so dead code, legacy compatibility, and deferred compatibility removal are no longer mixed together.
- Update governance documentation so completed active changes can be archived only with explicit evidence and platform qualifiers.
- Use existing performance scripts and checks where possible instead of adding a parallel benchmarking stack.
- Add focused boundary tests for missing/malformed evidence sources so report generation does not convert absent data into silent success.
- Keep browser/CDP unavailability as explicit `unsupported` evidence instead of failing the local script before a report can be written.
- Include one narrow runtime stability cleanup: Messages timeline virtualizer offset observation now clears pending scroll-end fallback timers during unmount.

## Technical Options

| Option | Summary | Trade-off | Decision |
|---|---|---|---|
| Extend existing perf/governance scripts | Reuse `perf:*`, `check:*`, OpenSpec, and Trellis evidence outputs. | Lowest disruption; some evidence remains constrained by local environment. | Chosen. It aligns with current repo contracts and avoids duplicate benchmark systems. |
| Introduce a new full E2E benchmark harness | Add a dedicated Playwright/Tauri/webview benchmark layer immediately. | Stronger end-to-end evidence, but higher setup cost and more platform variance. | Deferred. Use explicit unsupported/proxy classifications first, then add E2E gates where the repo can run them consistently. |

## Acceptance Criteria

- `openspec validate --all --strict --no-interactive` passes.
- Runtime performance evidence reports clearly classify each scenario as `measured`, `proxy`, `unsupported`, or `manual-only`.
- `S-LL-1000` no longer hides browser-scroll evidence gaps behind a passing fixture value.
- Cold-start webview metrics remain honest when unsupported and include a remediation target.
- Realtime evidence ties first-token latency, batching flush, terminal pressure, and visible-lag risk to the same scenario summary.
- Session catalog and stale recovery compatibility paths are either referenced, documented as legacy/diagnostic, or removed only when safe.
- Completed active OpenSpec changes have a generated archive-readiness list with validation and platform/manual-test qualifiers.

## Capabilities

### New Capabilities
- `runtime-performance-evidence-gates`: Evidence classification and closure gates for runtime performance, stability, and governance readiness.

### Modified Capabilities
- `runtime-perf-baseline`: Baseline reports must classify proxy/unsupported/manual evidence explicitly.
- `conversation-realtime-client-performance`: Realtime performance evidence must include visible-lag and terminal-pressure correlation.
- `workspace-session-catalog-projection`: Session catalog performance/stability evidence must preserve bounded scan and degraded-state semantics.
- `large-file-modularization-governance`: Near-threshold cleanup recommendations must stay tied to hot-path risk and compatibility facades.

## Impact

- Documentation and OpenSpec artifacts under `openspec/changes/stabilize-runtime-performance-evidence-gates/`.
- Performance scripts and reports under `scripts/` and `docs/perf/`.
- Governance/cleanup reports under `openspec/docs/` or `docs/`.
- One narrowly scoped runtime cleanup is included: Messages timeline virtualizer offset observation now clears pending scroll-end fallback timers on unmount after `check:heavy-test-noise` exposed a jsdom teardown error.

## Final Calibration (2026-05-24)

The final review pass found and closed four proposal/code mismatches:

- Browser long-list evidence now handles empty or non-scrollable fixtures by clamping `maxScrollTop` at zero, validates malformed CDP payloads, and writes explicit `unsupported` JSON for unsupported browser/CDP environments.
- Runtime evidence aggregation now emits explicit `unsupported` rows when the baseline or browser-scroll source is missing or malformed, instead of dropping the source from the summary.
- Realtime visible-lag summaries now treat malformed timing values as `unsupported`, not `bounded`.
- Large-file near-threshold summaries tolerate older report shapes without `failThreshold`, rendering headroom as `n/a` instead of `NaN`.

Residual qualifiers remain intentional:

- Windows runtime/manual evidence was not collected in this local environment.
- Browser-level scroll evidence was collected on local macOS Chrome/CDP only.
- Tauri webview cold-start timing remains `unsupported`.
- Compatibility paths are documented and retained; deletion requires a dedicated compatibility-removal change.
