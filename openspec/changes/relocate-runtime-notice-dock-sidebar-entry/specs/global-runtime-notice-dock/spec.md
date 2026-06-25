## MODIFIED Requirements

### Requirement: App MUST Provide A Global Runtime Notice Dock Entry

系统 MUST 在 `client-ui-visibility-controls` 允许显示时提供一个 app-global runtime notice entry；该 entry 的数据源不属于任何单独页面、thread 或 workspace 子面板，但 desktop/tablet presentation MUST follow sidebar bottom action hierarchy。

#### Scenario: desktop and tablet entry uses sidebar bottom action group

- **WHEN** global runtime notice dock 的 visibility preference 为 visible，且客户端处于 desktop 或 tablet sidebar layout
- **THEN** 系统 MUST 将 minimized runtime notice entry 渲染为 sidebar bottom action group 中的 control
- **AND** 该 entry MUST 与 Settings trigger 处于同一 `.sidebar-bottom-nav` 层级

#### Scenario: phone layout keeps app-level fallback

- **WHEN** global runtime notice dock 的 visibility preference 为 visible，且客户端处于 phone compact layout
- **THEN** 系统 MUST 保留 app-level runtime notice entry fallback
- **AND** 该 fallback MUST NOT 依赖 projects tab/sidebar 当前是否可见

#### Scenario: global notice entry remains available across supported surfaces

- **WHEN** 用户在客户端内切换首页、对话区、设置页或其他已支持页面
- **THEN** 系统 MUST 保持 runtime notice entry 可达
- **AND** 该入口 MUST NOT 因页面切换而重新挂载成页面内局部组件

#### Scenario: first phase stays independent from status panel and runtime console

- **WHEN** 系统展示 global runtime notice dock entry
- **THEN** 系统 MUST 将其作为独立的 global notice dock entry 提供
- **AND** MUST NOT 把该能力收编为现有 `status panel` tab、`runtime console` 子视图或 Settings menu item

#### Scenario: appearance visibility can hide the dock

- **WHEN** 用户在基础外观页隐藏 global runtime notice dock
- **THEN** 系统 MUST 从 active UI 中移除最小化入口与展开态 panel
- **AND** MUST NOT 通过页面级特判或替代容器继续渲染该 dock

### Requirement: Global Runtime Notice Dock MUST Support Minimized Entry And Expandable Panel

系统 MUST 支持“最小化入口 + 展开面板”两种可见形态；desktop/tablet minimized entry MUST behave as a sidebar bottom icon action，phone fallback MAY remain app-level。

#### Scenario: minimized state uses stateful icon entry

- **WHEN** 客户端加载完成并展示全局 notice dock
- **THEN** 系统 MUST 在最小化状态显示一个 stateful icon entry
- **AND** 该 icon MUST 作为展开 notice 面板的唯一主入口

#### Scenario: minimized idle state communicates healthy status

- **WHEN** runtime notice dock 处于 minimized idle state
- **THEN** 系统 SHOULD use a success/healthy glyph such as `CircleCheck`
- **AND** MUST NOT use an ambiguous empty circle that can be mistaken for loading, radio selection, or missing state

#### Scenario: minimized notice and error states use distinct glyphs

- **WHEN** runtime notice dock 处于 minimized notice or error state
- **THEN** notice state SHOULD use a notice glyph such as `BellDot`
- **AND** error state SHOULD use an error glyph such as `CircleAlert`

#### Scenario: click entry expands the notice panel

- **WHEN** 用户点击 minimized runtime notice entry
- **THEN** 系统 MUST 展开提示框并展示当前 notice 内容
- **AND** 展开操作 MUST NOT 打断用户当前页面的主要工作流

#### Scenario: sidebar expanded panel uses compact popover

- **WHEN** desktop/tablet 用户从 sidebar bottom action group 展开 runtime notice panel
- **THEN** 系统 MUST 将 panel 渲染为 anchoring to that bottom action 的 compact popover
- **AND** panel 宽度 MUST 保持 viewport-safe，并 SHOULD use 560px as the default readable compact width unless a future spec changes the sidebar popover contract

#### Scenario: sidebar expanded panel escapes clipped ancestors

- **WHEN** desktop/tablet 用户从 sidebar bottom action group 展开 runtime notice panel
- **THEN** expanded panel MUST NOT remain trapped inside a sidebar overflow or stacking context that can clip the panel
- **AND** 系统 MAY render the panel through an app/body-level portal, provided the panel remains visually anchored to the runtime notice action

#### Scenario: expanded panel can be minimized again

- **WHEN** 用户在展开态点击 `最小化`
- **THEN** 系统 MUST 折叠回最小化入口
- **AND** 后续 notice push MUST 继续进入同一 feed

#### Scenario: new notices do not auto-expand the dock

- **WHEN** notice dock 处于最小化状态且有新的 notice 到达
- **THEN** 系统 MUST NOT 自动展开提示框
- **AND** 新状态 MUST 仅通过最小化入口的高亮语义反馈给用户

#### Scenario: first phase minimized state uses highlight instead of unread count

- **WHEN** 第一阶段最小化状态收到新的 notice 或 error
- **THEN** 系统 MUST 使用 `streaming` 或 `has-error` 等高亮语义提示变化
- **AND** MUST NOT 展示数字型未读角标

### Requirement: Notice Rows MUST Use A Compact Summary Layout With Lightweight Timestamp

notice 行 MUST 保持紧凑、可扫描的摘要结构，以支持快速理解与时间顺序判断；在 sidebar compact popover 中，长文案 MAY wrap to preserve readability。

#### Scenario: each row shows severity cue, summary copy, and timestamp

- **WHEN** 系统渲染任意一条 notice
- **THEN** 该行 MUST 展示 severity 视觉提示、摘要文案与低权重时间戳
- **AND** 时间戳 MUST 使用轻量格式，例如 `HH:mm:ss`

#### Scenario: long notice copy remains readable in sidebar compact popover

- **WHEN** 某条 notice 文案长度超过 sidebar compact popover 的可用空间
- **THEN** 系统 MUST 允许文案换行或断词以保持可读
- **AND** MUST NOT 让长文案横向撑破 sidebar popover 或覆盖相邻 chrome
