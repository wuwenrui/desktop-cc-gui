## Why

Codex / Claude Code model selector behavior regressed because the grouped selector treats the current engine model list as if it were every provider's catalog, while Codex provider-scoped custom models are only one-time migrated into the global custom model store. At the same time, the model-selector `刷新配置` path calls Codex runtime reload, which can stop a running Codex conversation with `settings_restart`.

This is urgent because model catalog refresh and provider management are low-risk configuration actions, but they currently share a destructive lifecycle path with runtime restart.

## 目标与边界

- Restore user-added custom model visibility for Codex and Claude Code model selectors.
- Keep Codex provider-scoped custom models visible after adding or editing providers.
- Make model catalog refresh a non-disruptive catalog refresh operation.
- Preserve explicit Codex runtime reload as a separate settings action for external config changes.
- Keep existing thread-bound provider runtime behavior unchanged.

## 非目标

- Do not redesign the Composer control surface.
- Do not change Codex provider-scoped `CODEX_HOME` launch semantics.
- Do not change Claude Code send-time model resolution beyond preserving existing custom catalog entries.
- Do not touch HomeChat / recent conversation UI work already in progress.

## What Changes

- Split Codex model catalog refresh from runtime config reload: `刷新配置` refreshes model/config catalog only and MUST NOT restart connected Codex runtimes.
- Ensure Codex dynamic/hydrated model catalogs still merge user custom models without duplicate rows.
- Synchronize Codex provider-scoped `customModels` into the composer-visible custom model catalog after add/edit/load.
- Pass provider model groups enough per-provider catalog data so Claude Code and Codex groups can remain visible instead of depending on the current engine's `models` prop.
- Guard legacy Codex provider switch paths from implicit runtime reload side effects.

## 技术方案选项

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. Minimal hotfix | Remove runtime reload from Codex model refresh and re-merge custom models in `modelOptions` | Fastest stop-the-bleeding path, but provider groups can still depend on current-engine catalog shape |
| B. Provider catalog contract | Add explicit per-provider catalog inputs to grouped selector and keep runtime reload only behind explicit settings action | Slightly more code, but matches existing provider-group UI contract and prevents recurrence |
| C. Backend unified catalog | Create one backend command returning all provider catalogs and custom models | Strong contract long-term, but too broad for this regression and risks cross-layer churn |

Chosen: **B**. It fixes the current breakage without adding a new backend command or changing runtime launch semantics.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `composer-model-selector-config-actions`: clarify that provider config refresh is catalog-only and must not restart connected Codex runtimes.
- `composer-control-surface`: clarify provider-grouped selector must use provider-scoped catalog facts, not only the current engine's model list.
- `claude-dynamic-model-discovery`: preserve Claude custom models in grouped selector surfaces.
- `codex-provider-scoped-session-launch`: preserve provider-scoped Codex custom models as model catalog facts without treating provider management as a global active-provider switch.

## Impact

- Frontend:
  - `src/features/models/refreshCodexModelConfig.ts`
  - `src/app-shell-parts/useModelConfigRefresh.ts`
  - `src/app-shell-parts/useAppShellComposerModelSection.ts`
  - `src/features/composer/components/ChatInputBox/modelOptions.ts`
  - `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`
  - `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx`
  - `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`
  - `src/features/vendors/hooks/useCodexProviderManagement.ts`
  - focused tests for the changed catalog and refresh contracts.
- Backend:
  - No Rust command behavior change is expected.
- Dependencies:
  - No new dependency.

## 验收标准

- Codex model selector shows user custom models even when runtime/dynamic models are already hydrated.
- Claude Code model selector/group keeps user custom models visible.
- Codex provider-scoped `customModels` become visible after provider add/edit/load without relying on a one-time migration marker.
- Clicking model selector `刷新配置` for Codex does not call `reload_codex_runtime_config`.
- Explicit settings-page Codex runtime reload still calls `reload_codex_runtime_config`.
- Focused Vitest suites and TypeScript checks pass.
