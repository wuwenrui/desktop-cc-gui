## Why

Project Map 已经连续补齐 Evidence Files、Relations、Guided Tour、Path Finder、Impact Overlay、Graph Repair 等能力，但当前视图层把这些能力并列堆叠在同一首屏区域，导致用户看见的是 control wall，而不是 evidence-backed engineering navigation map。

现在需要单独做一次 Project Map view information architecture refactor，把红框区域从“功能完成度展示”重构为“Overview -> Focus -> Evidence -> Action”的认知路径，重新定义默认权重、展开策略和交互分层。

## 目标与边界

目标：

- Reframe the Project Map top/detail view around user intent rather than feature inventory.
- Establish a primary visual hierarchy for overview stats, current lens/focus, evidence, relations, repair state, and navigation controls.
- Make Evidence Files and Relations reachable but no longer compete with the primary map context by default.
- Promote Graph Repair only when integrity issues exist; otherwise keep it as a low-noise health affordance.
- Preserve all completed Project Map capabilities while changing their layout ownership and default presentation.
- Keep the refactor inside existing ProjectMapPanel and Project X-Ray capability boundaries.

边界：

- This is a Project Map view IA and interaction refactor, not a graph data model change.
- Existing Project Map dataset, relations, evidence file index, impact analysis, tour, path finder, and repair utilities remain the source capabilities.
- The first implementation should be frontend-only unless code inspection proves a small view-state persistence adjustment is necessary.
- The refactor should be reversible by removing the new view composition layer and restoring the previous section order.

## 非目标

- 不新增 AI generation behavior。
- 不新增 relation extraction、semantic search、embedding、后台扫描或自动 refresh。
- 不替换现有 lightweight graph renderer，不引入 React Flow。
- 不删除 Evidence Files、Relations、Path Finder、Tour、Impact、Graph Repair 等已完成能力。
- 不把 Project Map 改成 Orchestration Center 或任务执行面板。
- 不在本 change 内做 `ProjectMapPanel.tsx` 全量拆分；如需拆分，只做支撑视图重构的最小组件边界。

## What Changes

- Calibrate against current code facts:
  - `ProjectMapPanel.tsx` already owns local view state for navigation, evidence files, relations, graph health, chrome collapse, lens strip collapse, selected node, selected evidence file, and selected relation.
  - `ProjectMapNavigationPanel`, `ProjectMapEvidenceFilesPanel`, and `ProjectMapRelationLegendPanel` are already separate render units, but they are all mounted as peer blocks inside `.project-map-lens-shell` before the graph.
  - `DetailPanel` already receives selected node context, relation bucket, impact analysis, refresh summary, graph integrity issues, graph repair summary, and orchestration draft state.
  - `project-map.css` already has collapsed styling for navigation/evidence/relation panels, but the current composition still presents multiple capability summaries in the same red-frame visual band.
- Backwrite current workspace adjustment facts:
  - The view refactor has moved from proposal-only planning into an implemented Project Map workspace adjustment.
  - A derived view composition layer now owns the primary summary, active context subject, secondary investigation modes, attention state, and visible section state.
  - Evidence Files and Relations are treated as reachable secondary investigation modes instead of equal-weight default blocks.
  - Graph health and repair now follow an attention-driven escalation model; healthy state stays compact while actionable issues can surface with higher priority.
  - Navigation, tour, path, impact, evidence, relation, and repair entry points remain reachable through the refactored semantic hierarchy.
  - Styling work has been aligned with Project Map large-file pressure cleanup so hierarchy changes do not create another parallel global stylesheet surface.
  - Focused regression coverage has been added for default view state, contextual focus switching, repair visibility, sparse fallback, and visual priority behavior.
  - Remaining closure work is validation-only: typecheck and focused Project Map test execution still need to be recorded before archive/closure.
- Define a new Project Map view IA:
  - Primary: current map/lens overview, selected focus, health/risk summary, one primary action path.
  - Secondary: Evidence Files, Relations, Path Finder, Tour, Impact details.
  - Tertiary: advanced filters, raw counts, degraded diagnostics, repair details.
- Rework the red-frame top/detail area into semantic zones:
  - compact map status strip
  - intent navigation rail or mode selector
  - contextual focus card for selected node/lens/file/relation
  - collapsible evidence and relation drawers/sections
  - anomaly-driven graph repair notice
- Change default expanded state:
  - Evidence Files and Relations should not both render as large always-expanded blocks on first view.
  - Empty or sparse sections should collapse into meaningful affordances with counts and clear labels.
  - Repair affordance should only gain visual prominence when invalid graph records, stale evidence, or repair candidates exist.
- Add visual hierarchy rules:
  - high-value project understanding first
  - raw counts and filters second
  - diagnostics and advanced controls third
- Add focused regression coverage for default view state, section reachability, empty/degraded states, and non-mutating view filters.

## 技术方案取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 只调 CSS 间距、字号和颜色 | 最快，改动小 | 不解决语义层级，仍是功能堆叠 | 不采用 |
| B | 在现有 ProjectMapPanel 内建立 view IA composition layer | 保留既有能力，能重新分配默认权重，风险可控 | 需要整理 section ownership 和状态优先级 | 采用 |
| C | 重写 Project Map 为新 dashboard/router | 可彻底重塑体验 | 风险大，破坏已完成能力，超出当前问题 | 不采用 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map shall expose a priority-based view information architecture that separates primary map understanding, contextual evidence, relation inspection, navigation tools, and repair diagnostics by semantic weight and default state.

## Impact

- Frontend:
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - possible extracted semantic Project Map view composition helpers/components under `src/features/project-map/components/`
  - existing local components in `ProjectMapPanel.tsx`:
    - `ProjectMapNavigationPanel`
    - `ProjectMapEvidenceFilesPanel`
    - `ProjectMapRelationLegendPanel`
    - `DetailPanel`
  - possible small feature-local components under `src/features/project-map/components/`
  - `src/styles/project-map.css`
  - `src/styles/project-map.inspector.css` if contextual focus changes need inspector-specific styling
  - possible extracted Project Map detail/inspector stylesheet if it aligns with the active large-file-pressure cleanup
  - focused Project Map component/state tests
- Workspace / governance:
  - The proposal now reflects the workspace implementation state: tasks through view IA, styling, accessibility, and focused regression coverage are complete.
  - Open validation gates remain tracked in `tasks.md` rather than being claimed as completed in this proposal.
- Behavior specs:
  - `openspec/specs/project-xray-panel/spec.md`
- Dependencies:
  - No new runtime dependency expected.
- Storage/API:
  - No Project Map semantic storage or backend API change expected.
  - Existing graph node layout persistence may stay unchanged; view IA state should remain local unless implementation proves there is already a safe view-state key.

## 验收标准

- Opening Project Map shows a clear primary map/focus/status hierarchy instead of multiple equal-weight expanded utility blocks.
- Evidence Files remains reachable and shows counts/entry affordance, but does not dominate the default view when no file is selected.
- Relations remains reachable and inspectable, but defaults to contextual summary or drawer state instead of competing with Evidence Files as a full-width peer.
- Graph Repair gains visual prominence only when graph integrity or repair state requires attention.
- Empty, sparse, and degraded states communicate meaning without occupying disproportionate vertical space.
- Existing search, tour, path finder, impact overlay, evidence focus, relation focus, and repair flows remain reachable.
- View filters and section collapse/expand state do not mutate Project Map semantic data.
- The implementation reuses existing Project Map utilities and panels where possible instead of adding another parallel Project Map surface.
