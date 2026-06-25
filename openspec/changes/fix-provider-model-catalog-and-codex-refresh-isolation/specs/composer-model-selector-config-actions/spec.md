## ADDED Requirements

### Requirement: Codex Selector Refresh MUST Be Catalog-Only

The composer model selector `刷新配置` action for Codex MUST refresh Codex model catalog facts without restarting, replacing, stopping, or disconnecting connected Codex runtimes.

#### Scenario: Codex selector refresh does not reload runtime
- **WHEN** the current provider is `Codex`
- **AND** the user clicks the model selector `刷新配置` action
- **THEN** the system MUST refresh the Codex model list and config-derived model
- **AND** it MUST NOT call `reload_codex_runtime_config`

#### Scenario: explicit settings runtime reload remains available
- **WHEN** the user clicks the explicit Codex runtime reload action in settings
- **THEN** the system MAY call `reload_codex_runtime_config`
- **AND** the action MUST remain visually distinct from the model selector `刷新配置` action

#### Scenario: refresh while Codex turn is running
- **WHEN** a Codex runtime has active foreground work
- **AND** the user refreshes the Codex model selector catalog
- **THEN** the running conversation MUST remain connected
- **AND** the user MUST NOT receive a runtime-ended notice with `shutdownSource=settings_restart` solely because of that catalog refresh

### Requirement: Codex Custom Models MUST Survive Hydrated Catalogs

Codex model selector catalog composition MUST keep user custom models visible even when the parent already supplies a hydrated runtime or config-derived model catalog.

#### Scenario: custom model appears with dynamic catalog
- **WHEN** the parent composer passes a non-empty Codex model catalog
- **AND** the user has a Codex custom model
- **THEN** the selector MUST include the custom model
- **AND** it MUST not duplicate equivalent runtime choices

#### Scenario: custom label wins for matching model id
- **WHEN** a Codex custom model has the same model id as a runtime or built-in model
- **THEN** the visible option MUST preserve the custom model label
- **AND** the selector MUST keep only one selectable row for that model identity
