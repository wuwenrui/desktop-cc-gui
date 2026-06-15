# Bundle Remediation Status

## Current Blocker

`S-CS-COLD/bundleSizeMain` is no longer a release hard blocker. The startup `App-*.js` bundle is below the `1,100,000 bytes-gzip` hardFail budget after the Project Map / Intent Canvas lazy boundary.

Current regenerated evidence:

- `dist/assets/App-DiG7kll1.js`: `1,052,527 bytes-gzip`
- `docs/perf/cold-start-baseline.json`: `S-CS-COLD/bundleSizeMain = 1,052,527 bytes-gzip`
- `npm run perf:archive-readiness -- --release --json`: no longer reports `release-hard-budget-breach` for `S-CS-COLD/bundleSizeMain`

## Selected Target

Selected minimal target: `src/features/project-map/**` and `src/features/intent-canvas/**`.

Reason:

- They are reachable from the AppShell startup graph through `useAppShellLayoutNodesSection`.
- They are tool surfaces, not required to render the initial workspace shell.
- They explain a large non-startup business payload in `App-*.js`.
- They are tightly related and have an existing dependency cycle, so they should be split as one chunk instead of two separate chunks.

## Implemented Boundary

The selected boundary is landed in this change.

- `src/features/layout/hooks/useLayoutNodes.tsx` lazy-loads `ProjectMapPanel` and `IntentCanvasManager` with the existing `HeavyPanelFallback`.
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` imports Project Map / Intent Canvas hooks and context helpers directly, avoiding barrel imports that pull UI surfaces into startup.
- `src/app-shell-parts/appShellLazyBoundaries.test.ts` locks Project Map / Intent Canvas as dynamic imports and prevents AppShell static import regression.

## Evidence

Current evidence:

- `npm run build`: `App-DiG7kll1.js` gzip `1,052.51 kB`.
- `npm run perf:cold-start:baseline && npm run perf:baseline:aggregate`: `docs/perf/baseline.json` records `S-CS-COLD/bundleSizeMain = 1,052,527 bytes-gzip`.
- `docs/perf/runtime-evidence-gates.json`: keeps `bundleSizeMain` measured and below `hardFail`.
- `docs/perf/cold-start-baseline.json`: still keeps Tauri/webview `firstPaintMs` and `firstInteractiveMs` unsupported until startup marker diagnostics are collected.

## Residual Risk

Release interpretation:

- The bundle hard blocker is removed.
- Release readiness still fails on explicit cold-start runtime timing blockers: `S-CS-COLD/firstPaintMs` and `S-CS-COLD/firstInteractiveMs`.
- This change deliberately avoids claiming release closure without measured cold-start webview timing evidence.
