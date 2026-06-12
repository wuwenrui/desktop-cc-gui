## Context

- 视觉与交互定稿：`docs/2026-06-12-fanbox-cockpit-redesign/方案原型.html`（用户已确认；真实 themes.light.css token 比例）。
- tool-call 已结构化：`src/features/messages/utils/toolCallBlocks.ts:6-15`（`ToolCallBlock { tool, params }`，params 含 `file_path` 等）。
- 右栏 tab 系统：`src/features/layout/components/PanelTabs.tsx:15-25`（图标 tabs），toolbar 组装在 `src/features/layout/hooks/layoutNodeSections.tsx:53-79`。
- 终端：`buildTerminalDockNode`（layoutNodeSections.tsx:93-125）已有 `onToggleTerminal` 开关。
- 红线：`docs/FORK-PATCHES.md` —— MainTopbar 的 SkillMarketButton/UsageBadge 不动。

## Decisions

### Decision 1: 数据层 = 纯函数推导，不新增协议

新增 `src/features/session-evidence/turnEvidence.ts`：

```ts
type TurnSourceSummary = {
  citedFiles: string[];                       // Read/NotebookRead 的 file_path 去重
  changedFiles: { path: string; edits: number }[]; // Edit/Write/MultiEdit/NotebookEdit
  totalEdits: number;
};
deriveTurnSourceSummary(text: string): TurnSourceSummary   // 内部用 parseToolCallBlocks
type SessionFileActivity = { path: string; reads: number; edits: number };
deriveSessionEvidence(texts: string[]): SessionFileActivity[] // 跨消息聚合，edits 降序
```

- 引用 = `Read` / `NotebookRead`；改动 = `Edit` / `Write` / `MultiEdit` / `NotebookEdit`（取 `file_path`/`notebook_path` 参数）。`Bash`/`Grep`/`Glob` 不计入 v1（噪音大于信号）。
- 不完整（streaming 中）的 tool-call 块跳过；路径展示用 basename，title 给全路径。
- 摘要块只在「有信号」时渲染：cited 与 changed 均空 → 不渲染（不打扰原则）。

### Decision 2: 联动总线 = window 事件（与 ccgui:select-skill 同模式）

`src/features/session-evidence/inspectorBus.ts`：

```ts
type FanboxInspectorTab = "evidence" | "changes" | "memory" | "logs";
OPEN_INSPECTOR_EVENT = "ccgui:fanbox-open-inspector";
openInspectorTab(tab: FanboxInspectorTab): void;
```

消息卡片摘要块点击 → 发事件；右栏 toolbar 持有方监听 → 切到对应 tab（changes→现有 git tab，logs→现有 activity tab，evidence/memory→新面板 id）。右栏被隐藏/窄屏时同时请求展开。

### Decision 3: 右栏 = FanBox 四文字 tab 为主，现有图标 tabs 折叠为「更多」

- `PanelToolbarTabId` 增加 `"evidence" | "memoryInspector"`（changes 复用 `git`、logs 复用 `activity`，不新造重复面板状态）。
- 新组件 `FanBoxPanelTabs`：四个文字 tab（证据/改动/记忆/日志）+ 尾部「···」按钮展开现有 `PanelTabs` 图标行（files/search/notes/radar/projectMap/intentCanvas 全保留——能力不破坏）。
- 新面板：
  - `EvidencePanel`：本会话证据——引用来源卡（聚合 citedFiles）、改动热区卡（top changed）、待确认区（v1 渲染最近 assistant 消息无来源时的占位提示，不编造事实）。
  - `MemoryInspectorPanel`：复用项目记忆现有数据读取（实现时按现有 memory feature 的 hook/服务取数；只读列表 + 跳转完整记忆视图入口）。
  - `LogsPanel`：组合现有 activity 面板内容 + 顶部「展开终端」按钮（调用现有 onToggleTerminal）——终端从主交互降级为排障入口。

### Decision 4: casebar = 会话列内局部视图态，不动全局 centerMode

- 在 chat 内容层（messages 容器外壳）增加 casebar：左标题（会话名）+ 右三段切换 对话/文件/证据。
- 视图态是组件局部 state（非全局 centerMode）——切换不影响 diff/editor 等全局模式，刷新回落「对话」。
- 文件视图 `SessionFilesBoard`：`deriveSessionEvidence` 聚合的文件卡（名称 + 读/改次数 + 热度标记）；证据视图 `SessionEvidenceBoard`：最近一次有摘要的 AI 回复要点（引用来源 / 改动热区 / 待确认提示）。空会话显示空态文案。

### Decision 5: 响应式

- 断点沿用现有 compact 处理；新增 CSS：窄于既有 compact 阈值时 FanBox 四 tab 收纳进右栏浮层模式（右栏隐藏时消息摘要块仍可点击——事件请求展开右栏）。
- 验收：1920 / 1440 截图无半截裁切（任务 5.4）。

### Decision 6: 样式与 i18n

- 新样式集中在 `src/styles/fanbox-cockpit.css`（由相关组件 import），全部用现有主题 token；不改 themes.*.css。
- 文案：中英都加（`src/i18n/locales/zh.partN.ts` / `en.partN.ts`，键前缀 `fanbox.`）。

## Risks / Trade-offs

- tool-call 文本解析依赖消息正文含 invoke 块；某些引擎消息格式不同时摘要块自然不渲染（优雅降级，不报错）。
- 「项目记忆匹配 N 条」无运行时信号，v1 记忆卡只展示记忆列表与入口，不显示伪造的匹配数。
- MessagesRows 体量大：摘要块以独立组件 + 单点插入（assistant 渲染尾部）方式接入，避免大改。
