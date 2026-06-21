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
