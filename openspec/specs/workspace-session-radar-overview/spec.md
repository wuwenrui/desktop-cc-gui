# workspace-session-radar-overview Specification

## Purpose
定义 Session Radar 跨项目会话聚合、最近完成追踪与快速跳转的稳定契约，确保高并发更新下的可读性与确定性。
## Requirements
### Requirement: Session Radar SHALL Aggregate Running And Recently Completed Sessions Across Projects
系统 SHALL 在 Session Radar 视图中聚合跨项目会话状态，至少覆盖进行中与最近完成两类会话；其中“最近完成”集合 MUST 支持受控清理，并与管理视图保持一致。

#### Scenario: aggregate running sessions across visible workspaces
- **WHEN** 用户打开 Session Radar 视图
- **THEN** 系统 SHALL 展示所有可见 workspace 中的进行中会话
- **AND** 每条会话 SHALL 包含 workspace 名称、thread 名称、引擎标识与更新时间

#### Scenario: include recently completed sessions in bounded window
- **WHEN** 某会话从 processing 切换为 completed
- **THEN** 系统 SHALL 将其加入“最近完成”列表
- **AND** 该列表 SHALL 受时间窗与条数上限约束

#### Scenario: removed recent-completed item does not reappear without new completion event
- **WHEN** 用户在雷达历史管理中删除某条最近完成记录
- **THEN** 该记录 MUST 从 Session Radar 最近完成列表移除
- **AND** 在该会话未产生新的 completed 事件前，系统 MUST NOT 将该记录回填到最近完成列表

### Requirement: Session Radar SHALL Provide History Management Entry In Settings
系统 MUST 在“设置 > 其他设置”提供“雷达历史管理”入口，承载最近完成历史记录的治理操作。

#### Scenario: open history management from settings
- **WHEN** 用户进入“设置 > 其他设置”
- **THEN** 系统 MUST 展示“雷达历史管理”入口
- **AND** 用户点击后 MUST 进入可执行删除操作的管理视图

#### Scenario: management view lists deletable recent-completed history
- **WHEN** 管理视图加载完成
- **THEN** 系统 MUST 展示当前可删除的最近完成记录列表
- **AND** 每条记录 MUST 具备稳定标识以支持单条/批量删除

### Requirement: Session Radar History Management SHALL Support Chained Deletion Workflow
系统 MUST 支持“多选删除→失败保留→重试删除”的连招链路，并在执行态提供防重入保护。

#### Scenario: single deletion succeeds
- **WHEN** 用户确认删除单条记录且后端删除成功
- **THEN** 系统 MUST 从管理列表与 Radar 最近完成列表同步移除该记录
- **AND** 系统 MUST 展示成功反馈

#### Scenario: bulk deletion partially fails and keeps failed selection
- **WHEN** 用户批量删除多条记录
- **AND** 后端返回部分失败
- **THEN** 系统 MUST 仅移除删除成功的记录
- **AND** 系统 MUST 保留失败记录及其选中状态用于重试
- **AND** 系统 MUST 展示失败摘要与错误分类

#### Scenario: chained retry works in same management session
- **WHEN** 用户在部分失败后不退出管理页直接触发二次删除
- **THEN** 系统 MUST 允许在同一管理会话内继续删除失败记录
- **AND** 二次删除结果 MUST 继续遵循“成功移除/失败保留”规则

#### Scenario: deletion request is non-reentrant while in progress
- **WHEN** 系统已提交删除请求且尚未完成
- **THEN** 系统 MUST 禁用删除相关触发控件
- **AND** 系统 MUST 阻止重复提交请求

### Requirement: Session Radar History Deletion SHALL Preserve Cross-View Consistency
系统 MUST 保证设置管理视图与 Session Radar 概览视图对最近完成记录的一致性，并且删除历史记录不得影响进行中会话。

#### Scenario: cross-view consistency after deletion
- **WHEN** 用户在管理视图删除历史记录后返回 Session Radar 概览
- **THEN** 两个视图中的最近完成集合 MUST 保持一致
- **AND** 系统 MUST NOT 出现已删除记录的幽灵回显或重复条目

#### Scenario: running sessions remain unaffected by history deletion
- **WHEN** 用户执行历史记录删除
- **THEN** Session Radar 的进行中会话集合 MUST 保持原有聚合与排序行为
- **AND** 系统 MUST NOT 中断任何进行中会话的后台执行

### Requirement: Session Radar SHALL Provide Deterministic Ordering And Deduplication
系统 MUST 对 Radar 列表采用稳定排序与去重策略，避免并发更新时出现跳项与重复行。

#### Scenario: deterministic sorting by freshness
- **WHEN** Radar 列表同时存在多条会话
- **THEN** 系统 SHALL 按最新活动时间倒序排序
- **AND** 同时间戳场景 SHALL 使用稳定次序避免列表抖动

#### Scenario: deduplicate by workspace-thread identity
- **WHEN** 同一会话在多个信号源被重复上报
- **THEN** 系统 MUST 基于 `workspaceId + threadId` 去重
- **AND** 列表中 MUST NOT 出现重复会话行

### Requirement: Session Radar SHALL Support Direct Navigation To Target Session
系统 MUST 支持从 Radar 条目一键跳转到目标 workspace/thread，且不破坏当前执行链路。

#### Scenario: jump from running item
- **WHEN** 用户点击进行中会话条目
- **THEN** 系统 SHALL 激活对应 workspace 与 thread
- **AND** 不得中断该会话后台执行

#### Scenario: jump from recently completed item
- **WHEN** 用户点击最近完成会话条目
- **THEN** 系统 SHALL 导航到对应会话上下文
- **AND** 用户 SHALL 能继续查看或追问该会话

### Requirement: Session Radar Hydration SHALL Be Bounded And Staged

Session Radar aggregation and prewarm SHALL not monopolize foreground interaction work.

#### Scenario: radar prewarm yields to active interaction
- **WHEN** the user is typing in Composer, switching threads, or a foreground streaming turn is under render pressure
- **THEN** Radar prewarm and non-active workspace hydration SHOULD be delayed, staged, or run with a bounded budget
- **AND** it MUST NOT block foreground input handling or active thread selection

#### Scenario: radar preserves global view without widening membership
- **WHEN** Radar shows running or recently completed sessions across workspaces
- **THEN** it MAY keep a global aggregate view
- **AND** any workspace thread-list hydration it triggers MUST apply membership and attribution rules for the target workspace scope
- **AND** Radar prewarm MUST NOT write another workspace's session into the current workspace membership

### Requirement: Session Radar Updates SHALL Avoid Full Sidebar Reprojection

Radar running/recent updates SHALL be projected in a way that does not force unrelated sidebar workspace trees to rebuild.

#### Scenario: running count update is workspace-scoped
- **WHEN** a running session count changes for one workspace
- **THEN** sidebar or Radar consumers SHOULD update the affected workspace projection only
- **AND** unrelated workspace folder trees, thread rows, and move targets MUST NOT be recomputed solely because that count changed

#### Scenario: deterministic aggregate avoids list jitter
- **WHEN** many session activity updates arrive concurrently
- **THEN** Radar rows MUST remain deduped by workspace-thread identity and stably ordered by freshness plus deterministic tie-breakers
- **AND** performance staging MUST NOT introduce duplicate rows or jumpy ordering

### Requirement: Radar Navigation SHALL Use Foreground-First Thread Switch

Navigation from Radar SHALL follow the same foreground-first switching contract as sidebar and topbar navigation.

#### Scenario: jump to running session does not wait for prewarm
- **WHEN** the user clicks a running Radar session
- **THEN** the app MUST activate the target workspace/thread foreground state first
- **AND** additional Radar refresh, workspace thread hydration, or session catalog reconciliation MUST run after or alongside the visible navigation with stale guards

#### Scenario: stale radar navigation work is scoped
- **WHEN** a Radar navigation triggers hydration and the user navigates elsewhere before it completes
- **THEN** late Radar-triggered work MUST remain scoped to its requested workspace/thread
- **AND** it MUST NOT restore the old Radar target as the current active thread
