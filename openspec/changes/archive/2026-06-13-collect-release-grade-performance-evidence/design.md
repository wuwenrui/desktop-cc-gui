## Context

Current performance state is strong but not release-grade enough:

- `docs/perf/baseline.json` has 28 metrics.
- `npm run perf:archive-readiness -- --json` currently reports no hard metadata failures, but exits `2` because residual evidence remains.
- Residual evidence facts:
  - 21 metrics are `budget-missing`.
  - 9 evidence records are `unsupported`.
  - `S-CS-COLD/bundleSizeMain=1121481 bytes-gzip` exceeds `hardFail=1100000`.
  - Tauri `firstPaintMs` and `firstInteractiveMs` are unsupported.
  - realtime visible/render evidence is still replay/proxy-derived.

Existing useful substrate:

- `scripts/perf-cold-start-baseline.mjs`
- `scripts/perf-long-list-browser-scroll.mjs`
- `scripts/realtime-perf-report.ts`
- `scripts/perf-aggregate.mjs`
- `scripts/generate-runtime-evidence-report.mjs`
- `scripts/perf-archive-readiness.mjs`
- `src/services/rendererDiagnostics.ts`
- `docs/perf/realtime-turn-trace.json`

This design extends the existing evidence system instead of introducing a parallel reporting stack.

## Goals / Non-Goals

**Goals:**

- Collect measured runtime evidence for release-critical metrics.
- Keep proxy fixture evidence as regression baseline, not release proof.
- Make release-mode archive readiness stricter than normal closure readiness.
- Reduce or block on the current main bundle hard breach.
- Keep diagnostics content-safe and bounded.

**Non-Goals:**

- No broad AppShell/runtime/Markdown/FileView rewrite.
- No full large-file modularization campaign.
- No synthetic budgets without an owner-approved source.
- No new heavy dependency unless existing local tooling cannot collect the required signal.

## Decisions

### Decision 1: Extend Existing Perf Scripts

Use existing scripts and artifacts as the integration surface:

- `perf-cold-start-baseline.mjs` becomes the cold-start bundle + runtime timing entry.
- `realtime-perf-report.ts` / realtime trace utilities become runtime evidence collection inputs.
- `generate-runtime-evidence-report.mjs` remains the normalized report writer.
- `perf-archive-readiness.mjs` gains release-grade mode.

Alternatives:

- Create a new `perf-release-runner` that bypasses current scripts.
- Store release evidence in a new directory/schema.

Decision: reject parallel schema. The current report already feeds archive readiness and docs; forking it would create drift.

### Decision 2: Use Runtime-First, Proxy-Fallback Evidence Semantics

Each release-critical metric gets one of these states:

- `measured`: collected from desktop/browser/runtime timing.
- `proxy`: collected from fixture/replay/jsdom/static analysis.
- `manual-only`: human verified, no structured runtime signal.
- `unsupported`: current platform/tooling cannot collect it.

Release mode treats `proxy`, `manual-only`, and `unsupported` as residual unless a specific platform qualifier scopes them out.

Alternatives:

- Allow proxy evidence when it trends better than previous baseline.
- Require all metrics to be measured before any work can archive.

Decision: use measured-first gate with explicit qualifiers. This is strict enough for release evidence without blocking unrelated non-release archives forever.

### Decision 3: Cold-Start Timing Comes From Desktop Runtime

`firstPaintMs` and `firstInteractiveMs` must come from an actual Tauri/webview lifecycle signal.

Candidate implementation:

- Add a bounded startup marker in frontend runtime, such as `performance.mark("ccgui:first-paint")` after first useful shell paint and `performance.mark("ccgui:first-interactive")` after primary input/navigation surface is usable.
- Expose a content-safe diagnostic event or test hook that the runner can read.
- The runner launches the app, waits for the markers, writes `docs/perf/cold-start-baseline.json`, then aggregate updates `docs/perf/baseline.json`.

The exact runner transport can be chosen during implementation:

- Tauri driver / local app process log marker.
- Webview diagnostic event forwarded through existing runtime diagnostics.
- Browser-only fallback only for regression, not measured Tauri cold-start.

### Decision 4: Realtime Evidence Uses Correlated Runtime Milestones

Runtime evidence must reuse turn/session correlation rather than inventing a new trace id model.

Collected metrics:

- `S-RS-VL/visibleTextLagP95`
- `S-RS-RA/reducerAmplificationMedian`
- `S-RS-FD/batchFlushDurationP95`
- `S-RS-TS/terminalSettlementP95`

The runtime source should record only ids, counts, timings, status labels, and bounded reasons. It must not record prompt text, assistant body, tool output, terminal output, or file content.

### Decision 5: Bundle Remediation Is Narrow And Evidence-Driven

Before editing runtime code, run bundle analysis using existing bundle budget/chunking scripts. Only move dependencies when:

- The dependency is not required for first viewport/startup.
- Existing lazy boundary pattern already exists or can be extended safely.
- Focused tests prove behavior still loads on demand.

Candidate surfaces must be selected from actual build output, not guessed from import names.

### Decision 6: Budget-Missing Does Not Mean Fake Budgets

For the 21 missing budgets:

- If a metric already has a documented budget in specs or owner notes, encode it with `source`, `owner`, `unit`, and `status`.
- If no approved threshold exists, keep it as `budget-missing` and list owner/follow-up.

This keeps the gate honest: no invented `target` values during closure.

## Migration Plan

1. Add release-mode readiness semantics to `perf-archive-readiness`.
2. Add or extend cold-start runtime marker collection.
3. Add or extend realtime runtime measurement capture.
4. Regenerate `docs/perf/*` through the existing aggregate/report pipeline.
5. Run bundle analysis and apply narrow remediation if `bundleSizeMain` remains above hard fail.
6. Validate OpenSpec, typecheck, focused tests, perf scripts, and release readiness.

Rollback:

- Evidence runner changes are script/runtime-diagnostic scoped; they can be disabled without changing product behavior.
- Any bundle remediation must remain behind existing lazy boundaries and be revertible as a focused diff.
- If runtime timing collection is platform-blocked, keep metrics `unsupported` with platform qualifier and do not claim release-grade closure.

## Risks / Trade-offs

- [Risk] Tauri/webview timing may be hard to capture reliably in local automation.  
  → Mitigation: first implement explicit startup markers and record unsupported/platform-blocked state when collection fails.

- [Risk] Realtime runtime fixture may become flaky if it depends on a real provider.  
  → Mitigation: use deterministic app-server/replay fixture for event input, but collect renderer/runtime milestones from the actual runtime path.

- [Risk] Bundle remediation might drift into broad refactor.  
  → Mitigation: require bundle analysis before code edits and limit changes to startup-lazy candidates.

- [Risk] Stricter release gate may block archive with residual but acceptable risk.  
  → Mitigation: distinguish normal archive readiness from release-grade readiness; release blocker decisions must be explicit.

## Open Questions

- Which local runner gives the most stable Tauri webview timing in this repo: Tauri process logs, existing diagnostics bridge, or browser automation against a dev WebView surrogate?
- Should release-grade readiness be a flag on `perf:archive-readiness` such as `--release`, or a separate npm script such as `perf:release-readiness`?
- Which owner-approved budgets should be encoded immediately for the 21 `budget-missing` metrics, and which should remain residual?
