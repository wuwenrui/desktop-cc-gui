# settings-custom-theme-presets Specification

## Purpose

Defines the settings-custom-theme-presets behavior contract, covering Settings MUST Expose A Dedicated Custom Theme Mode.
## Requirements
### Requirement: Settings MUST Expose A Dedicated Custom Theme Mode

系统 MUST 在现有 `system / light / dark` 之外提供 `custom` 主题模式，用于承载 preset 化主题配色选择。

#### Scenario: custom theme mode is visible in appearance settings

- **WHEN** 用户打开外观设置
- **THEN** 系统 MUST 展示 `自定义` 主题选项
- **AND** 当前激活主题 MUST 保持可识别状态

#### Scenario: preset selector appears only for custom mode

- **WHEN** 用户未选择 `custom` 主题模式
- **THEN** 系统 MUST NOT 展示主题配色下拉
- **WHEN** 用户切换到 `custom`
- **THEN** 系统 MUST 展示主题配色下拉并允许直接选择 preset

### Requirement: Custom Theme Presets MUST Preserve The Existing Light/Dark Runtime Contract

`custom` 主题模式 MUST 在 runtime 层解析为 preset 对应的 `light` 或 `dark` appearance，而不是把 `custom` 直接传播到下游渲染 contract。

#### Scenario: custom preset resolves to dark appearance safely

- **WHEN** 用户选择一个 dark appearance 的 preset
- **THEN** 系统 MUST 继续把运行时 appearance 解析为 `dark`
- **AND** 依赖 `data-theme` 的组件 MUST 不需要理解 `custom` 字面值也能继续工作

#### Scenario: custom preset resolves to light appearance safely

- **WHEN** 用户选择一个 light appearance 的 preset
- **THEN** 系统 MUST 把运行时 appearance 解析为 `light`
- **AND** window appearance、Mermaid、Markdown preview、terminal 等 light/dark 观察方 MUST 继续可用

#### Scenario: invalid persisted preset falls back

- **WHEN** 持久化的 `customThemePresetId` 缺失或无效
- **THEN** 系统 MUST 回退到一个有效默认 preset
- **AND** 启动与设置保存流程 MUST 继续正常工作

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

### Requirement: Appearance Settings MUST Control Whole-Client Window Transparency

系统 MUST 在外观设置中提供客户端整体窗口透明度控制，并保持主题模式与主题 preset 的既有语义不变。

#### Scenario: window transparency controls are visible in appearance settings

- **WHEN** 用户打开 `设置 -> 基础设置 -> 外观`
- **THEN** 系统 MUST 展示窗口透明开关
- **AND** 当前开关状态 MUST 与持久化偏好一致

#### Scenario: enabling window transparency applies immediately

- **WHEN** 用户打开窗口透明开关
- **THEN** 系统 MUST 在当前窗口即时调用 native window opacity 能力
- **AND** 应用重启 MUST NOT be required
- **AND** 系统 MUST NOT 通过 renderer `.app` CSS opacity 或局部 panel/surface alpha 来替代 native 窗口透明

#### Scenario: whole-window opacity is configurable when enabled

- **WHEN** 窗口透明已开启
- **THEN** 系统 MUST 展示整体透明度 slider
- **AND** 用户调整百分比后系统 MUST 持久化透明度并即时更新 native 当前窗口
- **AND** 透明度 MUST 被限制在可读范围内

#### Scenario: invalid window opacity falls back safely

- **WHEN** 持久化的整体透明度缺失、非法或越界
- **THEN** 系统 MUST 使用安全默认透明度
- **AND** 设置页与主界面 MUST 保持可用

### Requirement: Whole-Client Transparency MUST Be Cross-Platform Safe

系统 MUST 在 Windows、macOS、Linux 上安全处理窗口透明能力，native/window effect 不可用时必须降级而不是中断 UI。

#### Scenario: transparent window support is available

- **WHEN** 当前平台与运行环境支持 native window opacity
- **THEN** 系统 SHOULD 透出窗口背后的桌面/应用内容
- **AND** `.app` 根节点 MUST NOT 使用 CSS opacity 模拟窗口透明

#### Scenario: transparent window support is unavailable

- **WHEN** 当前平台、compositor 或运行环境不支持 native window opacity
- **THEN** 系统 MAY 退化为普通不透明窗口
- **AND** 用户操作、设置保存与窗口渲染 MUST 继续正常工作

#### Scenario: native window opacity call fails

- **WHEN** native window opacity 调用失败
- **THEN** 系统 MUST 记录可诊断信息
- **AND** MUST NOT 抛出未处理异常、白屏或阻止设置保存

### Requirement: Window Transparency Changes MUST Respect Large File Governance

窗口透明实现涉及 stylesheet 或窗口配置时，系统 MUST 遵守 large-file governance workflow 的 near-threshold 与 hard gate 约束。

#### Scenario: stylesheet changes are validated by large file sentry

- **WHEN** 窗口透明改动修改 CSS 或相关测试治理文件
- **THEN** 验证流程 MUST include large-file sentry commands aligned with `.github/workflows/large-file-governance.yml`
- **AND** 新增样式 SHOULD remain scoped and minimal instead of expanding already-large files unnecessarily

