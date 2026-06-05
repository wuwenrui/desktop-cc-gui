# Site Model Auto-Load Design

## Goal

Deep integration with our new-api site: auto-fetch available models via API key, let users select which to use, register into Claude + Codex engines.

## Architecture

```
User enters key → Rust calls new-api /v1/models → returns model list
                                                    ↓
                                          React SiteModelPicker UI
                                           ↓              ↓
                                     Claude engine      Codex engine
                                  (haiku/sonnet/opus)  (custom models)
                                           ↓              ↓
                                    provider config    localStorage
```

## Components

### 1. Rust: `fetch_site_models` command

- File: `src-tauri/src/vendors/commands.rs`
- Signature: `fetch_site_models(base_url: String, api_key: String) -> Vec<SiteModel>`
- Calls `GET {base_url}/v1/models` with `Authorization: Bearer {api_key}`
- Parses OpenAI-format response: `{ data: [{ id, owned_by }] }`
- Returns `Vec<{ id: String, owned_by: String }>`

### 2. React: `SiteModelPicker` component

- File: `src/features/vendors/components/SiteModelPicker.tsx`
- Props: `models`, `onConfirm(claude_slots, codex_models)`, `onCancel`, `loading`
- Layout:
  - Model list with search/filter
  - Claude section: 3 dropdowns for haiku/sonnet/opus slot mapping
  - Codex section: multi-select checkboxes
- Smart defaults: auto-suggest slot mapping based on model name patterns

### 3. Onboarding flow (2-step)

- File: `src/features/onboarding/OnboardingWizard.tsx`
- Step 1: Enter API key (existing)
- Step 2: Model selection via SiteModelPicker
- On confirm:
  - Claude: update provider env (ANTHROPIC_MODEL, ANTHROPIC_DEFAULT_*_MODEL)
  - Codex: write to localStorage `codex-custom-models`
  - Call `vendor_add_claude_provider` + `vendor_switch_claude_provider`

### 4. Settings page entry

- File: `src/features/vendors/components/VendorSettingsPanel.tsx`
- Add "Sync models from site" button in Claude + Codex tabs
- Opens SiteModelPicker in a dialog, pre-filled with current selections
- On confirm: update provider config + localStorage

## Data flow

### Claude engine
```
SiteModelPicker.onConfirm({ haiku: "model-a", sonnet: "model-b", opus: "model-c" })
  → provider.settingsConfig.env.ANTHROPIC_MODEL = "model-b"
  → provider.settingsConfig.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "model-a"
  → provider.settingsConfig.env.ANTHROPIC_DEFAULT_SONNET_MODEL = "model-b"
  → provider.settingsConfig.env.ANTHROPIC_DEFAULT_OPUS_MODEL = "model-c"
  → invoke("vendor_update_claude_provider", { id, updates })
```

### Codex engine
```
SiteModelPicker.onConfirm(_, ["model-x", "model-y"])
  → localStorage["codex-custom-models"] = [{ id, label }]
  → dispatch localStorageChange event
```

## Not in scope

- No changes to new-api backend (`/v1/models` already sufficient)
- No changes to Rust provider storage structure
- No changes to Codex custom model mechanism
- No Gemini engine support (this iteration)

## Success criteria

- Onboarding wizard fetches and displays models from site
- User can map models to Claude haiku/sonnet/opus slots
- User can select models for Codex engine
- Settings page allows re-syncing models
- All selections persist across app restarts
