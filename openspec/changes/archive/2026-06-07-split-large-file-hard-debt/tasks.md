## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for splitting current retained large-file hard debt.
- [x] 1.2 Create delta spec for concrete retained hard-debt cleanup criteria.
- [x] 1.3 Create design with per-file boundary split strategy.

## 2. Project Map Relationship Section Split

- [x] 2.1 Extract API contract search/group/render helpers from `ProjectMapRelationshipSection.tsx`.
- [x] 2.2 Extract graph projection/rendering sub-surfaces from `ProjectMapRelationshipSection.tsx`.
- [x] 2.3 Extract file/read dashboard and inspector sub-surfaces from `ProjectMapRelationshipSection.tsx`.
- [x] 2.4 Keep `ProjectMapRelationshipSection` public facade, props, callbacks, view modes, and class names compatible.
- [x] 2.5 Confirm `ProjectMapRelationshipSection.tsx` is below 3000 lines.

## 3. Layout Nodes Hook Split

- [x] 3.1 Extract code-selection relationship graph helpers from `useLayoutNodes.tsx`.
- [x] 3.2 Extract conversation engine/lifecycle helper logic from `useLayoutNodes.tsx`.
- [x] 3.3 Extract left/right/main layout section builders while preserving `useLayoutNodes` return shape.
- [x] 3.4 Confirm panel ordering, selected tab behavior, lazy fallback behavior, and code-selection relationship graph behavior remain compatible.
- [x] 3.5 Confirm `useLayoutNodes.tsx` is below 3000 lines.

## 4. Rust Project Map Relations Split

- [x] 4.1 Extract path/storage validation and snapshot ownership helpers from `project_map_relations.rs`.
- [x] 4.2 Extract file classification, ignore rules, and language heuristic helpers.
- [x] 4.3 Extract import/call/symbol resolution and relation index builders.
- [x] 4.4 Extract context-pack stale/API enrichment helpers.
- [x] 4.5 Keep command registration, response schema, storage paths, and error semantics compatible.
- [x] 4.6 Confirm `project_map_relations.rs` is below 3000 lines.
- [x] 4.7 Split `project_map_api_contracts.rs` test module after large-file gate surfaced it as a new fail-scope file.

## 5. Project Map Relationship Styles Split

- [x] 5.1 Split loading/dashboard chrome styles into an imported stylesheet part.
- [x] 5.2 Split graph canvas/node/edge/control styles into imported stylesheet part(s).
- [x] 5.3 Split inspector/evidence/action styles into imported stylesheet part(s).
- [x] 5.4 Split file/read dashboard and insight tile styles into imported stylesheet part(s).
- [x] 5.5 Preserve selector names and cascade order.
- [x] 5.6 Confirm `project-map.relationship.css` is below 2800 lines.

## 6. Baseline and Validation

- [x] 6.1 Regenerate `docs/architecture/large-file-baseline.*` after all four source files are below fail thresholds.
- [x] 6.2 Run focused Project Map relationship tests.
- [x] 6.3 Run focused layout hook/component tests.
- [x] 6.4 Run Rust relationship scanner focused tests or compile check.
- [x] 6.5 Run `npm run typecheck`.
- [x] 6.6 Run `npm run check:large-files:near-threshold`.
- [x] 6.7 Run `npm run check:large-files:gate`.
- [x] 6.8 Run `openspec validate split-large-file-hard-debt --strict --no-interactive`.
