## Context

v0.5.3 已经把 Project Knowledge Map 推到可用形态：全局生成、增量合并、节点补全、节点校准、证据导航、候选复核、Auto Ingestion、任务抽屉和画布交互都已经有实现或相邻 change。v0.5.4 的 Project Map 工作不应继续扩大能力面，而应把这些能力收束成可验证的稳定性闭环。

当前风险集中在四类边界。部分边界已经在主 spec 或相邻 active change 中立法，本 change 的职责是校准缺口、修补实现偏差，并把 v0.5.4 的验证矩阵收敛起来，而不是重复沉淀同一批长期 requirement。

- async run boundary：生成任务跨 workspace / storage view 切换时，容易读取或写入错误的当前状态。
- scheduler boundary：Auto Ingestion 看起来是 workspace 级能力，但实现容易被 Project Map panel mount lifecycle 绑住。
- projection boundary：同一 node id 可能来自多个 lens 或多次生成，graph projection 必须先 normalize 再 layout。
- failure boundary：模型输出、证据读取、ownership 校验和 persistence 失败必须可见且 fail closed。

## Goals / Non-Goals

**Goals:**

- 为 v0.5.4 建立 Project Map stability contract，而不是新增第二阶段大功能。
- 保证每个 generation / completion / calibration / auto-ingestion run 使用创建时捕获的 immutable ownership context。
- 让 Auto Ingestion 从 workspace lifecycle 评估，同时复用现有 queue、interval、threshold、duplicate guard 和 processed-marker 语义。
- 在 graph projection 前完成 stable node id dedupe，并合并 evidence / relationships / metadata。
- 保证 malformed output 和 persistence / ownership failure 进入可见 failed run，不写入半成品知识地图。
- 用 focused tests 和明确 manual/platform qualifiers 支撑 release notes。

**Non-Goals:**

- 不引入第三方 graph renderer、force layout engine 或 graph editing dependency。
- 不做 Project Map schema migration，不主动删除用户已有 `.ccgui/project-map/**` 数据。
- 不新增 AI action 类型，不扩大 prompt 语义。
- 不实现跨项目知识融合、版本管理、图谱 diff、导出或完整 candidate review 工作台。
- 不引入 native daemon；后台调度仍运行在 app/workspace lifecycle 内。

## Decisions

### 1. Use immutable run ownership context

Main specs already require Project Map run ownership and storage-key isolation. Implementation should treat that as an existing contract and verify every Project Map run captures an immutable context at creation time:

- workspace id / path
- project-map storage key
- storage view
- run id / action kind
- source dataset version or manifest identity when available

All progress, completion, failure, persistence, and UI run-list updates should route through this captured context. The worker must not resolve its target from the currently selected workspace after it starts.

Alternatives considered:

- Current-workspace callback guard only: lower cost, but it protects UI state only and cannot prevent stale workers or service calls from writing to the wrong persistence path.
- Immutable ownership at worker + persistence boundary: slightly more wiring, but it covers the real failure chain. This is the selected approach.

### 2. Move Auto Ingestion evaluation to workspace lifecycle

Auto Ingestion scheduling should be owned by an app/workspace-level hook or service that remains mounted while a workspace is active. The Project Map panel remains the configuration and visibility surface, not the scheduler owner.

The scheduler should:

- load persisted Project Map settings for the active workspace;
- evaluate enabled / interval / threshold;
- check pending or running auto runs before enqueueing;
- enqueue through the same Project Map run queue used by panel-triggered runs;
- mark Project Memory entries processed only after successful worker completion.

Alternatives considered:

- Keep scheduler inside `useProjectMapDataset`: minimal movement, but the feature stops when the user leaves the panel.
- Native daemon: stronger background behavior, but too large for v0.5.4 and unnecessary for current lifecycle expectations.

### 3. Normalize duplicate nodes before layout

Graph rendering should receive a projection whose nodes are already deduped by stable node id. The normalization step should union evidence sources, related artifacts, parent/child references, candidate state, stale/confidence signals, and generation metadata without duplicating entries.

This is a projection and merge safety layer, not a destructive cleanup. Physical deletion remains reserved for explicit user prune actions.

Alternatives considered:

- Let renderer skip duplicate DOM nodes: hides the symptom but leaves relationships and inspector data inconsistent.
- Normalize dataset projection before layout: fixes visual duplication and inspector consistency without schema migration. This is the selected approach.

### 4. Fail closed on invalid model or persistence output

Project Map output from AI and persistence input should be treated as untrusted. The worker may repair known envelopes and parse final assistant channels, but if valid Project Map payload cannot be recovered, the run must fail visibly and avoid snapshot writes.

Failure categories should remain compact and user-visible in the task drawer:

- `output_parse_failed`
- `ownership_mismatch`
- `evidence_read_failed`
- `persistence_failed`
- `cancelled`

Existing persisted Project Map data should remain readable after a failed run.

Alternatives considered:

- Best-effort partial writes: can make the graph appear updated, but risks turning malformed model text into trusted project knowledge.
- Fail closed with diagnostics: safer and easier to test. This is the selected approach.

### 5. Preserve mode-aware candidate safety

Auto Ingestion has two different apply modes:

- `createCandidate`: generated updates remain candidate review items or candidate nodes until manual confirmation.
- `autoApplyEvidenceBacked`: source-backed updates may be written through the evidence gate, while weak, unsupported, or memory-only claims remain candidates.

The stabilization work must not collapse these modes into a single “always manual” path. The goal is to prevent silent trust promotion, not to remove the advanced evidence-backed mode.

### 6. Keep v0.5.4 Project Map scope as stabilization-only

The implementation should not add new user-facing Project Map capability categories. Any visible changes should be framed as reliability, diagnostics, and interaction stability.

This keeps the release coherent after the large v0.5.3 Project Map delivery.

### 7. Reuse the canonical Codex model catalog for Project Map fallback

Project Map generation options should prefer runtime-provided model catalogs and workspace config. When those inputs are unavailable or empty, Codex model selection should fall back to the existing `CODEX_MODEL_CATALOG` rather than maintaining a Project Map-specific copy.

This keeps the generation entry usable during runtime catalog outages and prevents model-list drift between the composer/Codex surfaces and Project Map.

## Risks / Trade-offs

- [Risk] Scheduler work may run more often once decoupled from panel mount. → Mitigation: preserve interval gate, threshold gate, duplicate-run guard, and workspace-scoped evaluation.
- [Risk] Dedupe normalization may merge conflicting metadata. → Mitigation: treat dedupe as verification/implementation closure for existing Project Map graph contracts; keep evidence union deterministic, never upgrade confidence without evidence, and prefer stale/candidate safety over optimistic trust.
- [Risk] Ownership gates may quarantine previously polluted local snapshots. → Mitigation: do not delete data; show empty/error/quarantined state and keep mismatch diagnostic visible.
- [Risk] Focused tests may miss platform-specific path issues. → Mitigation: include Rust ownership tests for path/storage boundaries and record missing Windows/macOS/Linux manual coverage as qualifiers.
- [Risk] Failure visibility can expose noisy diagnostics. → Mitigation: expose category and latest concise message, not raw prompt or sensitive evidence payload.
- [Risk] Candidate-safety hardening may accidentally disable `autoApplyEvidenceBacked`. → Mitigation: add explicit tests for both `createCandidate` and `autoApplyEvidenceBacked` semantics.
- [Risk] Project Map Codex fallback models drift from the rest of the app. → Mitigation: reuse `src/features/models/codexModelCatalog.ts` instead of defining a parallel fallback list.

## Migration Plan

1. Add or refactor pure helpers for run ownership context, storage-key validation, node projection dedupe, and failure classification.
2. Move Auto Ingestion evaluation to a workspace lifecycle owner while keeping existing Project Map panel settings and queue UI.
3. Wire graph projection normalization before layout and preserve current layout persistence schema.
4. Add focused tests before broad gates.
5. Run OpenSpec strict validation and focused frontend/Rust verification.

Rollback strategy:

- Revert the workspace-level scheduler mount first if background enqueueing regresses.
- Keep storage ownership rejection guards unless they block valid data; if they do, narrow the guard with focused fixtures rather than disabling ownership checks globally.
- Because no schema migration is introduced, rollback does not require data migration.

## Open Questions

- Should quarantined snapshot UI be an explicit Project Map error state or reuse the existing empty/error panel copy? Default: reuse existing error affordance for v0.5.4 unless implementation finds a clear user-facing gap.
- Should auto-ingestion scheduler wake on app start only, or also on Project Memory write events? Default: interval-based workspace lifecycle evaluation for v0.5.4; event-driven wakeups are out of scope unless already present.
