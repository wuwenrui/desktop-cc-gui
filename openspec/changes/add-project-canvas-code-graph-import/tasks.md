# Tasks: Project Canvas Code Graph Import

## 1. OpenSpec and product boundary / 规范与边界

- [x] 1.1 Create proposal/design/spec/tasks for Project Canvas Phase 2 code graph import.
- [x] 1.2 Confirm naming boundary：用户侧叫 `Project Canvas`，实现可暂时复用现有 `Intent Canvas` slice，除非另开 rename change。
- [x] 1.3 Confirm this change does not mutate `project-map-relations` storage、Project Map semantic graph、global Project Canvas storage root。

## 2. Source anchor and semantic graph model / 语义模型

- [ ] 2.1 Define `CanvasSourceAnchor` union：code symbols、relationship nodes、relationship edges。
- [ ] 2.2 Define `CanvasSemanticGraph`、`CanvasSemanticNode`、`CanvasSemanticEdge`、`CanvasAiAnnotation` types。
- [ ] 2.3 Add schema normalization：旧 Canvas documents 没有 semantic fields 也必须继续加载。
- [ ] 2.4 Add serialization guards：semantic graph metadata 不允许持久化完整 relationship snapshots。
- [ ] 2.5 Preserve optional semantic graph fields through `IntentCanvasDocument` normalize/save/clone flows。

## 3. Relationship graph query substrate / 关系图数据底座

- [ ] 3.1 Identify stable fields in latest `project-map-relations` files、symbols、relationships、evidence、manifest artifacts。
- [ ] 3.2 Add or adapt read/query API for selected node neighborhood。
- [ ] 3.3 Add or adapt read/query API for selected edge source-target relation and evidence summary。
- [ ] 3.4 Add stale comparison helper：比较 imported scanRunId 和 latest relationship snapshot。
- [ ] 3.5 Add cross-platform path normalization for source anchors。

## 4. Canvas projection pipeline / Canvas 投影管线

- [ ] 4.1 Extract or reuse existing Relationship Dashboard file-node graph view model as first projection input。
- [ ] 4.2 Implement source-anchor resolver for relationship file-node import。
- [ ] 4.3 Implement source-anchor resolver for relationship edge import。
- [ ] 4.4 Implement deterministic graph projector：bounded neighborhood -> Canvas semantic graph。
- [ ] 4.5 Implement Excalidraw projection adapter：semantic nodes/edges -> visual elements。
- [ ] 4.6 Add default limits and summary nodes for dense neighborhoods。
- [ ] 4.7 Add merge behavior：append-to-current Canvas、create-new Canvas。

## 5. Relationship Dashboard entry points / 关系图入口

- [ ] 5.1 Add `Import to Canvas` action for selected relationship graph node。
- [ ] 5.2 Add `Import to Canvas` action for selected relationship graph edge or edge inspector。
- [ ] 5.3 Add import target chooser：new Canvas、current Canvas、replace selected imported graph group after confirmation。
- [ ] 5.4 Add i18n keys for relationship import actions and error states。
- [ ] 5.5 Keep relationship graph click semantics unchanged；import action must not overload node body click。

## 6. Code selection entry point / 代码选择入口

- [ ] 6.1 Identify active file/code selection surface that can provide workspace id、file path、selected text、source range。
- [ ] 6.2 Add lightweight adapter if active editor/file view does not expose selection state to Project Canvas。
- [ ] 6.3 Resolve selection against relationship `symbols` artifact before fallback path。
- [ ] 6.4 Support line-level symbol anchors when range/column data is unavailable。
- [ ] 6.5 Import callers/callees for resolved method/function symbol with default depth 1。
- [ ] 6.6 Show unresolved-symbol state when selection cannot resolve。
- [ ] 6.7 Ensure AI is not used to invent fact-backed call graph edges。

## 7. Canvas source backlinks and stale state / 来源回跳与状态

- [ ] 7.1 Add node action to open source file/range when available。
- [ ] 7.2 Add edge action to inspect source relationship evidence。
- [ ] 7.3 Show stale snapshot state for imported graph groups。
- [ ] 7.4 Show unresolved source state without deleting Canvas content。
- [ ] 7.5 Add refresh/re-project affordance when source anchors can still resolve。

## 8. AI explanation layer / AI 解释层

- [ ] 8.1 Build structured AI context payload from selected imported semantic graph。
- [ ] 8.2 Add explain/group/risk/next-step actions for imported graph。
- [ ] 8.3 Store AI result as `CanvasAiAnnotation` or chat-only output, not as fact-backed graph data。
- [ ] 8.4 Visually distinguish AI annotations from imported source-backed graph elements。

## 9. Testing and quality gates / 测试与质量门禁

- [ ] 9.1 Add unit tests for source anchor normalization and cross-platform paths。
- [ ] 9.2 Add unit tests for relationship node/edge projection limits。
- [ ] 9.3 Add unit tests for code selection symbol resolution and unresolved fallback。
- [ ] 9.4 Add tests for stale/unresolved source state。
- [ ] 9.5 Add focused frontend tests for relationship import actions and Canvas append/new flows。
- [ ] 9.6 Add focused tests for AI context payload excluding non-fact annotations from fact graph。
- [ ] 9.7 Run focused frontend tests、typecheck、relevant Rust tests before closure。

## 10. Documentation and closure / 文档与收口

- [ ] 10.1 Update Project Canvas user-facing copy and documentation for graph import。
- [ ] 10.2 Update OpenSpec artifacts with implementation calibration notes after coding。
- [ ] 10.3 Verify strict OpenSpec validation before sync/archive。
