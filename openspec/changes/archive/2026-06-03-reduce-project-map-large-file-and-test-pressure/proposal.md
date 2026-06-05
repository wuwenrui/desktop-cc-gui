# Proposal: Reduce Project Map Large-File And Test Pressure

## Why

The Project Map graph-first work completed successfully, but the follow-up gate run exposed two release blockers and one stale test contract:

- `npm run test` stalls on `OrchestrationCenterView.test.tsx` and can OOM. The verified root cause is a render loop caused by fallback arrays being recreated on every render and then fed into an effect that writes component state.
- `OrchestrationCenterView.test.tsx` also crosses the Tauri model bridge even though the assertions only cover orchestration UI behavior.
- `npm run check:large-files` reports hard failures for large source surfaces because the hard-debt baseline is empty.
- `projectMapLayoutCss.test.ts` still asserts the old Project Map work-queue banner layout after the graph-first redesign removed that surface from the primary canvas.
- `TaskCenterView.test.tsx` still asserts the old action contract where unavailable actions render as disabled buttons, while the current UI only renders executable actions.

These blockers should be handled as explicit engineering hygiene, not hidden inside the Project Map UX change. The change should reduce real pressure where safe, and record known debt where a same-pass rewrite would be riskier than the gate failure itself.

## What Changes

This change stabilizes the blocking test path and records large-file hard debt deliberately:

- make `OrchestrationCenterView` fallback arrays referentially stable so the model-option synchronization effect cannot create a render loop;
- mock the Tauri model bridge in `OrchestrationCenterView.test.tsx` so the jsdom test does not import or execute the heavy runtime bridge;
- extract Project Map inspector/detail CSS into a dedicated stylesheet so the main Project Map stylesheet drops below the style hard-fail threshold;
- update the Project Map CSS layout sentry to assert the current graph-first shell instead of the removed task banner surface;
- update the Task Center unit test to match the current executable-action rendering contract and wrap external open-run navigation events in React `act`;
- record remaining oversized hard-debt files in the large-file baseline so future growth is treated as regression rather than repeatedly surfacing as new debt;
- keep deeper `ProjectMapPanel.tsx` and Rust daemon modularization as future refactors instead of risky opportunistic rewrites.

## Scope

### In scope

- Test isolation for Orchestration Center unit tests.
- Referential-stability fix for Orchestration Center optional model inputs.
- Project Map stylesheet split.
- Project Map layout CSS sentry calibration after the graph-first redesign.
- Task Center test contract calibration for executable actions and open-run event flushing.
- Large-file baseline update for known remaining oversized files.
- Validation through lint, typecheck, targeted tests, large-file sentry, and OpenSpec strict validation.

### Out of scope

- Full component extraction from `ProjectMapPanel.tsx`.
- Rust daemon module split.
- Behavior changes to task orchestration runtime or Project Map data contracts.
- Reintroducing the Project Map work queue as a primary canvas surface.
- Git commit or Trellis session record.
