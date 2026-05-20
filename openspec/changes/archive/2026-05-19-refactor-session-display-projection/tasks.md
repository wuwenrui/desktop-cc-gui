## 1. Projection Contract

- [x] 1.1 Add a feature-local pure helper for sidebar session projection with explicit identity, title confidence, and membership evidence inputs. Input: existing thread summaries and source candidates. Output: stable projected summaries. Verify with focused unit tests.
- [x] 1.2 Centralize weak-title detection for `Agent N`, `Claude Session`, and empty ordinal fallbacks. Input: raw title strings. Output: title confidence classification. Verify with unit tests.

## 2. Frontend Integration

- [x] 2.1 Route Claude sidebar continuity/title merge through the projection helper without changing Tauri payload contracts. Depends on 1.1. Verify with `useThreadActions` focused tests.
- [x] 2.2 Tighten pending-to-finalized Claude handling so ambiguous finalize events do not create duplicate visible `Agent N` rows. Depends on 1.2. Verify with reducer tests.
- [x] 2.3 Preserve authoritative archive/hidden/delete filters ahead of last-good continuity. Depends on 2.1. Verify with existing timeout fallback tests.

## 3. Native Summary Guard

- [x] 3.1 Check whether Claude subagent metadata can emit generic `Agent N` as `firstMessage`; if yes, filter only generic ordinal metadata while preserving meaningful names. Verify with focused Rust tests.

## 4. Validation

- [x] 4.1 Run focused Vitest suites for projection, thread actions timeout fallback, and thread reducer identity continuity.
- [x] 4.2 Run focused Rust tests if native summary guard changes.
- [x] 4.3 Run `npm run typecheck`.
- [x] 4.4 Run `openspec validate --all --strict --no-interactive`.
