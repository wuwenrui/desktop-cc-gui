## Context

React production error `#185` maps to `Maximum update depth exceeded`. The captured stack points through the message bundle and AppShell render wrapper, with the actionable stateful surface in `Messages.tsx`.

The message pipeline already separates latest live rows from deferred parent timeline derivations. The bug class here is narrower: effects that synchronize UI helper state can still call `setState` with a value that is semantically unchanged. In React 19 production, repeated nested updates from those effects can trip the update-depth guard and fall into the global ErrorBoundary.

## Goals / Non-Goals

**Goals:**

- Make message render helper state writes idempotent where repeated renders can replay the same semantic state.
- Preserve latest reasoning auto-expand behavior during streaming.
- Add a focused regression test for repeated same-state render inputs.

**Non-Goals:**

- No AppShell layout rewrite.
- No change to provider realtime contracts, Tauri IPC, history loaders, Markdown rendering, or streaming throttle values.
- No new dependency.

## Decisions

1. Add local equality guards around `Set`-backed expanded state updates.
   - Alternative: central reducer for all `Messages` UI state. Rejected because the current failure is localized and a reducer rewrite has higher regression risk.
   - Rationale: `.trellis/spec/frontend/quality-guidelines.md` already requires `Set` / `Map` cleanup effects to return the previous reference when content is unchanged.

2. Keep existing refs and live/deferred split intact.
   - Alternative: remove latest reasoning auto-expand. Rejected because that changes visible streaming behavior and weakens the existing live conversation UX.
   - Rationale: the correct fix is idempotency, not removing the feature.

3. Test the repeated render shape instead of relying on production minified stack matching.
   - Alternative: snapshot the generated bundle line numbers. Rejected because build hashes and minification columns are unstable.
   - Rationale: the behavioral contract is that repeated semantically identical message inputs must not crash the renderer.

## Risks / Trade-offs

- [Risk] Equality checks over `Set` values add a tiny cost during state updates. → Mitigation: affected sets are UI expansion ids, bounded by visible rows.
- [Risk] The original screenshot has minified stack only, so exact event sequence cannot be proven. → Mitigation: patch the concrete update-depth class in the message surface and cover the repeated-rerender regression.
- [Risk] Dirty workspace contains unrelated OpenSpec and opencode changes. → Mitigation: touch only the new change directory and message files.

## Migration Plan

Deploy as a frontend-only patch. Rollback is removing the idempotent guard and its regression test. No data migration or backend compatibility step is required.

## Open Questions

None for implementation.
