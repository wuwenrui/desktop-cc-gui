## ADDED Requirements

### Requirement: Checkpoint Dock Tab MUST Remain Reachable In Collapsed Baseline Dock

系统 MUST 在底部 `dock` 状态面板折叠时继续保留 `结果 / Checkpoint` tab bar 入口；折叠态不得把 checkpoint baseline surface 从布局中卸载。

#### Scenario: collapsed dock keeps checkpoint tab visible

- **WHEN** 当前 active thread 存在且底部 activity panel 的 `结果` 控制项可见
- **AND** 底部状态面板处于折叠态
- **THEN** 系统 MUST 继续挂载底部 `dock` 状态面板
- **AND** `结果` tab MUST 仍然显示在 tab bar 中
- **AND** checkpoint 内容区 MAY 被隐藏直到用户展开 dock

#### Scenario: checkpoint baseline mount does not require activity facts

- **WHEN** 当前 active thread 暂无任务、Agent、文件变更或命令 activity
- **AND** 底部 activity panel 的 `结果` 控制项可见
- **THEN** 系统 MUST 仍然保留底部 `dock` 的 `结果` baseline 入口
- **AND** 系统 MUST NOT 因缺少 activity facts 而直接卸载整个底部状态面板

#### Scenario: OpenCode session keeps checkpoint baseline entry

- **WHEN** 用户进入 `OpenCode` 会话且底部 activity panel 的 `结果` 控制项可见
- **THEN** 系统 MUST 像 `Claude / Codex / Gemini` 会话一样保留 `结果` tab 入口
- **AND** checkpoint verdict、evidence 与内容计算 MAY 继续按现有可用事实回退
