## Why / 为什么要做

Project Canvas v0 已经完成了最基础的画布能力：可以画图、可以保存到全局项目分层目录、也可以作为简单上下文发给 AI。

但现在它本质上还是一个 user-authored whiteboard（用户手动画板）。下一阶段要让它变成 project intelligence surface（项目智能画布）：用户不需要手动画调用关系，而是可以从真实代码、`project-map-relations` 节点或关系线直接导入图谱。

这次变更定义 Project Canvas Phase 2：支持从代码选中方法、从 `project-map-relations` 选中节点/线导入 Canvas，并生成可追溯的调用关系图/项目关系图。

核心原则：

- Graph first, AI second。
- 事实源来自 code symbols / project-map-relations。
- Canvas 是 projection workbench（投影工作台），不是新的事实数据库。
- AI 负责 explain / group / risk annotation，不负责凭空制造事实。

## 目标与边界

- 目标：用户在代码里选中一个 method/function 后，可以导入 Project Canvas，自动生成 caller/callee 层级图。
- 目标：用户在 `project-map-relations` graph 里选中节点后，可以导入 Project Canvas，生成该节点的一跳 neighborhood graph。
- 目标：用户在 `project-map-relations` graph 里选中 edge/line 后，可以导入 Project Canvas，生成 source -> target 的关系图。
- 目标：Canvas 里的节点和连线都保留 source anchor（来源锚点），后续可以回跳文件、symbol、relationship evidence。
- 目标：Canvas 可以显示 stale/unresolved 状态，告诉用户这张图是否来自旧 scan run，或者源代码是否已经消失。
- 目标：AI 只能基于已导入的 semantic graph 做解释、分组、风险标注和下一步建议。
- 边界：Project Canvas 不替代 Project Map。
- 边界：Project Canvas 不替代 `project-map-relations`。
- 边界：Canvas 保存的是 projection metadata（投影元数据），不是完整关系图事实库。

## 非目标 / Non-Goals

- 不在本阶段做 full language AST/LSP backend（全语言 AST/LSP 后端）。
- 不做 whole-project unlimited graph（无限全项目图谱）。
- 不把 Canvas 编辑结果反写到 Project Map semantic graph。
- 不把 Canvas 编辑结果反写到 `project-map-relations` storage。
- 不让 AI 直接生成 fact-backed nodes/edges（事实节点/边）。
- 不改变现有全局存储根：`~/.ccgui/project-canvas/<project-storage-key>/`。
- 不处理 remote mode 下 Project Canvas 全局存储归属问题；这个边界后续单独定义。

## What Changes / 会改什么

- 新增 `Canvas Source Anchor` 协议，用来描述 Canvas 节点/线来自哪里。
- 新增从 `project-map-relations` selected node 导入 Canvas 的能力。
- 新增从 `project-map-relations` selected edge 导入 Canvas 的能力。
- 新增从代码编辑器 selected method/function 导入 Canvas 的能力。
- 新增 graph projection pipeline：
  - `source anchor -> graph query -> semantic graph -> Excalidraw projection -> AI explanation context`
- Canvas document 增加 optional semantic graph metadata，例如 `semanticGraphs` 和 `aiAnnotations`。
- Canvas 节点/线增加 source backlink：
  - open source file/range
  - inspect relationship evidence
  - show stale/unresolved source state
- AI explanation context 增加 imported graph 的结构化上下文。
- 大图默认 bounded import（限制节点/边数量），避免一次性把整个项目塞进画布。

## 技术方案选项 / Options

### Option 1: 直接把业务 metadata 塞进 Excalidraw elements

说明：把 `sourceId`、`filePath`、`relationId` 直接挂在 Excalidraw element 上。

优点：

- 实现最快。
- 前端改动最少。

缺点：

- 绘图元素和业务事实强耦合。
- 后续 refresh stale graph、source backlink、AI context 都会变脆。
- Excalidraw 只是 presentation layer，不应该承担 Project Canvas 语义层。

结论：不采用。

### Option 2: 建立 Project Canvas semantic projection layer（推荐）

说明：先建立语义层，再投影成 Excalidraw 元素。

数据流：

```text
source anchor
  -> graph query
  -> CanvasSemanticGraph
  -> Excalidraw elements
  -> AI explanation context
```

优点：

- 代码选择和 relations 图选择可以共用一套 pipeline。
- Canvas 可以保存 stable source reference，而不是复制整份 relationship snapshot。
- 后续扩展 refresh、AI explain、expand neighborhood 都有统一入口。

缺点：

- 需要新增数据模型和投影器。
- 实现步骤比 Option 1 多。

结论：采用。

### Option 3: 先做纯 AI 画图

说明：把用户选择的代码/节点交给 AI，让 AI 直接生成画布。

优点：

- demo 看起来很快。

缺点：

- AI 生成内容不可追溯。
- 用户无法确认节点/线是否真的来自代码事实。
- 后续回跳文件、刷新关系、stale 判断都会失败。

结论：不采用。AI 是 explainer，不是 fact source。

## Capabilities / 能力规格

### New Capabilities

- `project-canvas-code-graph-import`
  - 定义 Project Canvas 的 source anchors、代码方法导入、`project-map-relations` 节点/线导入、semantic graph projection、source backlink、stale handling、AI explanation context。

### Modified Capabilities

- None。
- 现有 Project Canvas storage 和 Project Map relationship scan 仍作为底层事实/存储 substrate。
- 本变更只新增 projection capability，不修改底层事实边界。

## Impact / 影响范围

### Frontend

- `src/features/intent-canvas/**`
  - 增加 semantic graph 类型。
  - 保留 imported graph metadata。
  - 生成 Excalidraw projection。
  - 生成 AI explanation context。

- `src/features/project-map/**`
  - 在 Relationship Dashboard 的 node/edge 上增加 `Import to Canvas` action。
  - 抽取或复用现有 one-hop graph view model。

- file/code view 相关入口
  - 需要提供 active file、selection text、line/range 信息。
  - 如果当前没有 selection state，需要先加轻量 adapter。

### Backend / Tauri

- 优先复用现有 `project_map_relationship_read`。
- 如后续性能需要，再增加 narrower query command。
- 路径和 range 必须 cross-platform safe。

### Storage

- 继续使用：

```text
~/.ccgui/project-canvas/<project-storage-key>/
```

- Canvas document 可以新增 optional fields：

```ts
semanticGraphs?: CanvasSemanticGraph[];
aiAnnotations?: CanvasAiAnnotation[];
```

- 不复制完整 `project-map-relations` snapshot。

### Dependencies

- 默认不引入新依赖。
- 如果后续需要 graph layout library，必须单独评估维护活跃度和必要性。

## 验收标准 / Acceptance Criteria

- 在 `project-map-relations` graph 里选择 file node 后，导入 Canvas 能生成以该节点为中心的一跳关系图。
- 在 `project-map-relations` graph 里选择 edge 后，导入 Canvas 能生成 source node、target node、directed edge、relation kind、evidence reference。
- 在代码编辑器中选中可解析 method/function 后，导入 Canvas 能生成 caller/callee 图。
- 导入的 Canvas 节点/线保留 source anchor，并能回跳 source file/range 或查看 relationship evidence。
- 如果 Canvas 图来自旧 scan run，界面能显示 stale state。
- 如果源文件或 symbol 消失，界面能显示 unresolved state，但不自动删除用户画布内容。
- AI explanation 只能基于 imported semantic graph 和 evidence summary。
- AI annotations 必须和 fact-backed graph nodes/edges 有视觉或结构区分。
- 大图必须 bounded import，默认限制节点/边数量，并用 summary/aggregate 表示被省略部分。
- macOS/Linux/Windows path separator 都要兼容。

## Code Calibration - 2026-06-06 / 代码校准

- OpenSpec strict validation 已通过：

```text
openspec validate add-project-canvas-code-graph-import --strict --no-interactive
```

- 当前 Project Canvas document model 仍是 `version: 1`，核心字段是 `links`、`scene`、`aiContext`。
- 后续实现必须显式新增并保留 optional `semanticGraphs` / `aiAnnotations`，否则 normalize/load/save 时会把导入图元数据剥掉。
- 当前 `project_map_relationship_read` 已返回 MVP 需要的关系数据：
  - `manifest`
  - `files`
  - `relations`
  - `symbols`
  - `contextPack`
  - `stale`
  - `repair`
- 当前 Relationship Dashboard 是 file-node centric，不是 symbol-node centric。
- 所以第一版导入应先做 relationship file-node import。
- Symbol-node import 可以保留在协议里，但不能假设当前 UI 已经有 symbol graph node。
- 当前关系图已经有：
  - selected file center node
  - incoming lane
  - outgoing lane
  - hidden aggregate nodes
  - bounded edge rendering
- 实现时应抽取/复用这个 graph view model，不要另写一套布局算法。
- 当前前端 symbol 使用至少支持 `fileId/name/line`。
- 第一版 source anchor 应支持 line-level anchor。
- `selectionRange`、`definitionRange`、column data 都是 when available enhancement，不是 MVP blocker。
- 当前已有 line/column navigation 和 OpenCode LSP command，但 Project Canvas 还没有专门的 code-selection import surface。
- 所以代码选中方法导入要先确认 active editor/file view 是否暴露 selection state；没有的话先补 adapter。

## Implementation Calibration - 2026-06-06 / 阶段实现校准

- Relationship file-node import 是 Project Canvas Phase 2 的主入口：用户在 Relationship Inspector 中选择文件后，应通过 `导入全部 N 条关系到 Canvas` 导入当前 inspector 已解析出的 direct incoming / outgoing relation set。
- Relationship edge import 是 evidence-level secondary action：`仅导入这条关系` 只生成 source / target / selected relation，不替代 file-level full relationship graph import。
- Canvas visual projection 必须使用 Excalidraw structural binding：
  - file node title/path text 绑定到 node container。
  - relation arrow 绑定到 source / target node containers。
  - method/function label 绑定到 arrow container。
- Canvas edge label 必须优先保留 Project Map 已解析的 method/function call candidate，例如 `ApiResponse.success`、`error.getDefaultMessage`；`calls/imports/configures` 等 relation kind 只是 metadata/fallback。
- 第一阶段已经将 file-level relationship graph 导入与 edge-level relation 导入区分清楚，并完成 Canvas semantic graph metadata 的 normalize/save/clone 保留。
- 关系图导入目标已从隐式 `追加到当前 Canvas` 校准为显式选择：`新建 Canvas` 或追加到某个具体已有 Canvas。追加行为由 Intent Canvas Manager 根据 `canvasId + target=append` 合并 scene elements、links、semanticGraphs 和 AI context，Relationship Dashboard 不直接操作 Canvas storage。
- 包含 `project-map-relations` imported graph 的 Canvas editor 顶部提供 `返回项目知识地图` navigation link，避免用户从 Project Map 进入 Canvas 后失去来源路径。
- `replace selected imported graph group` 仍作为后续独立任务保留；当前阶段不把替换行为混进 target chooser，避免误删用户已编辑的 Canvas 内容。
- Method-level selected code import 仍未完成，继续保留在后续 `6.x` task，不应在本阶段归档或宣称完成。

## 建议实施顺序 / Recommended Implementation Order

```text
1. 扩展 IntentCanvasDocument optional semantic graph fields
2. 保证 normalize/save/clone 不丢 semantic graph metadata
3. 抽取 Relationship Dashboard file-node graph view model
4. 实现 relationship file-node -> Canvas import
5. 实现 relationship edge -> Canvas import
6. 实现 source backlinks + stale/unresolved state
7. 接入 code selected method -> Canvas import
8. 接入 AI explanation annotations
```

## 阶段性回写：旧 Canvas 合并导入稳定性（2026-06-06）

本阶段基于真实旧 Canvas 回归截图修正 Project Map / Code Graph 导入 Intent Canvas 的合并导入质量问题。

### 问题校准

- 关系导入目标列表此前只在入口初始化时读取，用户新建或保存 Canvas 后，目标下拉存在不及时刷新。
- 合并导入到旧 Canvas 时，系统生成的 relationship seed 元素可能保留旧深色 palette，在浅色画布下表现为黑框。
- 长路径或相似 relation id 经截断后可能生成重复 Excalidraw element id，导致 rectangle 与 text binding 错乱，出现无数据空框。
- 旧画布中已持久化的系统生成黑框不会仅靠新 palette 自动消失，需要在 scene sanitize / append 链路中做轻量自愈。

### 实现回写

- 关系导入面板新增目标 Canvas index reload 链路，在面板展开/目标选择链路中重新拉取目标列表，并使用 request id guard 避免 stale response 覆盖新状态。
- Intent Canvas relationship seed id 改为 `readable slug + stable hash`，避免长路径前缀相同导致 id 冲突。
- Intent Canvas scene sanitize 增加仅作用于系统生成元素的 repair 层：修复旧深色 palette、重建 node-text binding、过滤没有可见 label 的系统空节点。
- 新导入与 append 到旧 Canvas 的 relationship seed 均使用 theme-safe light palette；普通用户手绘元素不进入自动改色范围。
- 增加 scene 回归测试，覆盖浅色 palette、长路径唯一 id、旧深色元素修复、空 label 系统框过滤。

### 行为边界

- 本阶段不迁移 storage schema，不修改 Rust Project Canvas command contract。
- repair 仅识别 `intent-node-*`、`intent-node-text-*`、`intent-edge-*`、`intent-edge-label-*` 系统生成元素，避免误改用户手绘内容。
- 旧 Canvas 的系统生成黑框在重新加载、保存或 append 时被修复；不会主动扫描并重写所有历史 Canvas 文件。

### 阶段风险

- 已有旧画布中如果用户手动编辑过系统生成节点文本，repair 会尽量保留可见文本并只修复颜色和绑定。
- 如果旧画布存在完全无文本的系统矩形，repair 会将其视为导入残留空框并过滤。
