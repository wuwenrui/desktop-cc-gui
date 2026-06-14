# bundle-chunking-performance delta

## ADDED Requirements

### Requirement: Project Map And Intent Canvas MUST Live Behind A Startup Lazy Boundary

The system MUST keep `src/features/project-map/**` and `src/features/intent-canvas/**` panel modules out of the startup `App-*.js` bundle by routing them through a `React.lazy` / dynamic import boundary reachable from the AppShell layout graph.

#### Scenario: project map and intent canvas are loaded on demand

- **WHEN** the user activates project map or intent canvas after startup
- **THEN** the corresponding panel module MUST load through a `React.lazy(() => import(...))` boundary inside `src/features/layout/hooks/useLayoutNodes.tsx`
- **AND** the static-import contract MUST remain free of `from "..."` references to `project-map/components/ProjectMapPanel` and `intent-canvas/components/IntentCanvasManager` in `useAppShellLayoutNodesSection.tsx`, `renderAppShell.tsx`, `app-shell.tsx`, and `useLayoutNodes.tsx`
- **AND** a focused Vitest contract test in `src/app-shell-parts/appShellLazyBoundaries.test.ts` MUST prove both halves of the contract above

#### Scenario: bundle analyzer no longer flags app-js as hardFail

- **WHEN** `npm run build` finishes
- **THEN** `npm run check:bundle-chunking` MUST NOT report `app-js: fail`
- **AND** `dist/assets/App-*.js` `bytes-gzip` MUST be at or below the `S-CS-COLD/bundleSizeMain` `budget.hardFail = 1100000`

#### Scenario: lightweight hook and types stay eagerly reachable

- **WHEN** the AppShell layout graph only needs the lightweight project-map hook and intent-canvas context utilities / types
- **THEN** `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` MAY keep `useProjectMapDataset`, `buildIntentCanvasContextAttachment`, `formatIntentCanvasThreadContext`, and the type imports in its static import set
- **AND** those lightweight imports MUST NOT cause the panel modules to enter the startup bundle
