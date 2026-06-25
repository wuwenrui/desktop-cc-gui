## 1. Sidebar Placement

- [x] 1.1 [P0][depends:none][I: existing `GlobalRuntimeNoticeDock` node][O: `Sidebar.runtimeNoticeDockNode` slot][V: `Sidebar.test.tsx`] Add a sidebar bottom action slot without coupling Sidebar to notice feed internals.
- [x] 1.2 [P0][depends:1.1][I: `useLayoutNodes` layout flags][O: desktop/tablet sidebar slot + phone app-level fallback][V: `npm run typecheck`] Move dock placement into sidebar for non-phone layouts while preserving compact fallback.

## 2. Styling And Interaction

- [x] 2.1 [P0][depends:1.2][I: existing fixed dock CSS][O: sidebar-scoped 32px action + compact popover CSS][V: screenshot/manual visual inspection + focused tests] Replace fixed/calc desktop positioning with real bottom action layout.
- [x] 2.2 [P1][depends:2.1][I: `.sidebar-bottom-nav` CSS][O: horizontal sibling action group][V: `Sidebar.test.tsx`] Keep Settings first and runtime notice second in the same bottom row.
- [x] 2.3 [P0][depends:2.1][I: sidebar expanded notice panel][O: body-level portal panel anchored to trigger rect][V: `GlobalRuntimeNoticeDock.test.tsx`] Lift the expanded popover out of clipped sidebar containers while preserving the sidebar entry hierarchy.

## 3. Proposal Writeback And Verification

- [x] 3.1 [P0][depends:1.1-2.2][I: changed behavior][O: OpenSpec proposal/design/spec deltas/tasks][V: `openspec validate relocate-runtime-notice-dock-sidebar-entry --strict --no-interactive`] Write back the hierarchy correction proposal.
- [x] 3.2 [P0][depends:3.1][I: code + specs][O: verification evidence][V: focused Vitest + `npm run typecheck`] Validate compatibility gates for touched behavior.
- [x] 3.3 [P0][depends:2.3][I: clipping bug report screenshot][O: proposal/design/spec delta updated with portal escape contract][V: `openspec validate relocate-runtime-notice-dock-sidebar-entry --strict --no-interactive`] Write back the popover layer correction after discovering sidebar clipping.
