# workspace-session-attribution-mode Specification

## Purpose
TBD - created by archiving change add-session-attribution-mode-setting. Update Purpose after archive.
## Requirements
### Requirement: Settings SHALL Expose Workspace Session Attribution Mode

系统 SHALL 在 `设置 > 会话管理` 中提供 workspace session attribution mode 单选按钮组，让用户选择 workspace 会话拉取口径。

#### Scenario: settings renders attribution mode choices
- **WHEN** 用户打开 `设置 > 会话管理`
- **THEN** 系统 SHALL 展示 `相关会话模式` 与 `当前工作区模式` 两个互斥选项
- **AND** UI SHALL 为每个选项展示可理解的说明文案

#### Scenario: user selection is persisted
- **WHEN** 用户选择任一 workspace session attribution mode
- **THEN** 系统 SHALL 持久化该选择
- **AND** 下一次应用启动或刷新设置时 SHALL 恢复同一选择

### Requirement: Related Mode SHALL Remain The Default Compatibility Mode

系统 SHALL 将 `related` 作为缺省 workspace session attribution mode，并保持当前宽松相关会话发现行为。

#### Scenario: missing setting uses related mode
- **GIVEN** 现有用户配置中不存在 `sessionAttributionMode`
- **WHEN** 应用读取设置
- **THEN** 系统 SHALL 使用 `related` 模式
- **AND** workspace 会话拉取结果 SHALL 与新增设置前的默认行为兼容

#### Scenario: related mode preserves broad discovery
- **WHEN** 用户选择 `相关会话模式`
- **THEN** 系统 SHALL 保留当前 related discovery 能力
- **AND** 系统 SHALL NOT 因 `workspace-only` 模式存在而缩窄 `related` 模式的候选集或归因结果

### Requirement: Workspace-Only Mode SHALL Be Applied Consistently Across Session Surfaces

系统 SHALL 将用户选择的 workspace session attribution mode 应用于 sidebar、Workspace Home、Session Management、Session Radar hydration 与 prewarm 相关路径。

#### Scenario: mode is shared by default session surfaces
- **WHEN** 用户切换 workspace session attribution mode
- **THEN** sidebar、Workspace Home 与 Session Management SHALL 使用同一 mode 解释 workspace session membership
- **AND** 这些 surface 的差异 SHALL 只来自分页、展示窗口或显式过滤器，而不是不同归因规则

#### Scenario: radar prewarm respects attribution mode
- **WHEN** Session Radar 或 idle prewarm 触发 workspace thread hydration
- **THEN** hydration request SHALL 携带当前 workspace session attribution mode
- **AND** prewarm SHALL NOT 使用不同 mode 写入当前 workspace 的 thread list membership

#### Scenario: radar remains global but membership stays scoped
- **WHEN** Session Radar 展示多个 workspace 的 running 或 recent session 状态
- **THEN** Radar MAY continue presenting a global multi-workspace feed
- **AND** each workspace entry SHALL be derived from that workspace's mode-aware membership instead of active-workspace related discovery

### Requirement: Attribution Mode SHALL Apply To All Workspace Session Engines

Workspace session attribution mode SHALL apply to every engine that contributes sessions to workspace membership, including Claude, Codex, Gemini, OpenCode, and future session engines.

#### Scenario: all engine adapters receive effective mode
- **WHEN** backend builds workspace session membership
- **THEN** each participating engine adapter SHALL receive the effective workspace session attribution mode
- **AND** no engine adapter SHALL use an implicit default that differs from the projection request

#### Scenario: non-Claude engine cannot bypass workspace-only mode
- **WHEN** projection runs in `workspace-only` mode
- **AND** a Codex, Gemini, OpenCode, or future engine session belongs to another workspace scope
- **THEN** that session SHALL NOT enter the selected workspace membership through an engine-specific native listing bypass
- **AND** the engine result SHALL be reconciled through the shared mode-aware projection

#### Scenario: related mode preserves all-engine compatibility
- **WHEN** projection runs in `related` mode
- **THEN** existing engine-specific session discovery behavior SHALL remain compatible for Claude, Codex, Gemini, OpenCode, and future engines
- **AND** adding `workspace-only` SHALL NOT narrow related-mode results for any engine

### Requirement: Workspace-Only Mode SHALL Prefer Isolation Over Recovery

`workspace-only` 模式 SHALL 优先保证当前 workspace 会话隔离，而不是最大化找回可能相关的历史会话。

#### Scenario: workspace-only copy explains trade-off
- **WHEN** 用户查看 `当前工作区模式` 说明
- **THEN** UI SHALL 说明该模式会减少跨项目混入
- **AND** UI SHALL 说明如需找回更多相关历史会话可切回 `相关会话模式`

#### Scenario: user can return to related mode
- **GIVEN** 用户已经启用 `workspace-only` 模式
- **WHEN** 用户选择 `相关会话模式`
- **THEN** 系统 SHALL 恢复宽松相关会话发现行为
- **AND** 不需要迁移或删除已有 session metadata

