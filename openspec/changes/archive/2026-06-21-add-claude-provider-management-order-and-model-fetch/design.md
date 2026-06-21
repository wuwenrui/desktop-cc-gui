## Context

This is a backfill OpenSpec change for PR #705 after the implementation was merged into the local `feature/v0.5.11` branch in a no-commit state. The implementation changes Claude provider management behavior in two user-facing areas: provider ordering and model suggestion fetching.

The relevant existing architecture is:

- Claude provider records live in `~/.ccgui/config.json` under `claude.providers`.
- Backend provider records are represented by `ProviderConfig` in `src-tauri/src/types.rs`.
- Frontend provider state is coordinated by `useProviderManagement`.
- Frontend-to-backend calls go through `src/services/tauri/vendors.ts` wrappers and Tauri commands registered in `src-tauri/src/command_registry.rs`.

## Goals

- Preserve provider activation semantics while adding user-controlled order.
- Keep active/local provider pinning as display behavior, not persisted activation side effects.
- Make model suggestion fetching reliable for third-party Claude-compatible endpoints.
- Keep the implementation small and aligned with existing Tauri command and vendor UI patterns.

## Non-Goals

- No provider marketplace.
- No Codex/Gemini provider behavior changes.
- No change to composer model selector catalog resolution.
- No frontend direct HTTP calls to provider endpoints.

## Decision 1: Persist order on provider records

Chosen approach: add optional `sortOrder` to provider records.

Why:

- The existing storage shape already stores provider-specific metadata.
- Missing `sortOrder` can fall back to `createdAt`, preserving migration compatibility.
- Delete/import behavior is simpler because the order metadata travels with the provider record.

Rejected alternative: store an external ordered provider id array. It would require reconciliation whenever providers are deleted, imported, or ignored, increasing drift risk.

## Decision 2: Pin active provider in render, not in persistence

Chosen approach: backend returns providers sorted by persisted order; frontend extracts the active provider and renders it pinned outside the draggable list. The reorder payload includes the active provider reinserted at its home index so that switching away returns it to its persisted position.

Why:

- `vendor_switch_claude_provider` remains activation-only.
- Dragging cannot accidentally mutate the active provider state.
- "Return to original position after switching away" emerges from the persisted order.

## Decision 3: Keep optimistic reorder without success refetch

Chosen approach: `handleReorderProviders` updates local state optimistically, persists through `reorderClaudeProviders`, and does not immediately call `loadProviders()` on success.

Why:

- The backend command only writes `sortOrder`; it does not mutate active provider or provider content.
- A success refetch toggles loading state and replaces provider object identity immediately after drag settles, causing visible flicker.
- Failure still refetches to roll back to durable state.

## Decision 4: Fetch models through Rust backend

Chosen approach: add `vendor_fetch_claude_models(base_url, api_key)` Tauri command using `reqwest`.

Why:

- WebView `fetch()` would hit CORS and proxy inconsistencies.
- Backend networking keeps endpoint error handling and timeout behavior centralized.
- Sending both `Authorization: Bearer <key>` and `x-api-key: <key>` covers OpenAI-style and Anthropic-style compatible endpoints.

## Decision 5: Use native datalist for model suggestions

Chosen approach: use one shared `<datalist id="vendor-fetched-models">` across Sonnet/Opus/Haiku inputs.

Why:

- Minimal UI and accessibility surface.
- Preserves manual entry.
- Avoids building a custom combobox for a suggestion-only workflow.

## Decision 6: Correct default Claude provider settings template

Chosen approach: expose `buildDefaultClaudeProviderSettingsConfig()` and include managed top-level settings in addition to `env`.

Why:

- Some Claude Code settings are top-level settings and have no effect when placed inside `env`.
- Tests lock the template to prevent future regressions.
- Unsafe env defaults are intentionally omitted.

## Validation

Completed local validation:

```bash
npm run typecheck
npm exec -- vitest run \
  src/features/vendors/components/ProviderDialog.test.ts \
  src/features/vendors/components/ProviderDialog.fetch-models.test.tsx \
  src/features/vendors/components/ProviderList.test.tsx \
  src/features/vendors/hooks/useProviderManagement.test.tsx \
  src/services/tauri.test.ts
cargo test --manifest-path src-tauri/Cargo.toml vendors::commands::tests:: --quiet
```

Observed result:

- Frontend: 5 test files / 124 tests passed.
- Rust: 12 vendor command tests passed.

Manual validation still required before final archive:

- Drag non-active providers and restart app to confirm persistence.
- Switch active provider and confirm the previous active provider returns to its ordered position.
- Fetch models from a real compatible endpoint and confirm suggestions populate all three model inputs.
- Try invalid URL/key and confirm visible error feedback.

## Rollback

- Abort the no-commit merge with `git merge --abort` before commit.
- If already committed, revert the merge commit.
- To disable only model fetch UI later, remove the frontend button/datalist and Tauri wrapper while leaving provider ordering intact.
- To disable only reorder later, stop passing `onReorder`/DnD UI and keep backend `sortOrder` tolerant for compatibility.
