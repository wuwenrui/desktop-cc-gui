## Why

当前 Intent Canvas 只是 Project Map 内的一次性弹窗表单，无法承载用户真正想要的“可管理、可复用、可被会话持续引用”的视觉上下文资产。

本变更把 Intent Canvas 升级为 project-scoped canvas module：图本身有独立文件结构、管理入口、Project Map file 入口，并可在会话进行时作为 structured context 发送给 AI。

## 目标与边界

- 目标：用户可以像使用 Excalidraw / FigJam 一样创建、打开、编辑、保存 Intent Canvas。
- 目标：Canvas 以独立 JSON 文件写入全局 `~/.ccgui/project-canvas/<project-storage-key>/`，并有 index 管理。
- 目标：Canvas 可以关联 Project Map 节点、文件路径和当前 thread。
- 目标：会话中发送的是结构化上下文，不是截图，不把图误判为已实现代码事实。
- 边界：Canvas 负责表达“意图、逻辑、关系、上下文”，不是代码生成器，也不是 Project Map 的替代图谱。

## 非目标

- 不实现图片转代码或模型驱动代码生成。
- 不把 Canvas 自动同步回 Project Map 主图谱。
- 不实现多人实时协作、云同步、权限模型。
- 不自研完整绘图内核；优先封装成熟绘图组件。
- 不要求解析每个 Excalidraw element 的业务语义，首版只提炼 AI context digest。

## What Changes

- 新增独立 `Intent Canvas` 管理模块，可创建、搜索、打开、删除、复制 workspace canvas 文件。
- 新增全屏 Canvas Editor，参考 Excalidraw-style 的工具栏、样式面板、无限画布、右侧上下文面板和底部状态栏。
- 新增 `~/.ccgui/project-canvas/<project-storage-key>/index.json` 与 `~/.ccgui/project-canvas/<project-storage-key>/<canvas-id>.intent-canvas.json` 文件协议。
- 新增 Canvas 与 Project Map node / workspace file / thread 的关联字段。
- Project Map 节点详情入口改为创建或打开真实 canvas file，不再提交一次性 payload。
- Project Map file/evidence 区域增加“为此文件创建 Canvas / 关联 Canvas”入口。
- Chat 会话支持将当前 Canvas 先挂载到 Composer 上方，以图形 preview card 回显；用户发送时再注入 structured context 到当前或新建 thread。
- Canvas Editor 左右信息栏支持折叠，保证画布区域可扩展。
- Canvas Manager 删除确认改为项目内 inline popover/dialog，不再使用全局 confirm/系统弹窗。
- Canvas Manager / Editor / Composer attachment preview 颜色必须兼容项目 light/dark theme。
- Canvas Manager 与 Canvas Editor 采用高密度 compact layout：顶部信息、搜索、数量与主要操作合并，Manager / Editor 顶部主操作统一为无边框 compact toolbar action 的 icon + 文案形态，减少纵向占用并避免胶囊化按钮。
- 旧 `ProjectMapIntentCanvas` 弹窗路径退役，保留必要类型迁移但不作为产品入口。

## 技术方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 集成 `@excalidraw/excalidraw` | 工具栏、选择、缩放、文字、箭头、自由绘制能力成熟；React 19 peer dependency 兼容 | 依赖体积增加，需要 adapter 隔离 raw elements | 采用 |
| 自研 SVG/HTML Canvas | 体积可控，业务语义容易定制 | selection、resize、zoom、text edit、arrow routing、hotkey 成本极高，容易再次变成玩具 | 不采用 |
| 仅保存 Mermaid/DSL | 结构化强，AI 消费容易 | 无法满足用户自由画图体验 | 不采用 |

## Capabilities

### New Capabilities

- `intent-canvas-workspace-files`: Defines workspace Intent Canvas file persistence, canvas manager/editor UX, Project Map file/node entry points, and chat context attachment behavior.

### Modified Capabilities

- None.

## Impact

- Dependencies: add `@excalidraw/excalidraw`.
- Frontend: new `src/features/intent-canvas/**` feature slice.
- Layout: add `intentCanvas` center mode and right-panel/module entry.
- Project Map: replace temporary modal entry with create/open real Canvas actions.
- Chat: add structured Canvas context send path.
- Storage: write app-global but project-partitioned `~/.ccgui/project-canvas/<project-storage-key>/**` JSON files through dedicated Project Canvas commands.
- i18n/styles: add Chinese/English copy and `intent-canvas` scoped styles.

## 验收标准

- 用户能从独立 Canvas 管理模块创建、打开、重命名、删除 Canvas。
- 用户能在 Canvas Editor 中画矩形、箭头、文本，并保存到磁盘文件。
- Project Map 节点详情可以创建/打开关联 Canvas。
- Project Map 文件/evidence 入口可以创建带 file path link 的 Canvas。
- 当前会话可以先看到 Canvas attachment preview card；点击发送后，会话接收 Canvas structured context，消息中包含 title、summary、linked files/nodes、元素摘要和 raw JSON snapshot。
- 刷新或重启后，Canvas index 能从 `~/.ccgui/project-canvas/<project-storage-key>` 恢复。
- Canvas Editor 在 light/dark theme 下文字、卡片、边框、Excalidraw surface 均保持可读。
- Canvas Editor 左右 rail 可折叠并可恢复。
- 删除 Canvas 使用项目内确认浮层，避免全局弹窗拦截失败或体验割裂。
- Canvas Manager 首屏不再出现分离的大 hero 和搜索条；主要信息与操作压缩到单行 command bar，顶部操作无边框且使用 icon + 可见文案。卡片右上角复制/打开/删除是紧凑 icon action，必须具备 aria-label/title 并走项目内确认浮层，避免误触。

## Implementation Backfill（2026-06-06）

本节按当前代码实现回写，不写未落地能力。

- `IntentCanvasManager` 顶部是单行 command bar：标题、摘要、搜索、画布数量、刷新、项目知识地图、新建 Canvas 同行排列；Manager header 已移除 `Intent Canvas` eyebrow badge。
- `IntentCanvasEditor` 顶部已移除 eyebrow badge；返回、保存、关联当前会话是无边框 icon + 文案 toolbar action；`未保存/已保存` 保留为状态标识，不按按钮处理。
- Manager 内容区使用 flex column；空状态、loading 和 grid 作为直属内容时会拉满剩余高度。
- 空状态内部使用 flex column 居中，图标、标题、描述和新建 Canvas 按钮作为一个整体居中，不再被拉散。
- Manager 卡片操作当前是紧凑 icon-only action，并通过 `aria-label`、`title` 和项目内 confirmation popover 保证语义与安全；该实现优先满足资产浏览器的密度要求。
- Card body click、打开、复制、删除统一进入 `actionPrompt` 二次确认，再由 `confirmCanvasAction()` 执行 open / duplicate / delete。
- Editor 关联当前会话不会直接发送消息；它会保存当前文档并把 `IntentCanvasDocument` staged 到 Composer 上方。
- Composer staged attachment 使用 `IntentCanvasAttachmentCard` 展示轻量 SVG 图形预览、标题、摘要、元素/文件/节点指标，并提供 icon + 文案 remove action。
- Composer 发送或排队时会把 staged Canvas 经 `formatIntentCanvasThreadContext()` 追加到用户文本，发送成功后清理当前 thread 下的 pending Canvas。
- Excalidraw scene 保存前会清洗 runtime-only `appState.collaborators`，避免恢复时触发 `collaborators.forEach is not a function`。
- Excalidraw scene 恢复前会把 nullable `appState.selectedElementIds` / `selectedGroupIds` 归一化为空对象，避免初始化时访问 `selectedElementIds[element.id]` 崩溃。
- Intent Canvas 视觉使用项目 CSS tokens 与 Excalidraw theme observer，兼容 light / dark / system appearance。

## Storage Boundary Correction（2026-06-06）

### 中文导读

本节修正早期 `workspace-local .mossx/canvases` 的存储决策。
Intent Canvas 是用户在 app 内管理的 project-scoped intent artifact，不应写入代码仓库工作区，也不应依赖 workspace 目录可写性。

### 校准后的代码事实

- Durable root 改为全局 app home 下的项目分层目录：`~/.ccgui/project-canvas/<project-storage-key>/`。
- `<project-storage-key>` 复用 Project Map 的项目身份规则：`<project-name-slug>-<hash(workspace.path#workspace.id)>`。
- Canvas index 现在是：`~/.ccgui/project-canvas/<project-storage-key>/index.json`。
- Canvas document 现在是：`~/.ccgui/project-canvas/<project-storage-key>/canvas-<id>.intent-canvas.json`。
- 前端 `intentCanvasStorage` 不再调用 workspace file API，而是调用 Project Canvas 专用 Tauri command。
- `read_workspace_file` / `write_workspace_file` 语义保持 workspace-relative，不被改成全局写入，避免影响文件树、编辑器、OpenSpec 等既有链路。
- 首次读取全局 Project Canvas 时会幂等迁移旧版 `<workspace>/.mossx/canvases` 下的 `index.json` 与 `canvas-*.intent-canvas.json`，避免历史画布在存储边界切换后不可见。
- 若旧目录只有 canvas documents 而缺少 index，迁移会从安全 document 文件合成新的全局 `index.json`。

### 兼容性约束

- 后端只接受 `index.json` 与 `canvas-*.intent-canvas.json` 两类文件名，拒绝绝对路径、`..`、子目录、Windows reserved segment 与 unsafe 字符。
- 写入通过 `with_storage_lock + write_string_atomically`，避免跨进程/多窗口并发写造成半文件。
- 删除继续走系统 Trash 语义，不直接静默 `remove_file`。
- 旧 workspace-local 文件只作为迁移来源读取；新写入不再回写到 repo/workspace。
- Remote mode 暂不支持 Project Canvas 全局存储；命令 fail closed 并返回明确 unsupported 错误，避免把本机 app-global 语义错误转发到远端。

## 阶段性评估 / Stage Assessment（2026-06-06）

### 中文导读

本节记录 `add-intent-canvas-workspace-files` 的阶段性收口状态。
结论：该变更已经从“Project Map 内一次性弹窗”完成转型，进入 `workspace-level canvas artifact` 阶段；当前 proposal 的目标、非目标与 implementation 保持一致。

### 当前完成度 / Current progress

- OpenSpec task progress：`20 / 20`。
- 已完成主链路：
  - `@excalidraw/excalidraw` 已作为绘图内核接入，并隔离在 Intent Canvas feature slice。
  - `IntentCanvasDocument` / index / open request / AI context formatter 已形成 normalized domain contract。
  - `.mossx/canvases/index.json` 与 `*.intent-canvas.json` workspace file persistence 已落地。
  - Canvas Manager 支持 create/search/open/delete。
  - Canvas Editor 支持 full-screen drawing、metadata rails、save/send actions。
  - Project Map node 与 file/evidence 入口已改为创建或打开持久化 Canvas document。
  - 旧 temporary `ProjectMapIntentCanvas` modal path 已从 production entry detach。
  - attach-to-session flow 已从 immediate send 校准为 Composer staging + graphical preview。
  - left/right rails 已支持 collapsible restore。
  - delete confirmation 已从 `window.confirm` 改为 app-local confirmation popover。
  - light/dark theme readability 已完成阶段性 hardening。

### 对齐确认 / Alignment check

| Proposal target | Current status | Calibration |
|---|---|---|
| workspace-level Canvas module | 已实现 | 对齐。Canvas 不再只是 Project Map 弹窗。 |
| 独立 JSON 文件协议 | 已实现 | 对齐。document/index 均进入 workspace file persistence。 |
| Project Map node/file entry | 已实现 | 对齐。入口创建或打开真实 Canvas document。 |
| Chat structured context | 已实现 Alpha | 对齐。先 staging，再由用户发送 structured context。 |
| Excalidraw-style editor | 已实现 | 对齐。绘图内核不自研，符合 glue code protocol。 |
| rail collapse / theme / delete UX | 已实现 | 对齐。已补齐阶段性 UX hardening。 |

### 校准发现 / Calibration findings

- 未跑偏：Canvas 仍是 user-authored intent context，不被当成 confirmed implementation fact。
- 未跑偏：Canvas 没有自动同步回 Project Map semantic graph，保持用户意图层与代码事实层分离。
- 已补充：Composer staging 避免“点击 send action 立即发给 AI”的不可逆交互。
- 已补充：项目内 confirmation popover 避免 global dialog 与 Tauri/WebView 行为割裂。
- 需要保留为风险：Canvas context digest 的语义质量仍依赖元素摘要，不应宣称能完整理解任意 Excalidraw scene。
- 需要保留为风险：未覆盖多人协作、云同步、图片转代码、自动图谱同步，这些仍保持非目标。

### 当前阶段判断 / Phase judgement

当前实现可定义为：

`Intent Canvas Closure Candidate: workspace artifact + Excalidraw editor + Project Map bridge + Composer context staging`

它已经满足“创建、编辑、保存、关联 Project Map、挂载到会话并作为 structured context 发送”的阶段目标；
归档前仍建议做一次真实 workspace smoke test，覆盖 create -> draw -> save -> reopen -> attach -> send。

## 阶段性 UI/入口校准回写（2026-06-06）

### 中文导读

本节基于当前代码实现重新精确回写近期 Intent Canvas Manager 的入口、卡片、确认、响应式与 i18n 调整。
这些调整不改变 Intent Canvas 的核心产品边界：Canvas 仍是 workspace-level user-authored intent artifact，不是 Project Map semantic graph，也不会自动变成 confirmed implementation fact。

### 代码事实 / Code facts

- 入口语义校准：
  - `handleOpenIntentCanvas(request?)` 在 `request` 缺省时只切到 `centerMode="intentCanvas"` 并 `setIntentCanvasOpenRequest(null)`。
  - 因此右侧工具栏/侧栏点击 `意图画布` 只打开管理页，不再隐式创建 `architect` Canvas。
  - 显式 request 仍保留 `mode/canvasId/title/summary/source`，Project Map node/file 等入口仍可创建或打开带上下文的 Canvas。
- Manager action state 校准：
  - Manager 使用 `IntentCanvasManagerAction = "open" | "duplicate" | "delete"` 表达三类 card action。
  - `actionPrompt` 保存当前待确认 action 与 entry。
  - `confirmCanvasAction()` 统一执行 open / duplicate / delete，并复用 `confirmingCanvasActionId` 表达确认中状态。
- Manager card JSX 校准：
  - 卡片主体点击不再直接 `openCanvas(entry.id)`，而是进入 `handleCanvasActionRequest(entry, "open")`。
  - 复制、打开、删除三个 icon button 均调用 `handleCanvasActionRequest`。
  - icon button 保留 `aria-label` 与 `title`，移除可见文字 span，避免无障碍名称回退。
  - 确认浮层统一使用 `.intent-canvas-action-popover-shell` 与 `ThreadDeleteConfirmBubble`，按 action 动态读取 `openConfirm / duplicateConfirm / deleteConfirm` 等 i18n key。
- Manager card 视觉密度与布局校准：
  - `.intent-canvas-card-open` 压缩为 `min-height: 136px`，summary 单行 clamp，metrics padding / font size 收紧。
  - `.intent-canvas-card-actions` 从卡片底部移动到右上标题区域，位于 `top: 43px; right: 13px`。
  - action button 去除边框、背景和胶囊形态，保留 transparent icon + hover affordance。
  - `.intent-canvas-card-open h3` 通过 `max-width: calc(100% - 104px)` 给右上 icon actions 预留空间。
- 操作确认校准：
  - `open`、`duplicate`、`delete` 三类 card action 均走项目内二次确认浮层。
  - 这避免用户在密集 icon 区误点后直接打开、复制或删除。
  - 确认浮层复用项目内 confirmation bubble，而不是 `window.confirm` 或系统弹窗。
  - 中英文 i18n 已补齐 `openConfirm/openHint` 与 `duplicateConfirm/duplicateHint`。
- 响应式兼容校准：
  - `.intent-canvas-manager-hero` 从固定大宽度布局收敛为 `minmax(0, 0.78fr) minmax(220px, 1fr) auto`，避免中文 + English 混排撑爆。
  - `.intent-canvas-manager-identity` 增加 overflow 约束，`h2` 支持 ellipsis；`max-width: 1180px` 以下切换为单列布局。
  - `max-width: 760px` 下标题允许两行 clamp，grid 退化为单列。
  - `.intent-canvas-action-popover-shell` 增加 `width: min(360px, calc(100vw - 32px))` 与窄屏左右贴边规则，避免确认浮层被裁切。
  - Card 标题为右上角 icon actions 预留空间，减少标题与操作区互相覆盖。
- Manager 列表区布局校准：
  - `.intent-canvas-manager > .intent-canvas-grid` 具备 `flex: 1` 与 `align-content: start`，列表区可作为 manager 内容区伸展。

### 对齐确认 / Alignment check

| UX contract | Current status | Calibration |
|---|---|---|
| 进入 Intent Canvas Manager 不应自动创建文件 | 已校准 | 对齐。管理入口与创建入口分离。 |
| Project Map contextual Canvas 仍可创建 | 保留 | 对齐。只有显式 request 才触发 create/open flow。 |
| Manager card 操作低噪音 | 已校准 | 对齐。icon actions 进入标题行右侧。 |
| 高风险/易误触 action 需要确认 | 已校准 | 对齐。open / duplicate / delete 统一二次确认。 |
| 项目内确认浮层优先于全局弹窗 | 已校准 | 对齐。继续保持 app-local interaction model。 |
| 窄宽度与中文界面可用性 | 已校准 Alpha | 对齐。标题、card action 与浮层已加兼容约束，但仍建议真实窗口 smoke。 |

### 当前保留项 / Deferred item

- Manager 空态区域高度自适应拉满未作为本次已完成事实记录；如继续优化，应单独确认并实现。
- 若后续继续优化空态高度，应作为独立 UI hardening 处理，避免把未落地内容写成已完成事实。

## Semantic Context Packet Proposal（2026-06-06）

### 中文导读

本节追加 Intent Canvas 发送给 AI 的上下文语义修复。
目标不是把完整 Excalidraw 原始 JSON 全量塞进对话，而是让 AI 收到的上下文“线索完整、语义优先、可压缩且不静默截断”。

### Problem

旧 `formatIntentCanvasThreadContext()` 同时发送前 40 条视觉 digest 和一个包含 `elementDigest/relationDigest` 的 JSON payload。
该模型存在三个问题：

- 对 Project Map 导入的关系图，真正有价值的是 semantic nodes / edges / evidence refs，而不是矩形坐标、颜色和尺寸。
- 超大 Canvas 会被固定数量裁剪，但用户和 AI 无法明确知道 sent / total / omitted。
- 文本 digest 与 JSON payload 存在重复 token，压缩方式偏“数量截断”，不是“语义保真”。

### Proposed behavior

- 发送给 AI 的 payload 升级为 `intent_canvas_context` version 2。
- payload MUST include a `completeness` manifest，声明 semantic nodes、semantic edges、evidence、visual text blocks、visual arrows 的 total / sent / omitted。
- Project Map 关系图优先发送 `semanticGraph.nodes`、`semanticGraph.edges` 和 evidence clue summary。
- 手绘图优先发送用户手写 text blocks、arrow binding clues、linked files / nodes / threads。
- 未命名 visual shapes、坐标、尺寸、颜色和 Excalidraw appState 默认不进入 AI payload，只以 compressed count 形式保留。
- Composer attachment preview MUST show whether the context is complete or compressed.

### Non-goals

- 不发送完整 raw Excalidraw scene。
- 不把 Canvas semantic graph 自动写回 Project Map 主图谱。
- 不引入模型自动总结链路；本阶段只做 deterministic compression。

### Acceptance

- AI message contains `Structured semantic payload` rather than duplicated visual digest blocks.
- Payload makes truncation explicit with `truncated` and omitted counts.
- For Project Map relationship imports, semantic node/edge clues are preserved before low-value visual details.
- Composer staged card displays context completeness counts so users know what will be sent.
