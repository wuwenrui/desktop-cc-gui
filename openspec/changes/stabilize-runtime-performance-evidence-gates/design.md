## Context

The current branch already has useful performance and stability substrate:

- `runtime-perf-baseline` covers long-list, composer, realtime, and cold-start fixture reports.
- `optimize-long-list-virtualization`, `optimize-realtime-event-batching`, and `optimize-bundle-chunking` are task-complete but still active.
- Session catalog refactors have code and documentation evidence, while Windows and full Claude manual coverage remain explicit gaps.
- Large-file governance reports near-threshold hot files but does not by itself decide which files are safe to split.

The missing layer is a single closure gate that prevents proxy or unsupported evidence from being mistaken for measured runtime proof.

## Goals / Non-Goals

**Goals:**

- Add an evidence classifier used by performance and stability reports.
- Keep local unsupported/platform qualifiers visible in generated output.
- Produce an archive-readiness view for completed active OpenSpec changes.
- Preserve compatibility/diagnostic paths until a dedicated removal change exists.
- Keep implementation small and script-oriented so the first pass improves truthfulness without altering runtime behavior unless validation exposes a narrowly scoped stability defect.

**Non-Goals:**

- No new benchmark dependency.
- No rewrite of realtime event batching, session catalog construction, or virtualization.
- No Windows pass claim without Windows execution.
- No removal of compatibility APIs in this change.

## Decisions

### Decision 1: Evidence classification is the first deliverable

Each scenario must be classified as `measured`, `proxy`, `unsupported`, or `manual-only`.

Alternative considered: treat every successful script exit as pass. That is rejected because scripts can succeed while key metrics are unsupported or proxy-only.

### Decision 2: Extend existing reports instead of adding a parallel harness

The first implementation should read current perf/OpenSpec outputs and generate a consolidated evidence report.

Alternative considered: add a new Playwright/Tauri benchmark harness immediately. That is deferred because it would mix infrastructure bring-up with evidence correction and increase platform variance before the reporting contract is stable.

### Decision 3: Runtime behavior changes require evidence-backed narrow scope

This change should primarily update scripts, docs, and governance reports. Runtime behavior changes are allowed only when validation exposes a concrete stability defect with a small, testable rollback boundary.

Alternative considered: implement adaptive realtime batching and session scan optimization in the same change. That is rejected for scope control; changing behavior before evidence gates exist would make regressions harder to attribute.

### Decision 4: Legacy compatibility is documented before deletion

Compatibility paths such as `listClaudeSessions`, `listProjectRelatedCodexSessions`, legacy bare-session metadata lookup, and legacy cursor parsing remain intentional unless a dedicated removal change proves callers and recovery semantics no longer need them.

Alternative considered: remove anything with low reference count. That is unsafe because diagnostic/native-continuity paths can be externally reachable or platform-triggered even when import counts look low.

## Implementation Shape

1. Add a small evidence report script that reads current perf JSON outputs and OpenSpec active-change state.
2. Generate a markdown report under `docs/perf/` with explicit evidence class, residual risk, and next action.
3. Add an OpenSpec cleanup report under `openspec/docs/` that separates:
   - completed archive-ready changes,
   - completed changes with qualifiers,
   - in-progress changes,
   - intentional compatibility/diagnostic paths.
4. Wire package scripts to run the report without making it a hard CI blocker until the contract is stable.
5. Validate with OpenSpec, typecheck, and existing performance/governance checks.
6. If validation exposes teardown noise or timer leakage, apply only the minimal cleanup-safe runtime fix and cover it with focused tests.

### Browser long-list scroll gate

Add a dependency-free optional browser gate for `S-LL-1000`:

- Locate Chrome/Chromium/Edge through `CHROME_BIN`, `BROWSER_BIN`, or common platform install paths.
- Launch a temporary headless browser with CDP.
- Render a deterministic 1000-row HTML fixture and perform a requestAnimationFrame-driven scroll trace.
- Write `docs/perf/long-list-browser-scroll.json`.
- If no browser/CDP support is available, write the same fragment with `unsupportedReason` instead of failing silently.

This gate is intentionally separate from `perf:long-list:baseline`: the baseline remains fixture/jsdom-compatible, while evidence reporting can elevate browser-scroll evidence to `measured` when the local or CI environment supports it.

### Heavy-test noise stabilization

Full-suite heavy-test validation exposed a Messages timeline virtualizer teardown error after jsdom removed `window`. The fix is intentionally narrow:

- Keep TanStack virtualizer as the runtime engine.
- Override only the element offset observer for the Messages timeline.
- Clear the pending scroll-end fallback timer during unmount.
- Validate both the focused Messages live behavior test and the full `check:heavy-test-noise` batch.

## Risks / Trade-offs

- [Risk] Reports become stale if generated once and forgotten. → Mitigation: add a package script and record regeneration in tasks/validation.
- [Risk] Evidence classification may be too coarse for future benchmarks. → Mitigation: use a small schema that can add fields without changing the four top-level classes.
- [Risk] Developers treat `proxy` as failure. → Mitigation: proxy is not automatically failure; it blocks release-grade closure claims until measured or explicitly accepted.
- [Risk] Archive-readiness output may include changes that still need manual review. → Mitigation: classify as readiness guidance, not automatic archive.

## Migration Plan

1. Create OpenSpec artifacts and spec deltas.
2. Add report generation scripts and docs.
3. Run validation.
4. Commit as an evidence-gate foundation.
5. Use the generated reports to select the next real optimization batch.

## Rollback Strategy

Rollback by reverting the change directory, report scripts, generated reports, package script entries, and the Messages timeline offset-observer override. The runtime rollback boundary is limited to `MessagesTimeline.tsx` and `messagesTimelineVirtualization.ts`.

## Open Questions

- Which CI environment should own true browser-level `S-LL-1000` scroll evidence?
- Which Windows machine or CI lane should provide Windows runtime/manual qualifiers?
- Should archive-readiness reports become hard gates after the first successful pass?
