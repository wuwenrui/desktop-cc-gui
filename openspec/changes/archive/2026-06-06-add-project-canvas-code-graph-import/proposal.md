## Why / 为什么要做

Project Canvas v0 已经完成了最基础的画布能力：可以画图、可以保存到全局项目分层目录、也可以作为简单上下文发给 AI。

但现在它本质上还是一个 user-authored whiteboard（用户手动画板）。下一阶段要让它变成 project intelligence surface（项目智能画布）：用户不需要手动画调用关系，而是可以从真实代码、`project-map-relations` 节点或关系线直接导入图谱。

这次变更定义 Project Canvas Phase 2：支持从代码选中方法、从 `project-map-relations` 选中节点/线导入 Canvas，并生成可追溯的调用关系图/项目关系图。

核心原则：

- Graph first, AI second。
- 事实源来自 code symbols / project-map-relations。
- Canvas 是 projection workbench（投影工作台），不是新的事实数据库。
- 当前 MVP 中，AI 只消费 imported semantic graph 的 structured context；Canvas 内 explain / group / risk annotation action 延后到后续 change，不负责凭空制造事实。

## 目标与边界

- 目标：用户在代码里选中一个 method/function 后，可以导入 Project Canvas，自动生成 caller/callee 层级图。
- 目标：用户在 `project-map-relations` graph 里选中节点后，可以导入 Project Canvas，生成该节点的一跳 neighborhood graph。
- 目标：用户在 `project-map-relations` graph 里选中 edge/line 后，可以导入 Project Canvas，生成 source -> target 的关系图。
- 目标：Canvas 里的节点和连线都保留 source anchor（来源锚点），后续可以回跳文件、symbol、relationship evidence。
- 目标：Canvas 可以显示 stale/unresolved 状态，告诉用户这张图是否来自旧 scan run，或者源代码是否已经消失。
- 目标：用户可以把已导入的 semantic graph 作为 structured context 发送给 AI，并在聊天历史中看到 send-audit 证据卡。
- 边界：Canvas 内 AI explain / group / risk / next-step annotation workflow 不属于当前 MVP。
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
  - `source anchor -> graph query -> semantic graph -> Excalidraw projection -> structured AI context handoff`
- Canvas document 增加 optional semantic graph metadata，例如 `semanticGraphs` 和 `aiAnnotations`。
- Canvas 节点/线增加 source backlink：
  - open source file/range
  - inspect relationship evidence
  - show stale/unresolved source state
- Intent Canvas / Project Canvas 发送上下文会基于 imported graph 构建 structured compact JSON，并展示可回放的 send-audit card。
- `CanvasAiAnnotation` schema 会被保留和 normalize，但当前不提供 Canvas 内 AI annotation 操作入口。
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
- AI context handoff 只能基于 imported semantic graph、evidence summary 和 bounded visual text。
- AI output 不允许写成 fact-backed graph nodes/edges；Canvas 内 AI annotations 的创建与视觉处理延后到后续变更。
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

## Debug Calibration - 2026-06-07 / 调试校准

本次实现过程中暴露了两个必须记录的工程事实：

1. 文件编辑页的 `关联 Canvas` 入口生成方法关系图时，`createCodeSelectionRelationshipGraph()` 不允许引用自由变量 `anchor`。
   - 正确 contract 是：该函数只消费 `input.anchor: IntentCanvasCodeSelectionAnchor`。
   - graph id、source summary、line label、source selection 都必须从 `input.anchor` 或统一 helper 派生。
   - 已修复的运行时错误：`Can't find variable: anchor`。

2. 方法/行号 label 不允许散落手写。
   - 正确 helper 是 `formatCodeAnchorLineLabel(anchor)`。
   - 禁止在 projector 内重复写 `anchor.startLine === anchor.endLine ? ... : ...`。
   - 原因：single-line / multi-line selection label 是 source-anchor contract 的一部分，不能每个调用点各自拼接。

3. Intent Canvas 发送审计 UI 的稳定性不能靠 message reducer 猜测修复。
   - 错误路径：在 `threadReducerOptimisticItemMerge` 里按 text key 或 user index 迁移 `intentCanvasContextAttachments`。
   - 问题：Codex optimistic user text、visible user text、remote history text 可能不同；reducer 层无法可靠判断哪条真实 user message 应该继承 Canvas audit metadata。
   - 正确方向：与 memory context / user image hydrate 一样，在 Codex history loader 层从 raw turn item 或 local fallback history hydrate Intent Canvas attachment，再交给 message renderer 展示。

4. 本变更的长期原则仍是 `Graph first, AI second`。
   - 代码编辑器、relationship dashboard、chat context 三个入口都只能消费 deterministic `CanvasSemanticGraph` / `CanvasSourceAnchor`。
   - AI 只能解释已导入的 source-backed graph，不能补造 fact-backed edge。

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
- Method-level selected code import 已完成当前 MVP：编辑器 `关联 Canvas` 会从当前行解析 enclosing declaration，生成 method-centered semantic graph，并用 declaration block reference tokens 匹配当前 relationship snapshot 中的事实关系。

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

## 阶段性回写：source backlinks / stale / unresolved（2026-06-06）

本阶段继续推进 imported relationship graph 的来源追溯能力，补齐 Canvas editor 中对 source anchor 的运行态投影。

### 实现校准

- Canvas editor 右侧 rail 增加 `Source traceability` 区块，展示 imported graph 数量、stale graph 数量和 unresolved anchor 数量。
- imported relationship node 的 `filePath` 会作为 source backlink，用户可从 Canvas 打开 source file；code-symbol anchor 在有 range 时支持 line/column。
- imported relationship edge 增加轻量 `evidenceRefs` projection metadata，只保存 evidence id、path、line、excerpt/label，不复制完整 relationship snapshot。
- edge evidence action 优先打开 file-backed evidence ref；无 file-backed ref 时保留 evidence 状态但不伪造文件链接。
- Canvas 会读取当前 `project-map-relations` snapshot 的 scan run、file ids、relation ids，用于判断 stale/unresolved；判断结果只用于 UI，不删除用户画布元素。
- file-level relationship import 已改为传递真实 `scanRunId`；如果无法取得 scan summary，才保留 `relationship-dashboard-current` fallback。
- refresh/re-project affordance 当前作为返回 Project Knowledge Map 的 CTA 提供，避免在 Canvas 内直接做 destructive overwrite。

### 行为边界

- 不新增 Rust command，不改变 Project Canvas 全局存储根。
- 不把 Canvas 内容反写 Project Map 或 `project-map-relations`。
- 不自动删除 unresolved node/edge，也不自动覆盖用户手工编辑过的画布内容。
- `replace selected imported graph group` 已撤销；最终保留 `New Canvas` 和 `Append to existing Canvas` 两条稳定导入路径。

## 阶段性回写：declaration-only code selection anchor（2026-06-06）

本阶段推进代码选择入口，但按 UX 决策收敛为 declaration-only provenance。

### 实现校准

- File View 继续复用现有 active editor line range，不新增全局 selection store。
- File View 只在当前行命中 class / method / function / property / interface / enum / record / type / struct / trait declaration 时发布 `active-editor-selection` anchor。
- 普通调用行、控制流、import、注释、空行不会形成 Canvas code anchor；关系 evidence 仍可指向任意调用行，两者语义分离。
- Project Map relationship import 会把 active declaration anchor 写入 `CanvasSemanticGraph.sourceSelection`，作为 graph-level provenance，而不是临时 UI state。
- Project Map 导入操作区显示弱提示；Intent Canvas 右侧 `Source traceability` 显示可点击的 code selection chip，可跳回声明行。

### 行为边界

- 本阶段不解析 relationship `symbols` artifact，不推断 callers/callees。
- 本阶段不使用 AI 生成 fact-backed call graph edge。
- 未命中 declaration line 时不报错、不弹 toast、不阻断导入。

## 阶段性回写：code selection entry visibility（2026-06-06）

- The code-selection Canvas entry now lives in the active file editor toolbar as a small `关联 Canvas / Link Canvas` action when the cursor/selection resolves to a class / method / property declaration anchor.
- Relationship import actions no longer render a large empty source-anchor card; when a declaration anchor exists, the inspector only shows a compact source chip.
- Linking from the editor opens a file-mode Intent Canvas with a fact-backed `sourceSelection` backlink and does not invent callers/callees or relationship edges.
- This is a UI/UX correction for task `6.8`; symbol resolution and caller/callee graph expansion remain in `6.3` and `6.5`.

## 阶段性回写：editor Canvas entry fallback visibility（2026-06-06）

- The editor toolbar `关联 Canvas / Link Canvas` entry is now always visible when the file editor can open Intent Canvas, instead of disappearing when declaration-anchor parsing is not yet available.
- Code anchor capture is decoupled from chat file-reference mode; `fileReferenceMode=none` no longer hides the Canvas linking entry or blocks declaration anchor resolution.
- Clicking the entry resolves the current declaration line at action time; unresolved lines show a short user-facing message and are not written into Canvas source metadata.

## 阶段性回写：method Canvas fact graph correction（2026-06-07）

- The editor `关联 Canvas / Link Canvas` action no longer opens a default file-mode seed template for method/class/property anchors.
- The action now resolves the active declaration against the relationship `symbols` artifact, expands the declaration block line range, and imports only fact-backed relations whose evidence touches the declaration block or symbol name.
- If the relationship snapshot, current file, symbol, or matched relations cannot be resolved, the UI shows an explicit toast and does not create a placeholder Canvas.
- The generated semantic graph uses the selected declaration as the center symbol node, writes symbol kind / file / line range / relation count into that center element, and connects related files with solid bound relationship arrows.
- This completes tasks `6.3`, `6.5`, `6.6`, and `6.7` for the current method-entry implementation pass.

## 阶段性回写：method reference-token graph correction（2026-06-07）

- The editor code anchor now carries bounded `referenceTokens` extracted from the selected declaration block, such as method calls, qualified references, static method references, and class-like symbols.
- Method Canvas generation no longer blocks when the relationship `symbols` artifact misses the selected declaration; symbol resolution is used as metadata enrichment, with declaration + token matching as fallback.
- Relationship matching now checks the selected method range, method name, extracted reference tokens, relation call candidate, evidence path/excerpt, and source/target file path/basename.
- If a method has no matched relation in the current fact snapshot, the action still creates a method-centered Canvas graph instead of showing a hard failure toast; AI is still not allowed to invent missing fact edges.
- The editor entry reads `project-map-relations` from the active Project Map read location, avoiding false negatives when the user is working from project-local relationship storage.
- The editor toolbar action can now be triggered from any line inside an enclosing declaration block; the stored provenance still points back to the declaration line, not the arbitrary cursor line.

## 阶段性回写：send audit JSON viewer stability（2026-06-07）

- Intent Canvas send-audit cards no longer expand compact JSON inline inside the message history row.
- The card now keeps the same summary footprint and opens the compact JSON in a bounded modal, following the existing Project Memory payload viewer pattern.
- The modal uses its own fixed overlay, Escape / close button dismissal, internal scrolling, and wrapped compact JSON text so a long one-line payload cannot erase or visually push away conversation history.
- This does not change the actual Intent Canvas transmission payload; it only changes how the audit payload is inspected in the chat UI.

## 阶段性回写：send audit history replay stability（2026-06-07）

- Historical thread replay now preserves Intent Canvas send-audit cards by hydrating `intentCanvasContextAttachments` at the `threadItems` user-message adapter boundary.
- The adapter first accepts explicit camelCase / snake_case attachment fields from the thread item or metadata, then falls back to parsing the compact JSON marker from user text.
- Attachments are de-duplicated by `attachmentId`, so local optimistic replay, remote Codex history, and fallback session history can converge without duplicate audit cards.
- The send-audit card surface was changed from a blue gradient to a theme-compatible single-color surface, while keeping the existing accent border, chips, and modal payload viewer.

## 阶段性回写：Claude history send-audit boundary（2026-06-07）

- Claude / Claude Code 新历史里已经可以显示 Intent Canvas send-audit card，前提是历史 user text 或 thread item 中仍保留 compact JSON marker。
- 旧历史如果没有保存 compact JSON payload，前端不做 retroactive backfill；缺 payload 时无法证明本轮发送过哪一份 Canvas context。
- 禁止为了补旧历史而在 reducer 层按 visible text、tab title、assistant mention、user turn index 猜测 `intentCanvasContextAttachments`。
- 正确边界是 best-effort replay：新发送和保留 raw compact JSON 的历史可以展示审计卡；pre-fix legacy history 只在有可解析 payload 时展示。
- 这条边界避免把审计卡从“发送证据”降级成“UI 猜测”，也避免误把某张 Canvas 挂到错误的 Claude turn 上。

## 最终校准：current-code-first MVP boundary（2026-06-07）

- 当前已提交代码的主交付是 Project Map relationship graph / selected edge / editor code declaration 到 Project Canvas 的 deterministic graph import。
- 当前代码会持久化 `semanticGraphs`、source anchors、evidence summaries、layout references，并通过 scene sanitize / append merge 避免旧 Canvas 合并导入时出现黑框、空框、未绑定虚线。
- 当前代码支持 Canvas editor source traceability、source file backlink、edge evidence backlink、stale/unresolved summary 和返回 Project Knowledge Map navigation。
- 当前代码支持 Intent Canvas structured context handoff：从 imported semantic graph、source anchors、evidence summaries 和 visual text 构建 compact JSON payload，并在实时与可解析历史中展示 send-audit card。
- 当前代码不消费 API contract artifacts；API parser / adapter 成熟度不是本 change 的 blocker，API context 只能作为未来 additive context。
- 当前代码保留 `CanvasAiAnnotation` 类型和 storage normalization，但没有提供 Canvas 内 explain / group / risk / next-step action，也没有渲染 AI annotation layer；这部分从当前 MVP 验收中移除，后续另开 change。
- Reviewer checklist：归档前不要用“是否已有 Canvas 内 AI annotation action”阻塞当前 MVP；应检查 graph import、source traceability、bounded projection、send-audit replay 和 non-guessing boundary 是否成立。

## 收口回写：testing / validation boundary（2026-06-07）

- Existing focused tests already cover key implementation risks introduced during this change:
  - `src/features/intent-canvas/utils/context.test.ts` covers semantic graph transmission context priority and visual text compression disclosure.
  - `src/features/intent-canvas/utils/scene.test.ts` covers generated relationship palette compatibility, unique generated element ids, legacy dark element repair, and empty generated relationship node cleanup.
  - `src/features/intent-canvas/components/IntentCanvasManager.test.tsx` covers stale/unresolved source state projection and evidence-backed source opening.
- This closure pass did not run frontend tests, typecheck, Rust tests, or `openspec validate --strict`; validation command execution remains pending explicit user confirmation.
- Dedicated future tests should still be added for Relationship Dashboard import action wiring, editor code-selection symbol-resolution fallback branches, and append/new target flows if this change is archived into a long-lived release baseline.
- Current OpenSpec task closure is therefore artifact-accurate, not runtime-verified: all product scope decisions are reconciled with current code, while validation execution is intentionally not claimed.
