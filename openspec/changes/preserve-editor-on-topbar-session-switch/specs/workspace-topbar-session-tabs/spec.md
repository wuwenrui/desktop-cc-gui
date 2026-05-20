# workspace-topbar-session-tabs Specification Delta

## MODIFIED Requirements

### Requirement: Topbar Tab Switch AND Highlight SHALL Use Workspace+Thread Identity

系统 MUST 以 `workspaceId + threadId` 作为切换与高亮判定身份键。desktop editor split 已打开文件时，同 workspace 的 topbar session switch MUST 被视为聊天上下文切换，而不是文件编辑器关闭动作。

#### Scenario: clicking tab switches by explicit workspace-thread pair
- **WHEN** 用户点击某个非 active tab
- **THEN** 系统 MUST 使用该 tab 自带的 `workspaceId/threadId` 切换上下文

#### Scenario: active highlight does not mismatch across workspaces
- **GIVEN** 多个 workspace 都存在同名/相似会话
- **WHEN** active 会话变化
- **THEN** 仅匹配相同 `workspaceId + threadId` 的 tab 可高亮

#### Scenario: same-workspace tab switch preserves visible editor split
- **GIVEN** 用户位于 desktop workspace chat
- **AND** 当前 `centerMode` 为 `editor`
- **AND** 当前 workspace 存在 active editor file 与 open editor tabs
- **WHEN** 用户点击同一 workspace 内另一个 topbar session tab
- **THEN** 系统 MUST 切换到该 tab 的 `threadId`
- **AND** editor split MUST 保持可见
- **AND** active editor file 与 open editor tabs MUST 保留
- **AND** 系统 MAY 清理 selected diff path
- **AND** 系统 MUST NOT 通过 full diff exit path 把 `centerMode` 切回 `chat`

#### Scenario: non-topbar same-workspace session navigation preserves visible editor split
- **GIVEN** 用户位于 desktop workspace chat
- **AND** 当前 `centerMode` 为 `editor`
- **AND** 当前 workspace 存在 active editor file 与 open editor tabs
- **WHEN** 用户通过 notification、status panel、latest conversation、sidebar-style list、global search result 或 keyboard cycle 切换到同一 workspace 的另一个 session
- **THEN** 系统 MUST 切换到目标 `threadId`
- **AND** editor split MUST 保持可见
- **AND** active editor file 与 open editor tabs MUST 保留
- **AND** session navigation MUST NOT collapse adjacent panels solely because of the session switch
- **AND** 系统 MAY 清理 selected diff path
- **AND** 系统 MUST NOT 通过 full diff exit path 把 `centerMode` 切回 `chat`

#### Scenario: non-editor tab switch keeps existing fallback behavior
- **WHEN** 用户不在 editor split、没有 active editor file，或处于 compact / phone / tablet 布局
- **THEN** topbar session switch MAY 继续使用既有回 chat 行为
- **AND** 系统 MUST NOT 为了保留不存在的 editor state 改变 compact navigation 语义

#### Scenario: cross-workspace tab switch does not bind old editor file to new workspace
- **GIVEN** 当前 workspace A 打开了 editor file
- **WHEN** 用户点击 workspace B 的 topbar session tab
- **THEN** 系统 MUST 切换到 workspace B 的 `workspaceId/threadId`
- **AND** 系统 MUST NOT 将 workspace A 的 editor file 绑定到 workspace B 的 file viewer
- **AND** 系统 MAY 回到 chat 或等待后续 workspace-bound editor state 设计处理跨 workspace 保留
