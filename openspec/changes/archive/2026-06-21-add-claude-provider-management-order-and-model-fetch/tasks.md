## 1. Backend

- [x] 1.1 Add optional `sortOrder` / `sort_order` to Claude provider data models.
- [x] 1.2 Sort Claude providers by `sortOrder`, falling back to `createdAt` and id.
- [x] 1.3 Add `vendor_reorder_claude_providers` Tauri command.
- [x] 1.4 Add `vendor_fetch_claude_models` Tauri command.
- [x] 1.5 Register new vendor commands in `command_registry.rs`.
- [x] 1.6 Extend provider managed fields for top-level Claude Code settings.
- [x] 1.7 Add Rust tests for provider ordering and model endpoint candidate derivation.

## 2. Frontend

- [x] 2.1 Add Tauri service wrappers for reorder and model fetch.
- [x] 2.2 Add optimistic provider reorder handling in `useProviderManagement`.
- [x] 2.3 Render local and active Claude provider cards outside the draggable list.
- [x] 2.4 Add drag handles for non-active managed Claude provider cards.
- [x] 2.5 Add model fetch button, loading/error state, and shared datalist in `ProviderDialog`.
- [x] 2.6 Correct default Claude provider settings template.
- [x] 2.7 Add i18n strings and CSS for reorder/model fetch UI.

## 3. Tests

- [x] 3.1 Add `ProviderList` reorder tests.
- [x] 3.2 Add `useProviderManagement` reorder success/failure tests.
- [x] 3.3 Add `ProviderDialog` default template test.
- [x] 3.4 Add `ProviderDialog` model fetch UI test.
- [x] 3.5 Add Tauri wrapper mapping tests.
- [x] 3.6 Run `npm run typecheck`.
- [x] 3.7 Run focused vendor Vitest suite.
- [x] 3.8 Run focused Rust vendor command tests.

## 4. Documentation / Governance

- [x] 4.1 Backfill implementation plans with actual landed behavior and validation evidence.
- [x] 4.2 Preserve repository `AGENTS.md` zsh Shell Baseline; exclude PR's Windows-only rule regression from final staged diff.
- [x] 4.3 Add this OpenSpec change as the behavior-spec record for the current staged implementation.

## 5. Manual Validation Before Archive

- [ ] 5.1 Drag non-active Claude providers, restart app, and confirm order persists.
- [ ] 5.2 Switch active provider and confirm previous active provider returns to its stored position.
- [ ] 5.3 Fetch models from a real Claude-compatible endpoint and confirm suggestions appear on all model mapping inputs.
- [ ] 5.4 Try invalid API URL/key and confirm error feedback is visible and editable state remains usable.

## Archive decision 2026-06-21

- Code evidence reviewed for archive:
  - Backend provider order and persistence: `src-tauri/src/vendors/commands.rs` parses/writes `sortOrder`, sorts by `sortOrder -> createdAt -> id`, and persists reorder through `vendor_reorder_claude_providers`.
  - Backend model fetch: `vendor_fetch_claude_models` derives `/v1/models` endpoint candidates, uses Rust `reqwest`, parses common response shapes, and returns the successful endpoint.
  - Frontend provider order: `ProviderList` renders local and active provider cards outside the draggable list; only non-active managed providers get drag handles.
  - Frontend persistence rollback: `useProviderManagement` sends full ordered ids and reloads providers on persistence failure.
  - Frontend model suggestions: `ProviderDialog` fetches with current unsaved API URL/key and exposes fetched ids through the shared `vendor-fetched-models` datalist for Sonnet, Opus, and Haiku inputs.
- Automated validation run for archive:
  - `npx vitest run src/features/vendors/components/ProviderList.test.tsx src/features/vendors/components/ProviderDialog.fetch-models.test.tsx src/features/vendors/hooks/useProviderManagement.test.tsx src/services/tauri.test.ts` passed with 123 tests.
- Manual validation caveat:
  - 5.1 and 5.2 are covered by code review plus component/hook tests, but no Tauri app restart was performed in this session.
  - 5.3 was not executed against a real external Claude-compatible endpoint because no live endpoint/key was provided.
  - 5.4 was validated at code-path level for missing URL/backend error display, but no live invalid credential request was sent.
  - Archive proceeds with this caveat; a product QA pass with real credentials can be tracked separately if needed.
