## 1. Baseline Boundary Audit

- [x] 1.1 Map current `useLayoutNodes` dependencies into Shell-only, Canvas-only, shared-light, and hidden-surface groups; output: code comments or helper tests proving the intended boundary.
- [x] 1.2 Add failing guard tests for canvas-only churn: topbar tabs, sidebar rows, right panel toolbar, and Composer input controls must not receive full canvas objects.
- [x] 1.3 Add hidden-surface compute guard tests for at least ProjectMap and IntentCanvas dataset/projection paths.

## 2. Shell Summary Boundary

- [x] 2.1 Introduce typed Shell summary helpers for active ids, processing state, provider labels, running counts, unread/review indicators, and narrow pressure flags.
- [x] 2.2 Route sidebar/topbar/right-panel control props through Shell summaries instead of full active canvas objects where not required.
- [x] 2.3 Preserve current layout public node slots so Desktop/Tablet/Phone layout APIs do not need broad rewrites.

## 3. Canvas Content Boundary

- [x] 3.1 Create or isolate a Conversation Canvas node builder that owns active items, conversation state, timeline projection inputs, task-run conversation surfaces, approvals, and canvas diagnostics.
- [x] 3.2 Ensure Canvas-only changes do not rebuild Shell-only nodes; update memo dependencies and tests accordingly.
- [x] 3.3 Preserve terminal settlement, active history loading, approval/user-input rendering, fork/rewind dialogs, and runtime reconnect behavior.

## 4. Lazy Compute Gates For Heavy Surfaces

- [x] 4.1 Gate ProjectMap heavy dataset/projection work behind active or split-visible state while keeping lightweight activation state.
- [x] 4.2 Gate IntentCanvas heavy context/projection work behind active or split-visible state.
- [x] 4.3 Audit BrowserDock, Git detail, File detail, SpecHub, Task/Status surfaces for hidden realtime compute leakage and gate the highest-impact offenders found in this pass.

## 5. Diagnostics And Rollback

- [x] 5.1 Extend renderer/realtime diagnostics or tests to classify shell invalidation separately from canvas render pressure and hidden-surface compute.
- [x] 5.2 Keep rollback behavior local: disabling a lazy compute gate or canvas boundary must not disconnect active runtime sessions.

## 6. Verification

- [x] 6.1 Run focused Vitest suites for layout nodes, app shell lazy boundaries, sidebar/topbar/composer responsiveness, messages, project map/intent canvas gates, and realtime contracts.
- [x] 6.2 Run `npm run typecheck`.
- [x] 6.3 Run `npm run lint`.
- [x] 6.4 Run `npm run check:runtime-contracts`.
- [x] 6.5 Run `npm run check:large-files`.
- [x] 6.6 Run `npm run check:heavy-test-noise`.
- [x] 6.7 Run `openspec validate shell-first-lazy-runtime-isolation --strict --no-interactive`.
