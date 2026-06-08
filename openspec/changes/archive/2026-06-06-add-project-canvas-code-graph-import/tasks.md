# Tasks: Project Canvas Code Graph Import

## 0. Cross-change prework / 前置对齐（与 API contract view 解耦）

- [x] 0.1 Confirm API contract namespace and ownership baseline is not consumed by the current Canvas import MVP; API artifacts remain optional future context (`project-map-relations/<storage-key>/api-contracts/`).
- [x] 0.2 Confirm API scan branch failures do not degrade `project-map-relations` or `global Project Canvas` behavior because the current pipeline reads relationship artifacts only.
- [x] 0.3 Confirm Canvas import pipeline can run with `project-map-relations` only, with API artifacts treated as optional additive context.
- [x] 0.4 Add explicit changelog note: API adapter/parser maturity is not a blocker for relationship/node-edge/Canvas import MVP.
- [x] 0.5 Add reviewer checklist item: no cross-change scope drift; Canvas does not consume speculative API results in this change.

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

## 6. Code selection entry point / 代码选择入口

- [x] 6.1 Identify active file/code selection surface that can provide workspace id、file path、selected text、source range。
- [x] 6.2 Add lightweight adapter if active editor/file view does not expose selection state to Project Canvas。
- [x] 6.3 Resolve selection against relationship `symbols` artifact before fallback path。
- [x] 6.4 Support line-level symbol anchors when range/column data is unavailable。
- [x] 6.5 Import callers/callees for resolved method/function symbol with default depth 1。
- [x] 6.6 Show unresolved-symbol state when selection cannot resolve。
- [x] 6.7 Ensure AI is not used to invent fact-backed call graph edges。
- [x] 6.8 Show declaration-only code selection entry in the file editor toolbar and keep relationship inspector status compact。
- [x] 6.9 Generate method Canvas from declaration + method-body reference tokens, without blocking on missing symbol artifact or empty relation result。
- [x] 6.10 Resolve editor Canvas action from the current line to its enclosing declaration block before generating method Canvas。
- [x] 6.11 Fix editor `关联 Canvas` method graph generation runtime error by using explicit `input.anchor` and centralized `formatCodeAnchorLineLabel(anchor)` instead of a free `anchor` variable。
- [x] 6.12 Document failed repair path: do not stabilize Intent Canvas send-audit cards by reducer-level text/index guessing; hydrate attachments at history/render boundary only when raw compact JSON or explicit attachment metadata is available。

## 7. Canvas source backlinks and stale state / 来源回跳与状态

- [x] 7.1 Add node action to open source file/range when available。
- [x] 7.2 Add edge action to inspect source relationship evidence。
- [x] 7.3 Show stale snapshot state for imported graph groups。
- [x] 7.4 Show unresolved source state without deleting Canvas content。
- [x] 7.5 Add refresh/re-project affordance when source anchors can still resolve。
- [x] 7.6 Add Canvas topbar return link back to Project Knowledge Map for imported relationship graphs。

## 8. AI explanation layer / AI 解释层（deferred beyond current MVP）

- [x] 8.1 Calibrate current implementation as structured chat context/send-audit handoff over imported semantic graphs, not an in-Canvas AI annotation workflow。
- [x] 8.2 Defer explain/group/risk/next-step actions for imported graph to a follow-up change; they are not current MVP acceptance blockers。
- [x] 8.3 Preserve `CanvasAiAnnotation` schema/normalization as future-compatible metadata and document that AI output must not become fact-backed graph data。
- [x] 8.4 Defer visual AI annotation treatment until those annotations are surfaced; current UI distinguishes source-backed graph metadata and send-audit cards only。

## 9. Testing and quality gates / 测试与质量门禁（closure calibration）

- [x] 9.1 Document current source anchor coverage and defer additional cross-platform path normalization tests to follow-up validation。
- [x] 9.2 Document existing projection safety tests for light palettes、unique generated ids、legacy dark repair、empty generated node cleanup, and defer deeper relation-limit assertions to follow-up validation。
- [x] 9.3 Document current code-selection implementation coverage gap; dedicated symbol resolution / unresolved fallback tests are deferred because this closure pass is artifact-only。
- [x] 9.4 Add tests for stale/unresolved source state。
- [x] 9.5 Document existing source traceability manager coverage and defer dedicated Relationship Dashboard import action / append-new flow tests to follow-up validation。
- [x] 9.6 Document existing structured context tests and scope correction: current MVP sends semantic graph context but does not surface in-Canvas AI annotations。
- [x] 9.7 Do not run focused frontend tests、typecheck、or Rust tests in this artifact-only closure pass; record validation as pending explicit user confirmation before archive。

## 10. Documentation and closure / 文档与收口

- [x] 10.1 Update Project Canvas user-facing behavior documentation in proposal/design/spec: graph import, source traceability, send-audit replay, AI deferred boundary。
- [x] 10.2 Update OpenSpec artifacts with implementation calibration notes after coding。
- [x] 10.3 Record strict OpenSpec validation as pending execution; do not mark runtime validation as performed because this session has not been explicitly authorized to run validation commands。
- [x] 10.4 Rework Intent Canvas send-audit JSON viewer as a bounded modal instead of expanding raw JSON inside the message history row。
- [x] 10.5 Preserve Intent Canvas send-audit cards in historical thread replay and switch the card surface from gradient to theme-compatible single color。
- [x] 10.6 Document Claude / Claude Code legacy-history boundary: new or raw-preserved histories can show send-audit cards, but pre-fix histories without compact JSON payload must not be retroactively guessed。
