# claude-provider-management Specification

## Purpose

Defines Claude provider management behavior for managed provider ordering, backend-driven model discovery, and safe default provider settings.

## Requirements

### Requirement: Claude provider order SHALL be user-controlled and activation-safe

The system SHALL allow users to persistently reorder managed Claude providers without changing the active provider and without making local or active provider cards draggable.

#### Scenario: local provider remains pinned
- **WHEN** the Claude provider list is rendered
- **THEN** the `Local settings.json` provider SHALL appear before managed providers
- **AND** it SHALL NOT be included in the draggable provider list

#### Scenario: active provider remains pinned outside draggable list
- **WHEN** a managed Claude provider is active
- **THEN** the active provider SHALL render above non-active managed providers
- **AND** the active provider SHALL NOT expose a drag handle
- **AND** dragging non-active providers SHALL NOT change which provider is active

#### Scenario: non-active provider reorder is persisted
- **WHEN** the user drags a non-active managed Claude provider to a new position
- **THEN** the frontend SHALL send the full managed provider id order to the backend
- **AND** the backend SHALL persist deterministic `sortOrder` values for existing managed providers
- **AND** missing or legacy `sortOrder` values SHALL fall back to `createdAt` order for migration compatibility

#### Scenario: previous active provider returns to stored position
- **WHEN** the user switches active provider after providers have been reordered
- **THEN** the newly active provider SHALL be visually pinned
- **AND** the previously active provider SHALL return to its persisted order among non-active providers

#### Scenario: reorder failure rolls back from durable state
- **WHEN** persisting a Claude provider reorder fails
- **THEN** the frontend SHALL reload providers from the backend
- **AND** the visible order SHALL return to the durable backend state

### Requirement: Claude provider model fetch SHALL use backend networking and suggestion-only UI

The system SHALL fetch Claude-compatible model suggestions through a Rust Tauri command using the dialog's current API URL and API key, and SHALL present returned models as optional suggestions for the model mapping inputs.

#### Scenario: model fetch uses current unsaved dialog values
- **WHEN** the user clicks `Fetch models` in the Claude provider dialog
- **THEN** the request SHALL use the currently entered API URL and API key
- **AND** the provider SHALL NOT need to be saved before fetching models

#### Scenario: model fetch is routed through Rust backend
- **WHEN** the frontend requests Claude provider models
- **THEN** it SHALL invoke `vendor_fetch_claude_models`
- **AND** the backend SHALL perform the HTTP request with native networking rather than frontend `fetch()`

#### Scenario: backend tries compatible model list endpoints
- **WHEN** the backend receives a non-empty provider base URL
- **THEN** it SHALL derive ordered `/v1/models` endpoint candidates
- **AND** it SHALL return the first endpoint with a successful parseable model response
- **AND** it SHALL include the successful endpoint in the result

#### Scenario: model ids are extracted from common response shapes
- **WHEN** a provider model response contains `data`, a top-level array, or `models`
- **THEN** the backend SHALL extract non-empty string model ids
- **AND** duplicate model ids SHALL be removed while preserving first-seen order

#### Scenario: fetched models remain optional suggestions
- **WHEN** model ids are fetched successfully
- **THEN** the Sonnet, Opus, and Haiku model inputs SHALL expose those ids through a shared datalist
- **AND** users SHALL still be able to type model ids manually

#### Scenario: fetch errors are visible
- **WHEN** the API URL is missing, all endpoints fail, HTTP status is unsuccessful, or JSON parsing fails
- **THEN** the dialog SHALL show a diagnosable error or empty-result message
- **AND** the dialog SHALL remain editable

### Requirement: Claude provider defaults SHALL preserve managed settings shape

The system SHALL create new Claude provider settings from a complete managed template that separates top-level Claude Code settings from environment variables.

#### Scenario: default template includes top-level settings
- **WHEN** the user creates a new Claude provider
- **THEN** the default JSON config SHALL include managed top-level fields such as `alwaysThinkingEnabled`, `autoDreamEnabled`, `cleanupPeriodDays`, `effortLevel`, `hasCompletedOnboarding`, `language`, `model`, `skipAutoPermissionPrompt`, `teammateMode`, and `tui`
- **AND** those fields SHALL NOT be nested under `env`

#### Scenario: default template includes tiered model env values
- **WHEN** the default Claude provider JSON config is generated
- **THEN** the `env` object SHALL include tier-specific model variables for Haiku, small-fast, Sonnet, and Opus defaults
- **AND** the provider dialog SHALL keep manual model mapping edits synchronized with the JSON config

#### Scenario: unsafe env defaults are excluded
- **WHEN** the default Claude provider JSON config is generated
- **THEN** it SHALL NOT include `CLAUDE_CODE_ATTRIBUTION_HEADER`
- **AND** it SHALL NOT include `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`

#### Scenario: managed fields are written as managed settings
- **WHEN** a Claude provider is saved with managed top-level settings
- **THEN** the backend SHALL recognize those fields as provider-managed settings
- **AND** it SHALL write them to the provider settings shape without incorrectly treating them as environment variables
