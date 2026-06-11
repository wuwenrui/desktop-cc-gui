## MODIFIED Requirements

### Requirement: Preset Catalog MUST Offer Popular VS Code Style Choices

系统 MUST 提供一组 curated 的 VS Code 风格 preset，覆盖浅色与深色常见选择。Preset catalog MUST remain stable, typed, localized, and selectable from the `custom` theme palette picker.

#### Scenario: preset catalog contains both dark and light popular themes

- **WHEN** 用户展开主题配色下拉
- **THEN** 系统 MUST 提供多套热门 VS Code 风格 preset
- **AND** 其中 MUST 同时包含 light 与 dark appearance 的可选项

#### Scenario: preset catalog includes expanded distinct palette choices

- **WHEN** 用户在 `custom` 模式下展开主题配色下拉
- **THEN** 系统 MUST include the existing preset catalog plus the following additional light appearance presets: Catppuccin Latte, Tokyo Day, Rose Pine Dawn, Everforest Light, and Ayu Light
- **AND** 系统 MUST include the following additional dark appearance presets: Dracula, Nord, Catppuccin Mocha, Tokyo Night, and Rose Pine
- **AND** 每个新增 preset MUST have a stable typed id, localized label key, complete color source map for the existing theme token mapper, and backend settings sanitize support

#### Scenario: selecting a preset updates custom theme identity

- **WHEN** 用户在 `custom` 模式下选择新的 preset
- **THEN** 系统 MUST 持久化新的 preset identity
- **AND** 当前 UI 配色 MUST 随之更新

#### Scenario: expanded presets preserve custom theme slot isolation

- **WHEN** 用户选择任一新增 preset
- **THEN** 系统 MUST update `customThemePresetId`
- **AND** 系统 MUST NOT mutate the saved `lightThemePresetId` or `darkThemePresetId` slots
- **AND** backend settings sanitize MUST preserve the new `customThemePresetId` instead of falling back to the default preset
- **AND** runtime appearance MUST continue to resolve from the selected preset's `light` or `dark` appearance
