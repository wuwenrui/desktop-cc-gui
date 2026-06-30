## ADDED Requirements

### Requirement: Provider Groups MUST Use Provider-Scoped Model Catalogs

The grouped Composer model selector MUST resolve each provider group from provider-scoped catalog facts rather than treating the active engine `models` array as the catalog for every provider.

#### Scenario: non-active Claude group has Claude catalog
- **WHEN** the active Composer provider is not `Claude Code`
- **AND** Claude Code has settings/env or user custom model entries
- **THEN** the grouped selector MUST include a Claude Code group
- **AND** that group MUST use Claude Code model entries instead of the active provider's model list

#### Scenario: non-active Codex group has Codex catalog
- **WHEN** the active Composer provider is not `Codex`
- **AND** Codex has built-in, config-derived, runtime, or user custom model entries
- **THEN** the grouped selector MUST include a Codex group
- **AND** that group MUST use Codex model entries instead of the active provider's model list

#### Scenario: provider footer action targets effective provider
- **WHEN** a provider group is rendered in the selector
- **THEN** add-model and refresh-config footer actions MUST remain scoped to the effective selected provider context
- **AND** refreshing a provider group MUST NOT start, stop, or restart a conversation runtime
