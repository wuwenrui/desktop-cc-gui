# workspace-session-folder-tree Specification

## Purpose

Defines the workspace-session-folder-tree behavior contract, covering Project Sessions SHALL Support A Folder Tree Organization Layer.
## Requirements
### Requirement: Project Sessions SHALL Support A Folder Tree Organization Layer

系统 MUST 为每个 project/workspace 提供独立的 session folder tree，用于组织该项目内的 sessions；folder tree MUST NOT 改变 session 的真实 owner workspace/project。

#### Scenario: create nested folders inside one project
- **WHEN** 用户在某个 project 下创建 folder 或 child folder
- **THEN** 系统 MUST 将 folder 持久化到该 project 的 folder tree 中
- **AND** 新 folder MUST NOT 出现在其它 project 的 folder tree 中

#### Scenario: folder tree survives refresh
- **WHEN** 用户刷新应用或重新打开项目
- **THEN** 系统 MUST 恢复该 project 的 folder tree、expandable hierarchy 与 session assignments
- **AND** folder hierarchy MUST 保持用户最后保存的父子关系

#### Scenario: folder collapsed state survives refresh
- **WHEN** 用户折叠或展开某个 project 内的 folder
- **AND** 用户刷新应用或重新打开项目
- **THEN** UI SHOULD 恢复该 project 最近保存的 folder collapsed/expanded state
- **AND** 该 UI preference MUST NOT 改变 session owner、folder parent 或 folder assignment metadata

#### Scenario: folder organization does not change owner
- **WHEN** session 被分配到某个 folder
- **THEN** 系统 MUST 保持该 session 的真实 owner workspace/project 不变
- **AND** 后续 archive、delete、unarchive MUST 仍按真实 owner routing 执行

### Requirement: Folder CRUD SHALL Be Project Scoped And Safe

系统 MUST 支持 project scoped folder 创建、重命名、删除与层级调整，并对非法层级和跨 project target 做保护。

#### Scenario: rename folder inside current project
- **WHEN** 用户重命名当前 project 内的 folder
- **THEN** 系统 MUST 更新该 folder 的显示名称
- **AND** MUST NOT 修改 folder id、child folders 或已分配 sessions

#### Scenario: reject cyclic folder parenting
- **WHEN** 用户尝试把 folder 移动到自身或自身 descendant 之下
- **THEN** 系统 MUST 拒绝该操作
- **AND** MUST 返回可解释错误，说明 folder tree 不能形成循环

#### Scenario: delete non-empty folder is blocked by default
- **WHEN** 用户删除包含 child folders 或 sessions 的 folder
- **THEN** 系统 MUST 阻止删除
- **AND** MUST 提示用户先移动或清空 folder 内容
- **AND** 系统 MUST NOT 静默删除 folder 内的 sessions

### Requirement: Folder Tree SHALL Have Discoverable Entry Empty State And Deterministic Ordering

系统 MUST 让新手用户能发现 folder 能力，并用稳定排序展示 folder tree，避免 session 管理看起来随机或不可理解。

#### Scenario: new folder entry is discoverable from project row
- **WHEN** 用户查看或 hover 某个 project row
- **THEN** 系统 MUST 提供 `New folder` 或等价入口
- **AND** 该入口 MUST 明确作用于当前 project

#### Scenario: project without folders still shows root sessions
- **WHEN** 某 project 尚未创建任何 folder
- **THEN** 系统 MUST 继续展示 root sessions
- **AND** MUST NOT 将空 folder tree 渲染成 session 丢失或空项目

#### Scenario: default folder tree ordering is deterministic
- **WHEN** 系统渲染 project folder tree
- **THEN** folders MUST 排在 sessions 前
- **AND** folders MUST 以稳定规则排序
- **AND** sessions MUST 保持既有 session projection ordering

### Requirement: Sessions SHALL Move Between Folders By Menu Only Within The Same Project

系统 MUST 允许 session 通过菜单或等价显式控件在同一 project 的 root 与 folders 之间移动，但 MUST 禁止跨 project 移动。

#### Scenario: move session into folder in same project
- **WHEN** 用户通过菜单把当前 project 的 session 移入同一 project 的 folder
- **THEN** 系统 MUST 更新该 session 的 folder assignment
- **AND** session MUST 出现在目标 folder 下

#### Scenario: move session back to project root
- **WHEN** 用户通过菜单把 folder 内 session 移回 project root
- **THEN** 系统 MUST 清除或更新该 session 的 folder assignment 为 root
- **AND** session MUST 继续属于原 project

#### Scenario: reject cross-project move
- **WHEN** 用户尝试通过菜单、命令或其它入口把 session 移到另一个 project 或另一个 project 的 folder
- **THEN** 系统 MUST 拒绝移动
- **AND** MUST 保留 session 原 folder assignment
- **AND** MUST 向调用方或用户说明不允许跨项目移动 session

### Requirement: Sessions SHALL Be Movable Through Menu

系统 MUST 提供菜单或等价显式控件，使用户可以把 session 移动到同 project folder/root。该能力 MUST 覆盖 root list、folder list、worktree/child workspace list 等共享 strict project session surface；只要当前 project/workspace 有合法 folder/root move targets，行菜单就不得因为渲染路径不同而丢失移动入口。

#### Scenario: move session through menu
- **WHEN** 用户打开某条 session 的操作菜单并选择 `Move to folder`
- **THEN** 系统 MUST 通过右侧 flyout、submenu 或等价不会撑开主菜单的分层 UI 展示当前 project 内可选 folder/root
- **AND** 用户 MUST 能完成同 project session folder assignment

#### Scenario: menu move excludes other projects
- **WHEN** 用户通过 `Move to folder` 选择目标
- **THEN** 系统 MUST 只展示当前 project 的 folder/root
- **AND** MUST NOT 提供其它 project folder 作为可选目标

#### Scenario: worktree session row exposes move menu when targets exist
- **WHEN** 用户在 worktree 或 child workspace session row 上打开操作菜单
- **AND** 当前 worktree/project 存在合法 folder/root move targets
- **THEN** 系统 MUST 展示 `Move to folder` 或等价入口
- **AND** 该入口 MUST 使用该 worktree/project 的 move targets，而不是 parent 或 sibling project 的 targets
- **AND** 系统 MUST NOT 在缺少该 worktree/project targets 时静默回退到 parent workspace targets

#### Scenario: large folder target list remains searchable
- **WHEN** 当前 project 内 folder/root move target 数量超过可扫描阈值
- **THEN** 系统 SHOULD 在 `Move to folder` 的分层 UI 内提供搜索、过滤或等价快速定位入口
- **AND** 搜索入口 MUST NOT 替代分层 UI 内可见的 folder/root targets
- **AND** root target MUST 始终可见或可通过固定入口选择
- **AND** 搜索结果 MUST 仍只包含当前 project 的 folder/root

### Requirement: Folder Tree Assignment SHALL Preserve Projection Semantics

Folder tree assignment MUST 只改变组织层 metadata，不得扩大或缩小当前 project session projection 的 membership。对启动阶段只有 pending identity 的 session，UI MAY 暂存 folder intent；但 durable folder assignment MUST 等到真实 canonical session id 已知后写入。

#### Scenario: same-project menu move does not alter strict membership
- **WHEN** 用户在同一 project 内通过菜单移动 session 到 folder
- **THEN** strict project session membership MUST 保持不变
- **AND** 变化范围 MUST 仅限 folder assignment 和 UI 位置

#### Scenario: pending session folder intent waits for real identity
- **WHEN** 用户从 folder 或 child workspace 创建 engine session
- **AND** engine 先返回 pending session identity
- **THEN** 系统 MAY 在 UI 中保留该 pending session 的 folder intent
- **AND** MUST NOT 将 durable folder assignment 写入一个猜测出来的真实 session id

#### Scenario: pending folder intent migrates on identity transition
- **WHEN** 系统确认 `pendingSessionId` 已被真实 canonical session id 替换
- **AND** 该 pending session 存在 folder intent
- **THEN** 系统 MUST 将 folder intent 迁移到真实 canonical session id
- **AND** durable folder assignment MUST 使用真实 canonical session id 写入
- **AND** MUST NOT 把 intent 写入同 engine 的其它旧 session

#### Scenario: retryable assignment failure keeps pending intent
- **WHEN** pending folder intent 已经迁移到真实 canonical session id
- **AND** durable assignment 因 catalog-not-ready 或等价 retryable 原因失败
- **THEN** 系统 MUST 保留 pending intent 或等价 retry state
- **AND** MUST NOT 把 session 静默移动回 root

#### Scenario: non-retryable assignment failure is visible before intent cleanup
- **WHEN** pending folder intent 已经迁移到真实 canonical session id
- **AND** durable assignment 因 non-retryable 原因失败
- **THEN** 系统 MUST 保持或恢复可解释的本地 UI 状态
- **AND** MUST 向用户暴露失败
- **AND** 才能清理该 pending intent

#### Scenario: filtered and paged catalogs remain stable after folder move
- **WHEN** 当前 session catalog 存在 keyword、engine、status filter 或 cursor pagination
- **AND** 用户移动某条 session 到 folder
- **THEN** 系统 MUST 保持 filter/pagination 语义稳定
- **AND** MUST NOT 用当前可见窗口冒充完整 folder/project total

### Requirement: Session Folder Tree SHALL Participate In Management Navigation

The project session folder tree MUST be usable from the Session Management hierarchy as an organization and filtering surface.

#### Scenario: folder appears under selected project
- **WHEN** a project has persisted session folders
- **THEN** the Session Management left hierarchy SHOULD render those folders under the project/worktree scope
- **AND** folder rows MUST remain scoped to their owner workspace

#### Scenario: folder cleanup follows delete cleanup
- **WHEN** a session is physically deleted or cleaned as already missing
- **THEN** any folder assignment metadata for that session MUST be removed
- **AND** the folder itself MUST remain unless explicitly deleted

#### Scenario: missing session does not make folder non-empty forever
- **GIVEN** a folder only contains assignments to sessions missing on disk
- **WHEN** those missing assignments are cleaned
- **THEN** the folder SHOULD become deletable if it has no child folders or live session assignments

### Requirement: Workspace Session Folder Commands Shall Follow Active Backend Location
Workspace session folder list, mutation, deletion, and assignment commands SHALL execute against the active backend location. In remote backend mode, desktop Tauri commands MUST forward to daemon RPCs instead of reading or mutating desktop-local session folder metadata.

#### Scenario: remote session folder list uses daemon state
- **WHEN** backend mode is remote
- **AND** the client lists workspace session folders
- **THEN** the desktop command SHALL request `list_workspace_session_folders` from the daemon
- **AND** it MUST NOT read desktop-local catalog metadata as fallback

#### Scenario: remote session folder mutations use daemon state
- **WHEN** backend mode is remote
- **AND** the client creates, renames, moves, deletes, or assigns workspace session folders
- **THEN** the desktop command SHALL forward the matching daemon RPC with equivalent parameters
- **AND** daemon errors SHALL surface through the existing command error path

#### Scenario: local backend behavior remains unchanged
- **WHEN** backend mode is local
- **THEN** workspace session folder commands SHALL continue using local workspace state and catalog metadata
- **AND** frontend service API shape SHALL remain unchanged
