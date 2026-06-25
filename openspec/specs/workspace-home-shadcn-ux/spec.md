# workspace-home-shadcn-ux Specification

## Purpose

Defines the workspace-home-shadcn-ux behavior contract, covering 首页信息架构与首屏可达性.
## Requirements
### Requirement: 首页信息架构与首屏可达性

Workspace Home SHALL prioritize the Hero, workspace context, and Composer entry on the first screen.

#### Scenario: 首屏突出创建入口

- **GIVEN** 用户进入任意已加载完成的 Workspace Home
- **WHEN** 首页完成渲染
- **THEN** 页面 MUST 展示 Hero、workspace context、Composer 主入口
- **AND** 新建会话主操作 MUST 在首屏可见且可触达

#### Scenario: 首页不展示未成熟的最近会话入口

- **GIVEN** 首页接收到 recent conversations 数据
- **WHEN** Workspace Home 渲染
- **THEN** 首页 MUST NOT render recent conversation chips, grouped rows, or loading surface
- **AND** the primary Composer path MUST remain the dominant first-screen action
- **AND** other session history surfaces MAY continue to expose recent/completed sessions outside `HomeChat`.

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

### Requirement: 首页组件必须基于 shadcn/ui 语义构件

Workspace Home MUST 以 shadcn/ui primitives 作为首页主要交互与容器构件，减少同义自定义控件分叉。

#### Scenario: 首页入口使用语义化基础组件

- **GIVEN** 用户在首页查看核心入口区
- **WHEN** 页面展示主操作、引擎选择与入口卡片
- **THEN** 主操作 MUST 使用 Button 语义组件
- **AND** 引擎选择 MUST 使用 Select 语义组件
- **AND** 引导容器 MUST 使用 Card 语义组件 when that guide surface is present
