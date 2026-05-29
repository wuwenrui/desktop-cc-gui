## MODIFIED Requirements

### Requirement: 主题语义一致性与状态可读性

Workspace Home 在浅色与深色主题下 MUST 保持状态语义等价，避免仅依赖单一颜色传达状态。

#### Scenario: 状态语义在双主题下保持等价

- **GIVEN** 用户可切换浅色与深色主题
- **WHEN** 首页展示会话状态与风险操作状态
- **THEN** idle、processing、reviewing 状态 MUST 在两种主题下可区分
- **AND** danger 与 normal 操作 MUST 同时通过文字/形状/层级进行区分而非仅靠颜色

#### Scenario: 首页 composer submit action 保持 primary affordance

- **GIVEN** Workspace Home renders the embedded composer
- **WHEN** default, explicit light, or system-light theme styles apply
- **THEN** the composer submit button MUST preserve the canonical primary blue background
- **AND** hover styles MUST remain derived from the same primary submit-button contract instead of theme-specific neutral button colors
