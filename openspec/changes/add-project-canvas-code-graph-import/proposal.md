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
