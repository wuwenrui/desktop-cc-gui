## ADDED Requirements

### Requirement: Dock User Conversation Tab MUST Remain Reachable In Collapsed Baseline Dock

系统 MUST 在底部 `dock` 状态面板折叠时继续保留 `用户对话` tab bar 入口；折叠态只隐藏内容区，不得卸载整个 dock 或移除 baseline tab bar。

#### Scenario: collapsed dock keeps user conversation tab visible

- **WHEN** 当前 active thread 存在且底部 activity panel 的 `用户对话` 控制项可见
- **AND** 底部状态面板处于折叠态
- **THEN** 系统 MUST 继续挂载底部 `dock` 状态面板
- **AND** `用户对话` tab MUST 仍然显示在 tab bar 中
- **AND** `用户对话` 内容区 MAY 被隐藏直到用户展开 dock

#### Scenario: OpenCode session keeps user conversation baseline entry

- **WHEN** 用户进入 `OpenCode` 会话且底部 activity panel 的 `用户对话` 控制项可见
- **THEN** 系统 MUST 像 `Claude / Codex / Gemini` 会话一样保留 `用户对话` tab 入口
- **AND** 系统 MUST NOT 因当前引擎为 `OpenCode` 而卸载底部 baseline dock

### Requirement: Composer MUST NOT Duplicate Bottom Dock Collapse Control

系统 MUST 避免在主 Composer 工具栏中展示与底部 `dock` 状态面板折叠/展开语义重复的 status panel toggle；底部 dock 的折叠控制应由 dock 自身入口承担。

#### Scenario: main composer omits duplicate status panel toggle

- **WHEN** 底部 `dock` 状态面板已经作为独立底部面板挂载
- **THEN** 主 Composer 工具栏 MUST NOT 展示重复的 layers/status-panel toggle icon
- **AND** 用户仍 MUST 能通过底部 dock 自身的折叠/展开控件控制面板
