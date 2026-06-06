# Tasks: Project Canvas Code Graph Import

## 0. Cross-change prework / 前置对齐（与 API contract view 解耦）

- [ ] 0.1 Confirm API contract namespace and ownership baseline is stable before using API artifacts in Canvas context (`project-map-relations/<storage-key>/api-contracts/`).
- [ ] 0.2 Confirm API scan branch failures do not degrade `project-map-relations` or `global Project Canvas` behavior.
- [ ] 0.3 Confirm Canvas import pipeline can run with `project-map-relations` only, with API artifacts treated as optional additive context.
- [ ] 0.4 Add explicit changelog note: API adapter/parser maturity is not a blocker for relationship/node-edge/CANVAS import MVP.
- [ ] 0.5 Add reviewer checklist item: no cross-change scope drift (Canvas does not consume speculative API results).

## 1. OpenSpec and product boundary / 规范与边界

- [x] 1.1 Create proposal/design/spec/tasks for Project Canvas Phase 2 code graph import.
- [x] 1.2 Confirm naming boundary：用户侧叫 `Project Canvas`，实现可暂时复用现有 `Intent Canvas` slice，除非另开 rename change。
- [x] 1.3 Confirm this change does not mutate `project-map-relations` storage、Project Map semantic graph、global Project Canvas storage root。

## 2. Source anchor and semantic graph model / 语义模型

- [x] 2.1 Define `CanvasSourceAnchor` union：code symbols、relationship nodes、relationship edges。
- [x] 2.2 Define `CanvasSemanticGraph`、`CanvasSemanticNode`、`CanvasSemanticEdge`、`CanvasAiAnnotation` types。
- [x] 2.3 Add schema normalization：旧 Canvas documents 没有 semantic fields 也必须继续加载。
- [x] 2.4 Add serialization guards：semantic graph metadata 不允许持久化完整 relationship snapshots。
- [x] 2.5 Preserve optional semantic graph fields through `IntentCanvasDocument` normalize/save/clone flows。

## 3. Relationship graph query substrate / 关系图数据底座

- [x] 3.1 Identify stable fields in latest `project-map-relations` files、symbols、relationships、evidence、manifest artifacts。
- [x] 3.2 Add or adapt read/query API for selected node neighborhood。
- [x] 3.3 Add or adapt read/query API for selected edge source-target relation and evidence summary。
- [x] 3.4 Add stale comparison helper：比较 imported scanRunId 和 latest relationship snapshot。
- [x] 3.5 Add cross-platform path normalization for source anchors。

## 4. Canvas projection pipeline / Canvas 投影管线

- [x] 4.1 Extract or reuse existing Relationship Dashboard file-node graph view model as first projection input。
- [x] 4.2 Implement source-anchor resolver for relationship file-node import。
- [x] 4.3 Implement source-anchor resolver for relationship edge import。
- [x] 4.4 Implement deterministic graph projector：bounded neighborhood -> Canvas semantic graph。
- [x] 4.5 Implement Excalidraw projection adapter：semantic nodes/edges -> visual elements。
- [x] 4.6 Add default limits and summary nodes for dense neighborhoods。
- [x] 4.8 Bind imported node labels and relation arrows using Excalidraw container/binding metadata。
- [x] 4.9 Bind relation method labels to arrows and add role-aware graph styling。
- [x] 4.10 Remove generated lane header labels from Canvas export；relationship regions are represented by layout and source-backed nodes/edges only。
- [x] 4.7 Add merge behavior：append-to-selected existing Canvas、create-new Canvas。

## 5. Relationship Dashboard entry points / 关系图入口

- [x] 5.1 Add `Import to Canvas` action for selected relationship graph node。
- [x] 5.2 Add `Import to Canvas` action for selected relationship graph edge or edge inspector。
- [x] 5.3 Add import target chooser：new Canvas、specific existing Canvas。
- [x] 5.4 Add i18n keys for relationship import actions and error states。
- [x] 5.5 Keep relationship graph click semantics unchanged；import action must not overload node body click。
- [x] 5.6 Split file graph import copy from edge evidence import copy。
- [ ] 5.7 Add replace selected imported graph group after confirmation。

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
- [x] 7.6 Add Canvas topbar return link back to Project Knowledge Map for imported relationship graphs。

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
- [x] 10.2 Update OpenSpec artifacts with implementation calibration notes after coding。
- [ ] 10.3 Verify strict OpenSpec validation before sync/archive。
