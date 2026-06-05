# Design: Stale binding continuity regression guard

## Current Shape

`useThreadStorage` owns persisted thread aliases and exposes `resolveCanonicalThreadId`. `useThreads` already has an effect that scans `activeThreadIdByWorkspace` and dispatches `setActiveThreadId` when an id resolves to a different canonical target.

## Chosen Approach

Move the scan decision into `collectCanonicalActiveThreadRebindings(...)` in `threadStorage.ts`.

This keeps the React side effect thin:

1. Read active ids.
2. Ask pure helper for required rebindings.
3. Dispatch only concrete `workspaceId -> canonicalThreadId` updates.

## Why This Shape

- The critical rule is identity math, not React rendering.
- A pure helper can cover alias-chain flattening and trimmed stale ids without mounting the full app shell.
- The existing `useThreads` behavior remains stable, avoiding accidental recovery UI or runtime behavior drift.

## Risk

Low. The helper mirrors existing inline behavior. The only behavior tightening is that whitespace-only ids are ignored and trimmed stale ids are normalized before resolution.
