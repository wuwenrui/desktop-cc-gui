## MODIFIED Requirements

### Requirement: 首页信息架构与首屏可达性

Workspace Home SHALL prioritize the Hero, workspace context, and Composer entry on the first screen.

#### Scenario: 首页不展示未成熟的最近会话入口

- **GIVEN** 首页接收到 recent conversations 数据
- **WHEN** Workspace Home 渲染
- **THEN** 首页 MUST NOT render recent conversation chips, grouped rows, or loading surface
- **AND** the primary Composer path MUST remain the dominant first-screen action
- **AND** other session history surfaces MAY continue to expose recent/completed sessions outside `HomeChat`.
