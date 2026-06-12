## Why

律师用户的核心困惑：AI 在对话里干了活，但"引用了什么、改了什么、下一步卡在哪里"散落在工具调用块、git 面板、终端输出里，全是开发者语言。FanBox 精髓（docs/fanbox-light-dialogue-cockpit-v3.html + 已确认方案原型 docs/2026-06-12-fanbox-cockpit-redesign/方案原型.html）：**用户始终用对话完成工作，但随时看到证据/改动/卡点；透明但不打扰**。

## 目标与边界

- Goal：AI 回复卡片底部展示来源摘要块（引用文件 / 改动热区，数据来自本回复的 tool-call 解析），点击联动右栏对应 tab。
- Goal：右栏新增 FanBox 四文字 tab——证据 / 改动 / 记忆 / 日志：证据=本会话证据聚合（新面板）；改动=现有 git 面板；记忆=项目记忆（复用现有数据）；日志=现有 activity 面板 + 「展开终端」入口（终端降级为排障入口）。
- Goal：会话区顶部新增 casebar：对话 / 文件 / 证据三视图（文件=本会话文件热区板，证据=判断依据/下一步板），视图切换不离开会话。
- Goal：窄屏下右栏整体隐藏或浮层化，不出现半截裁切。
- Goal：保持浅色 UI 与现有布局骨架；MainTopbar 的 SkillMarketButton/UsageBadge、左侧栏、Composer 不动（FORK-PATCHES 红线）。
- Boundary：不做黑色重皮肤；不改消息流协议与 tool-call 解析器（仅消费 `parseToolCallBlocks` 产物）；不删除现有任何右栏能力（radar/files/search/notes/projectMap/intentCanvas 经「更多」折叠入口保留）。
- Boundary：记忆匹配条数等无真实运行时信号的指标，v1 只展示可从现有数据推导的内容，不编造。

## What Changes

- 新增 `src/features/session-evidence/`：tool-call → 引用/改动摘要的纯函数推导层 + 会话级聚合 + 右栏联动事件总线。
- 消息层：assistant 消息卡片尾部渲染 `TurnSourceSummary`（引用 N 文件 / 改动 N 次），点击发 `ccgui:fanbox-open-inspector`。
- 布局层：右栏 toolbar 在现有图标 tabs 前增加 FanBox 四文字 tab + 「更多」折叠现有图标 tabs；新增 EvidencePanel / MemoryInspectorPanel / LogsPanel（组合现有 activity + 终端入口）。
- 会话区：messages 容器上方新增 casebar（标题 + 三视图切换），文件/证据两个新视图组件，数据来自 session-evidence 聚合。
- 响应式：窄屏断点下右栏隐藏 + 浮层入口，CSS 收口。

## Capabilities

### New Capabilities

- `fanbox-dialogue-cockpit`：对话优先工作台——AI 回复来源摘要、右栏四类用户语言 tab、会话三视图、终端降级为日志入口。

### Modified Capabilities

- 无破坏性修改：现有右栏 tabs 全部保留（折叠入口）；git/activity/memory/terminal 面板语义不变，仅新增映射入口。
