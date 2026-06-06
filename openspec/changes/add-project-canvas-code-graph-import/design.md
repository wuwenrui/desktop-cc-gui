## Context / 背景

Project Canvas v0 已经具备基础能力：Excalidraw-backed editor、全局 project-scoped storage、manager/editor surface，以及 structured context send path。

同时，Project Map Relationship Dashboard 已经有 deterministic `project-map-relations` artifacts，包括 files、relations、symbols、context packs、stale summary、repair issues 和 graph UI。

当前缺口是：Canvas 还是 drawing artifact，`project-map-relations` 还是 explorer。用户真正想要的是 bridge：从真实代码 method、relationship node、relationship edge 一键 materialize 到 Canvas，形成可复用的 project thinking surface。

核心边界：

```text
Fact source              Projection surface              AI layer
----------               ------------------              --------
code symbols        ->   Project Canvas semantic graph -> explanation
project-map-relations -> Excalidraw visual elements   -> grouping/risk notes
source evidence      ->  backlinks/stale indicators   -> suggested expansion
```

Canvas 不做 canonical fact store。它保存 source anchors 和 projected layout，不复制完整项目图谱。

## Goals / Non-Goals

**Goals / 目标：**

- 同时支持两个入口：code selected method 和 `project-map-relations` selected node/edge。
- 定义统一 `source anchor` model，让两个入口共用 projection pipeline。
- 从 bounded caller/callee 或 relation neighborhood 生成可读 Canvas graph。
- 每个 fact-backed Canvas node/edge 都保留 source traceability。
- AI 可以 explain / group / mark risk，但不能修改 authoritative facts。
- 继续使用现有 app-global / project-scoped Project Canvas storage。

**Non-Goals / 非目标：**

- 不在第一批实现 full IDE/LSP integration for every language。
- 不做 unlimited whole-project call graph。
- 不从 Canvas reverse sync 到 Project Map 或 `project-map-relations`。
- 不改变 remote Project Canvas global storage ownership。
- 不用 Project Canvas 替代 Relationship Dashboard。

## Decisions / 关键决策

### Decision 1: 先定义 source anchor，再生成 drawing elements

推荐模型：

```ts
type CanvasSourceAnchor =
  | {
      kind: "code-symbol";
      workspaceId: string;
      filePath: string;
      symbolId?: string;
      symbolName: string;
      symbolKind: "function" | "method" | "class" | "module" | "unknown";
      selectionRange?: SourceRange;
      definitionRange?: SourceRange;
      resolvedBy: "relationship-symbols" | "editor-selection" | "fallback-text";
    }
  | {
      kind: "relationship-node";
      workspaceId: string;
      scanRunId: string;
      nodeId: string;
      nodeKind: "file" | "symbol" | "module" | "unknown";
      filePath?: string;
      symbolId?: string;
    }
  | {
      kind: "relationship-edge";
      workspaceId: string;
      scanRunId: string;
      edgeId: string;
      relationKind: string;
      sourceNodeId: string;
      targetNodeId: string;
      evidenceIds: string[];
    };
```

理由：

- Excalidraw elements 是 presentation，source anchors 才是 product semantics。
- 代码里选中的 symbol 和 relationship graph 里选中的 node/edge 可以汇入同一 pipeline。
- Stable anchors 支持 refresh、stale detection、source backlink。

不采用方案：直接把 metadata 挂在 Excalidraw element 上。这个做法快，但会把业务事实和绘图实现绑死。

### Decision 2: Deterministic projection before AI

导入流程必须先确定事实图，再让 AI 解释：

```text
Import request
  -> resolve source anchor
  -> query bounded graph neighborhood
  -> normalize to CanvasSemanticGraph
  -> layout to CanvasProjection
  -> merge into IntentCanvasDocument
  -> optionally attach AI explanation annotations
```

推荐 semantic graph shape：

```ts
type CanvasSemanticGraph = {
  graphId: string;
  createdAt: string;
  sourceSnapshot?: {
    kind: "project-map-relations";
    scanRunId: string;
    snapshotVersion?: string;
  };
  nodes: CanvasSemanticNode[];
  edges: CanvasSemanticEdge[];
  importOptions: {
    depth: number;
    direction: "callers" | "callees" | "both" | "neighborhood";
    maxNodes: number;
    maxEdges: number;
  };
};
```

AI output 单独保存为 annotation，不混入 fact-backed graph：

```ts
type CanvasAiAnnotation = {
  id: string;
  targetGraphId: string;
  targetNodeIds?: string[];
  targetEdgeIds?: string[];
  annotationKind: "summary" | "risk" | "group" | "next-step";
  content: string;
  createdAt: string;
};
```

### Decision 3: Code selection first resolves through relationship symbols

代码选中方法的 MVP 不直接上 full LSP/AST。第一版按这个顺序：

1. 获取 active file path 和 editor selection range。
2. 查询 latest relationship `symbols` artifact。
3. 如果 symbol 能匹配 selection range/text，则创建 `code-symbol` anchor。
4. 从 relationship snapshot 查询 caller/callee。
5. 如果无法匹配，显示 unresolved state，不让 AI 猜调用图。

理由：

- `project-map-relations` 已经是当前 deterministic substrate。
- 避免第一版被多语言 LSP/AST complexity 拖垮。
- Code selection 只是 adapter，不应另起一个系统。

### Decision 4: Relationship node/edge import first

推荐实现顺序：

1. `relationship file-node -> Canvas`
2. `relationship edge -> Canvas`
3. `code selected symbol -> Canvas`
4. `AI explanation over imported graph`

理由：

- Relationship graph 已有 selection state 和 deterministic artifacts。
- 先验证 source-anchor + projection layer。
- 代码选择入口后续复用同一 projection functions。

### Decision 5: Store references and summaries, not full snapshots

Canvas document 可以新增 optional fields：

```ts
type IntentCanvasDocument = {
  semanticGraphs?: CanvasSemanticGraph[];
  aiAnnotations?: CanvasAiAnnotation[];
};
```

存储规则：

- 保存 source anchors、labels、relation kinds、evidence summaries、projected layout ids。
- 不保存完整 `project-map-relations` snapshot。
- 保存 scanRunId，用于 stale checks。
- 保存 workspace/project identity，用于 cross-project mismatch detection。

### Decision 6: Stale handling is visible but non-blocking

如果 Canvas 图来自 scan run A，而当前最新 scan run 是 B：

- 显示 `source snapshot stale`。
- 保留用户当前 drawing。
- 提供 refresh/re-project action。
- 如果 source file/symbol 消失，标记 unresolved anchor，但不删除元素。

这避免把用户手工编辑过的 Canvas 当成临时缓存误删。

### Decision 7: AI is an explainer, not fact source

AI context 包含：

- graph title / selected graph id
- nodes: labels、source anchors、file/symbol summaries、confidence/evidence summaries
- edges: relation kind、direction、evidence ids/summaries
- stale state
- current Canvas selection

AI output 只能成为 annotations 或 chat context。除非用户显式转换为 manual note，否则不能成为 fact-backed node/edge。

## Architecture Sketch / 架构草图

```text
Relationship Graph UI                 Code/File View
        |                                   |
        | selected node/edge                | selected method range
        v                                   v
  importFromRelation()                importFromCodeSelection()
        |                                   |
        +------------> SourceAnchorResolver <------------+
                                      |
                                      v
                         RelationshipGraphQuery
                                      |
                                      v
                         CanvasSemanticProjector
                                      |
                                      v
                         ExcalidrawProjectionAdapter
                                      |
                                      v
                         Project Canvas Document
                                      |
                                      v
                         AI Explanation Context
```

## UI Contract / 交互契约

- Relationship node context action: `导入 Canvas` / `Import to Canvas`。
- Relationship edge inspector action: `导入 Canvas` / `Import to Canvas`。
- File-node import is the primary action and MUST be labeled as `导入当前文件关系图` / `Import file graph`。
- Edge import is an evidence-level secondary action and MUST be labeled as `导入这条关系` / `Import this relation`。
- Code selection action: `导入调用图到 Canvas` / `Import call graph to Canvas`。
- Import target options:
  - Create new Canvas from graph。
  - Append to currently open Canvas。
  - Replace selected imported graph group after confirmation。
- Default import depth:
  - File node: complete bounded direct one-hop file relationship graph from the selected file perspective。
  - Edge: source + target + selected edge only。
  - Code symbol: callers + callees, depth 1。
- Hard limits:
  - Default max nodes: 40。
  - Default max edges: 80。
  - 超限时显示 summary cluster，并允许用户 deliberate expansion。

## Error Handling / 错误处理

- No active workspace：显示 Project Canvas unavailable state。
- No relationship snapshot：提示先 run relationship scan。
- Stale snapshot：允许导入，但标记 stale。
- Code selection cannot resolve symbol：显示 unresolved state，不生成 AI-guessed fact graph。
- Cross-project Canvas open：阻止导入或要求明确切换目标 project。
- Missing source file/range：保留 Canvas graph，标记 source anchor unresolved。

## Cross-platform compatibility / 跨平台兼容

- Source anchor 尽量使用 workspace-relative normalized paths。
- Display path 和 identity path 分开。
- 不假设 `/` 是唯一 path separator。
- Source range 使用 line/column，不把 byte offset 当作唯一身份。
- 导入逻辑不依赖 shell command；优先使用 Tauri commands 或已有 frontend state。

## Risks / Trade-offs

- [Risk] 没有 full LSP 时 code selection 解析会有歧义。→ Mitigation: 先走 relationship symbols，失败则 unresolved，不猜。
- [Risk] Canvas file 变成 stale graph copy。→ Mitigation: 保存 anchors 和 summaries，不复制完整 snapshot。
- [Risk] 大图不可读。→ Mitigation: bounded import、clusters、deliberate expand。
- [Risk] AI annotations 被误认为事实。→ Mitigation: 数据模型和视觉层都分离 AI output 与 fact-backed graph。
- [Risk] Relationship Dashboard 和 Canvas 职责混淆。→ Mitigation: Dashboard 是 explorer，Canvas 是 reusable planning/thinking surface。

## Migration Plan / 迁移计划

## Execution sequencing / 执行先后

- Scope gate: 本次变更以 `project-map-relations` 关系事实为唯一必选输入，不要求 API contract 扫描完成。
- 前置依赖：API contract branch 的独立 artifact namespace、ownership/stale 门控、redaction 能力需要保持稳定（`add-project-map-api-contract-view` 已定义）。
- 交付边界：Canvas 的 fact-backed graph 不依赖 API contract 发现器；API contract view 同样不反写 Project Map semantic nodes。
- 回退策略：若 API scanner 未稳定，可关闭 API-driven 上下文路径，Canvas import 主链路不受影响。

## OpenSpec coordination / 提案解耦策略

- 继续保持两个 OpenSpec change 独立提交与归档，避免高复杂度 adapter 工作阻塞 Canvas 的第一阶段交付。
- Canvas 侧预留 `source anchor` 的 schema，后续再增加 API endpoint / method chain 可选补充 context。
- 任何 cross-change 引入字段必须先声明 provenance（workspaceId、scanRunId、evidenceIds）并在 stale/unresolved path 中保留可见性，不与 fact graph 混淆。

1. 现有 Canvas documents 不需要迁移。
2. 没有 `semanticGraphs` 的 documents 继续按 plain drawing canvas 加载。
3. 新导入行为只新增 optional `semanticGraphs` / `aiAnnotations`。
4. source anchors 无法解析时，文档仍可编辑，只显示 stale/unresolved state。
5. 回滚时移除 import actions，并忽略 optional semantic fields，不删除用户画布。

## Open Questions / 待确认问题

- 哪个现有 editor/file-view surface 最适合承载 code-selection import action？
- 默认导入目标应该是 new Canvas，还是 append to current Canvas？
- 当前 relationship `symbols` artifact 和 edge evidence ids 中哪些字段最稳定？
- depth 2 是否放入 MVP advanced option，还是等性能数据后再做？

## Code Calibration - 2026-06-06 / 代码校准

### Existing implementation facts / 当前代码事实

- `project_map_relationship_read` 已返回 MVP 需要的 artifacts：manifest、files、relations、symbols、context pack、stale summary、repair issues。
- `ProjectMapRelationshipSection` 已持有 selected file id、inspected file id、selected relation id。
- `ProjectMapRelationshipSection` 已计算 centered selected file、incoming lane、outgoing lane、secondary nodes、aggregate nodes、bounded edges。
- 2026-06-06 calibration: Relationship edge import is intentionally single-edge; file-node import is the primary path for importing the selected file's complete bounded direct relationship graph into Canvas。
- 2026-06-06 implementation correction: file-node import MUST use the current Relationship Inspector direct relation set as the source of truth, because the inspector already resolves the selected file's incoming/outgoing relation count and endpoint files. Re-reading storage for this action can drift from the user's selected visual state.
- 2026-06-06 projection correction: Canvas visual projection MUST create real Excalidraw bindings. Node title/path text is bound to the node container via `containerId` and node `boundElements`; relation arrows are bound to source/target node containers via `startBinding` / `endBinding`. Standalone text next to a rectangle is not an acceptable node label implementation.
- 2026-06-06 edge-label correction: Canvas relation labels MUST preserve the method/function call candidate when Project Map has one, such as `ApiResponse.success` or `error.getDefaultMessage`. Relation kind (`calls`, `imports`, `configures`) is metadata/fallback, not the primary label for method-level evidence.
- 2026-06-06 target correction: Relationship import target chooser implements `new Canvas` and `append to selected existing Canvas`. Append is owned by Intent Canvas Manager through `canvasId + target=append` and merges projected elements/links/semanticGraphs into the target document. `replace selected imported graph group` is deferred until Canvas selection and deletion semantics are explicit.
- 2026-06-06 navigation correction: Canvas documents containing `project-map-relations` imported graphs expose a topbar return link to Project Knowledge Map, preserving source navigation from relationship exploration to projection editing.
- 2026-06-06 visual projection correction: Canvas edge labels MUST be bound text on the arrow container, not free-floating nearby text. Imported file nodes SHOULD use role-aware visual styling and multi-lane placement to reduce dense graph monotony.
- 当前 Relationship Dashboard 默认渲染的是 file nodes 和 relation edges，不是 symbol-level graph nodes。
- 当前 target-symbol resolution 使用 `ProjectMapRelationshipSymbol.fileId`、`name`、`line`；range/column 不保证存在。
- 当前 `IntentCanvasDocument` normalizer 会从 Excalidraw scene 重建 `aiContext`，不会自动保留未知 semantic graph fields。
- 现有 file navigation 和 OpenCode LSP utilities 支持 line/column actions，但还没有 Project Canvas active editor selection import action。

### Calibrated implementation path / 校准后的实现路径

1. 先从 Relationship Dashboard 复用 file-node relationship model，按 selected file 生成完整 bounded direct neighborhood。
2. 先给 Project Canvas document 增加 optional semantic graph fields 和 normalizers。
3. 先实现 relationship file-node import 和 edge import。
4. 第一版 code symbol anchor 支持 line-level source anchor；range/column 有就填，没有不阻塞。
5. active editor/file-view 能提供 workspace id、relative path、selected text、line-level location 后，再接 code-selection import。
6. OpenCode LSP 可以作为 enrichment/fallback，不作为 Phase 2 primary fact source。

### Proposal calibration / 提案校准

原始 `source anchor` contract 保持有效，但 MVP 里 `relationship-node` 先按 `file` node 理解。`symbol` node 保留在协议里，等 relationship graph 后续支持 symbol nodes 再落地。

`edge import` 只代表 selected source-target evidence relation；它不是 file-level graph import 的替代品。用户需要完整关系时，应使用 file inspector 的 `Import all file relations` 主操作，并导入当前 inspector 中显示的 direct relation set。

Canvas visual elements must stay structurally connected after import: moving a file node should move its title/path label with the node and keep relation arrows attached to the source/target containers.

`code-symbol` anchor 保持有效，但 `selectionRange` / `definitionRange` 是 optional enhancement，不是第一版必要条件。
