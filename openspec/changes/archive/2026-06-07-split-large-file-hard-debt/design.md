# Design: Split Large-File Hard Debt

## Decision

Use boundary-driven extraction behind existing facades. Each file gets its own cohesive split batch, and the large-file baseline is regenerated only after actual line-count reduction.

## Architecture

### Batch 1: Project Map relationship React surface

`ProjectMapRelationshipSection.tsx` mixes dashboard state, API search/grouping, graph rendering, file/read panels, scan state reconciliation, and action wiring. The safest first split is to extract pure helpers and rendered sub-surfaces while leaving the exported facade in place.

Proposed module boundaries:

- `ProjectMapRelationshipSection` remains the public facade and owns top-level props/effects.
- API contract grouping/search/rendering moves to a feature-local API view module.
- graph file grouping, graph node/edge projection, and graph surface rendering move to graph-local modules.
- file/read mode lists and selected-file inspector rendering move to relationship panel modules.
- timestamp/stale/reconcile helpers move to pure utility modules with focused tests where practical.

The facade continues to import and compose these modules, so callers do not move.

### Batch 2: Layout hook orchestration

`useLayoutNodes.tsx` combines lazy panel registration, code-selection relationship graph assembly, active conversation inference, runtime lifecycle resolution, and final node section construction. The low-risk boundary is extraction of pure helpers and section builders.

Proposed module boundaries:

- `useLayoutNodes` remains the only public hook entrypoint.
- code-selection relationship graph helpers move to a layout-local module.
- conversation engine inference and lifecycle resolution helpers move to pure helper modules.
- left/right/main section construction can move to small builder modules that receive already-normalized options.

This preserves return shape and panel identity while reducing the hub.

### Batch 3: Rust relationship scanner

`project_map_relations.rs` contains path/storage safety, snapshot ownership, scan indexing, language import resolution, relation extraction, context-pack enrichment, and command glue. The safest first split is helper submodules under a `project_map_relations` module namespace while keeping command-facing functions stable.

Proposed module boundaries:

- path/storage validation and atomic snapshot file handling.
- file classification, ignore rules, and language heuristics.
- import/call/symbol resolution and relation dedupe/index building.
- context-pack stale/API enrichment.
- tests stay close to the extracted module when they cover pure helpers; command-level tests remain at facade level.

The command registry and response JSON schema remain unchanged.

### Batch 4: Project Map relationship styles

`project-map.relationship.css` is slightly above the style hard threshold and contains duplicated graph blocks plus inspector/file/action regions. The safest split is stylesheet partitioning by cascade region without selector renames.

Proposed stylesheet parts:

- loading/dashboard chrome.
- graph canvas, graph nodes, graph edges, graph controls.
- inspector and source/evidence actions.
- file/read dashboards and insight tiles.

The current stylesheet remains an import facade or root import point. Import order must match current cascade order.

## Options

| Option | Summary | Trade-off |
|---|---|---|
| Baseline-only | Keep four retained entries in hard-debt baseline | No code movement, but leaves known debt and gate output noisy |
| Split all four behind facades | Boundary extraction with stable public contracts | Best fit; measurable reduction with bounded behavior risk |
| Rewrite Project Map relationship architecture | Rebuild UI/scanner/layout around new ownership model | Larger payoff, but too broad for hard-debt cleanup |

## Compatibility

- No public import path change for `ProjectMapRelationshipSection`.
- No public input/return contract change for `useLayoutNodes`.
- No command registration, Tauri command name, payload, or storage schema change.
- No CSS class renaming.
- New modules must not become replacement hubs near the same fail threshold.

## Rollback

Each batch can be reverted independently because the facade file remains the integration point. If a split batch regresses behavior, restore the moved helper/rendering code into the facade or stop after the previous passing batch without touching unrelated batches.

## Validation

- `openspec validate split-large-file-hard-debt --strict --no-interactive`
- `npm run check:large-files:gate`
- `npm run check:large-files:near-threshold`
- `npm run typecheck`
- `npx vitest run src/features/project-map/components/ProjectMapRelationshipSection.api-smoke.test.tsx src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/projectMapLayoutCss.test.ts`
- `npx vitest run src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx src/features/layout/components/DesktopLayout.test.tsx`
- `cargo test --manifest-path src-tauri/Cargo.toml project_map_relations`
- If full Rust focused test naming is not available, run `cargo test --manifest-path src-tauri/Cargo.toml --no-run` and document the residual risk.
