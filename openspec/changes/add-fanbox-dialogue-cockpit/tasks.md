## 1. 规范与契约

- [x] 1.1 [P0][Dep:none][I: 方案原型 + toolCallBlocks/PanelTabs 现状][O: proposal/design/spec delta][V: openspec validate] 行为规范定稿。

## 2. 数据层（session-evidence）

- [x] 2.1 [P0][Dep:1.1][I: parseToolCallBlocks][O: turnEvidence.ts 纯函数 + 类型][V: vitest 覆盖引用/改动分类、去重、不完整块跳过、空信号] 推导层。
- [x] 2.2 [P0][Dep:2.1][I: window 事件模式][O: inspectorBus.ts][V: vitest 事件 payload] 联动总线。

## 3. 消息卡片摘要块

- [x] 3.1 [P0][Dep:2.1][I: MessagesRows assistant 渲染][O: TurnSourceSummary 组件 + 单点接入][V: vitest：有信号渲染/无信号不渲染/点击发事件] 摘要块。

## 4. 右栏四 tab

- [x] 4.1 [P0][Dep:2.2][I: PanelTabs/layoutNodeSections][O: FanBoxPanelTabs（四文字 tab + 更多折叠）+ tab id 扩展][V: vitest：四 tab 渲染、更多展开旧 tabs、点击切换] tab 重组。
- [x] 4.2 [P0][Dep:4.1][I: session-evidence 聚合][O: EvidencePanel][V: vitest 渲染聚合数据与空态] 证据面板。
- [x] 4.3 [P0][Dep:4.1][I: 现有 memory 数据源][O: MemoryInspectorPanel][V: vitest mock 数据渲染] 记忆面板。
- [x] 4.4 [P0][Dep:4.1][I: activity 面板 + onToggleTerminal][O: LogsPanel（终端降级入口）][V: vitest：展开终端回调触发] 日志面板。
- [x] 4.5 [P0][Dep:4.1][I: inspectorBus][O: 事件→tab 切换接线（含右栏隐藏时请求展开）][V: vitest 集成用例] 联动接线。

## 5. casebar 与响应式

- [x] 5.1 [P0][Dep:2.1][I: chat 内容层][O: casebar 三视图切换 + SessionFilesBoard + SessionEvidenceBoard][V: vitest：切换渲染、空态] 会话三视图。
- [x] 5.2 [P1][Dep:4.*,5.1][I: compact 断点][O: fanbox-cockpit.css 响应式收口][V: 截图无裁切] 窄屏行为。
- [x] 5.3 [P0][Dep:全部][V: `npm run typecheck` + focused vitest 全绿 + 既有相关测试回归] 静态与单测。
- [x] 5.4 [P0][Dep:5.3][V: 1920/1440 截图对照方案原型；SkillMarketButton/UsageBadge 在位] 视觉验收。

## 6. 文件视图双区（v2 增量，原型：docs/2026-06-12-fanbox-cockpit-redesign/方案原型-v2-文件双区.html）

- [x] 6.1 [P0][Dep:5.1][I: buildTree（fileTreePanelInternals）+ options.files/directories][O: SessionWorkspaceTree 只读树（搜索/展开折叠/热度标记）][V: vitest：树渲染、热度路径后缀匹配、搜索过滤、展开折叠、点击 onOpenFile] 工作区树组件。
- [x] 6.2 [P0][Dep:6.1][I: SessionFilesBoard][O: 双区布局（上=会话文件卡，下=工作区树）；SessionStage/useLayoutNodes 穿 workspaceFiles/workspaceDirectories/onOpenFile][V: vitest 双区渲染 + 缺省时旧行为不变] 双区接线。
- [x] 6.3 [P0][Dep:6.2][V: typecheck + focused vitest 全绿 + 真机文件视图验证] 验证收口。
