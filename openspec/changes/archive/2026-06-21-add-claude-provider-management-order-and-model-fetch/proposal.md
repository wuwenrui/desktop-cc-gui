## Why

Claude Code provider management currently lacks two operator-grade workflows: users cannot persist their preferred provider order, and they must manually type model ids when configuring third-party Claude-compatible endpoints. The implemented PR adds these workflows and also corrects the default provider settings template so new Claude providers start from a complete, managed settings shape.

## 目标与边界

- Allow users to reorder Claude provider cards while keeping `Local settings.json` and the active provider pinned outside the draggable list.
- Allow users to fetch model suggestions from the current provider API URL/API key through the Rust backend, avoiding WebView CORS and preserving proxy/runtime behavior.
- Persist Claude provider `sortOrder` without changing provider activation semantics.
- Correct default Claude provider settings so top-level Claude Code fields are managed as top-level settings, not incorrectly nested inside `env`.
- Keep scope limited to Claude provider management. Codex/Gemini provider management is not changed by this proposal.

## 非目标

- Do not introduce a global provider marketplace or provider discovery registry.
- Do not change Codex provider-scoped runtime behavior.
- Do not replace manual model entry; fetched models are suggestions only.
- Do not make the active Claude provider draggable.
- Do not change OpenSpec/Trellis shell baseline or host execution rules.

## What Changes

- Add persisted Claude provider `sortOrder` to Rust and TypeScript provider models.
- Add `vendor_reorder_claude_providers` Tauri command and frontend wrapper.
- Render Claude provider list as: local provider pinned first, active provider pinned second, non-active providers draggable.
- Add `vendor_fetch_claude_models` Tauri command and frontend wrapper.
- Add a provider-dialog "Fetch models" action that uses a shared native `<datalist>` for Sonnet/Opus/Haiku model inputs.
- Expand the default Claude provider settings template and managed-field list.
- Add focused frontend and Rust tests for reorder, model fetch mapping, default template, and backend helper behavior.
- Preserve the repository `AGENTS.md` zsh shell baseline after review; the PR's Windows-only `pwsh` change is intentionally excluded from final staged diff.

## Capabilities

### New Capabilities

- `claude-provider-management`: Claude provider list ordering, model suggestion fetching, and provider settings template behavior.

### Modified Capabilities

- None.

## Impact

- Frontend:
  - `src/features/vendors/components/ProviderList.tsx`
  - `src/features/vendors/components/ProviderDialog.tsx`
  - `src/features/vendors/hooks/useProviderManagement.ts`
  - `src/features/vendors/types.ts`
  - `src/services/tauri.ts`
  - `src/services/tauri/vendors.ts`
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`
  - `src/styles/settings.part1.vendor-panels.css`
  - `src/styles/settings.vendor-dialog.css`
- Backend:
  - `src-tauri/src/vendors/commands.rs`
  - `src-tauri/src/command_registry.rs`
  - `src-tauri/src/types.rs`
- Tests:
  - `src/features/vendors/components/ProviderList.test.tsx`
  - `src/features/vendors/components/ProviderDialog.test.ts`
  - `src/features/vendors/components/ProviderDialog.fetch-models.test.tsx`
  - `src/features/vendors/hooks/useProviderManagement.test.tsx`
  - `src/services/tauri.test.ts`
  - Rust tests under `vendors::commands::tests`
- Documentation:
  - `docs/plans/2026-06-20-claude-provider-drag-reorder.md`
  - `docs/plans/2026-06-20-claude-provider-fetch-models.md`

## 技术方案对比

| Option | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Persist provider order in existing provider JSON via `sortOrder` | Minimal migration; preserves `createdAt` fallback; no extra storage file | Chosen |
| B | Store order in a separate array under global Claude config | Separates order from provider record, but introduces drift when providers are deleted/imported | Rejected |
| C | Fetch models from frontend `fetch()` | Simpler UI code, but breaks on CORS/proxy and exposes inconsistent runtime networking | Rejected |
| D | Fetch models via Rust Tauri command | Uses native networking, avoids CORS, keeps errors diagnosable | Chosen |

## Acceptance Criteria

- `Local settings.json` remains pinned above every managed Claude provider and is never draggable.
- The active Claude provider is pinned above non-active managed providers and is never draggable.
- Dragging a non-active provider persists a deterministic order and does not change the active provider.
- Successful reorder keeps the optimistic UI order without a flicker-causing refetch; failed persistence reloads providers to roll back.
- Model fetch uses current unsaved `apiUrl` and `apiKey`, calls Rust backend, and populates datalist suggestions without blocking manual entry.
- Empty model results and request failures produce visible, diagnosable UI feedback.
- New Claude provider defaults include managed top-level Claude Code settings and do not include unsafe env defaults.
- Focused TypeScript and Rust tests pass.
