## ADDED Requirements

### Requirement: Thread rows MUST provide hover preview cards

系统 MUST 在线程行 hover 或 keyboard focus 时提供轻量预览卡，使用户无需打开会话即可判断会话标题、运行状态、引擎来源、更新时间与所属工作区。

#### Scenario: normal thread row hover preview

- **GIVEN** 侧栏渲染普通 thread row
- **WHEN** 用户 hover 或 keyboard focus 该 row
- **THEN** 系统 MUST 展示 thread preview card
- **AND** preview card MUST include thread title, status/updated time, engine/source label, and workspace path when available

#### Scenario: pinned thread row hover preview

- **GIVEN** 侧栏渲染 pinned thread row
- **WHEN** 用户 hover 或 keyboard focus 该 row
- **THEN** 系统 MUST 展示与普通 thread row 一致的 preview card
- **AND** MUST NOT change pin, context-menu, selection, or delete-confirm behavior
