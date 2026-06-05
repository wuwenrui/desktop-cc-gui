## 1. OpenSpec Artifacts

- [x] 1.1 [P0][depends:none][I:user direction + Understand-Anything research][O:proposal defining mossx Project Map graph cockpit][V:artifact review] Create proposal.
- [x] 1.2 [P0][depends:1.1][I:current Project Map code facts][O:design with command bar/canvas/inspector/health/work queue downgrade][V:artifact review] Create design.
- [x] 1.3 [P0][depends:1.1][I:project-xray-panel behavior][O:delta spec for graph-first experience][V:openspec validate] Create spec.

## 2. Composition Pass

- [x] 2.1 [P0][depends:1.2,1.3][I:ProjectMapPanel existing state][O:graph command bar composition][V:not run this pass] Group search, tour, path, lens, graph health, and task status into a compact command surface.
- [x] 2.2 [P0][depends:2.1][I:Graph Repair card][O:compact health affordance with optional details][V:not run this pass] Downgrade always-visible repair summary.
- [x] 2.3 [P0][depends:2.1][I:Work Queue/orchestration bridge affordances][O:secondary compact task affordance][V:not run this pass] Downgrade Work Queue visual prominence and hide dead/no-op primary controls.

## 3. Inspector Pass

- [x] 3.1 [P1][depends:2.1][I:selected node detail][O:Understand/Evidence/Relations/Actions inspector hierarchy][V:focused UI review] Recompose node inspector sections.
- [x] 3.2 [P1][depends:3.1][I:relation bucket/evidence entries][O:navigable relation/evidence rows where callbacks exist][V:focused UI review] Strengthen relation and evidence exploration.

## 4. Visual Pass

- [x] 4.1 [P0][depends:2.1][I:project-map.css][O:graph-first visual hierarchy][V:not run this pass] Improve canvas, node, edge, command bar, health, and compact task styling.
- [x] 4.2 [P1][depends:4.1][I:selected/search/path/tour states][O:clear state contrast][V:not run this pass] Refine visual state language.

## 5. Cleanup

- [x] 5.1 [P0][depends:2.2,2.3][I:old expanded presentation code][O:unused or misleading UI code removed][V:not run this pass] Delete stale UI branches and dead labels introduced by the old composition.
- [x] 5.2 [P0][depends:all implementation tasks][I:OpenSpec change][O:strict validation pass][V:openspec validate enhance-project-map-graph-experience --strict --no-interactive] Validate change artifacts.
