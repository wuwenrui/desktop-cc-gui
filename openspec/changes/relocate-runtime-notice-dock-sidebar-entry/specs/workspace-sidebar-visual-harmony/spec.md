## ADDED Requirements

### Requirement: Sidebar Bottom Actions MUST Preserve Sibling Hierarchy

系统 MUST 将 sidebar 底部 icon actions 作为同一层级的 sibling controls 渲染，避免用 app-level fixed positioning 伪装成同层视觉。

#### Scenario: settings and runtime notice entries share bottom action group

- **WHEN** sidebar 在 desktop 或 tablet layout 中渲染 bottom actions
- **THEN** Settings trigger 与 runtime notice entry MUST 同属 `.sidebar-bottom-nav`
- **AND** runtime notice entry MUST NOT 通过 fixed/calc 坐标贴近 Settings trigger 来伪装层级

#### Scenario: settings remains the first bottom action

- **WHEN** sidebar bottom actions 同时包含 Settings trigger 与 runtime notice entry
- **THEN** Settings trigger MUST 排在 runtime notice entry 前面
- **AND** 该顺序 MUST 保持稳定，避免破坏用户已有操作记忆

#### Scenario: runtime notice popover stays scoped to bottom action

- **WHEN** 用户从 sidebar bottom action 展开 runtime notice panel
- **THEN** panel MUST anchor to the runtime notice action and render as a compact popover above the bottom action group
- **AND** panel MUST NOT use the app-global right-bottom dock width in sidebar context

#### Scenario: runtime notice popover can escape sidebar clipping

- **WHEN** sidebar bottom action group or its ancestors create overflow/stacking boundaries
- **THEN** runtime notice expanded panel MAY render outside the sidebar DOM subtree through a portal layer
- **AND** minimized runtime notice entry MUST remain a sibling of Settings inside `.sidebar-bottom-nav`
