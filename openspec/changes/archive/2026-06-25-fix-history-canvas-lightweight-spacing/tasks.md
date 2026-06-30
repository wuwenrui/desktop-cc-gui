## 1. OpenSpec Gate

- [x] 1.1 Validate change artifacts with `openspec validate fix-history-canvas-lightweight-spacing --strict --no-interactive`

## 2. Core Implementation

- [x] 2.1 Add compact lightweight virtual row height contract for summary-rendered heavy rows
- [x] 2.2 Trigger bounded virtualizer remeasure when lightweight row rendering state changes
- [x] 2.3 Compact lightweight mode bar styling and preserve readable actions
- [x] 2.4 Separate history sticky header from lightweight mode bar without changing sticky candidate logic
- [x] 2.5 Remove redundant lightweight action, ensure render-detail exits summary mode, and prevent sticky header from covering visible user cards
- [x] 2.6 Use viewport rects for history sticky visibility under virtualized `transform` rows and further compact lightweight rows
- [x] 2.7 Use static document flow for expanded lightweight history instead of absolute virtual canvas
- [x] 2.8 Keep the expanded-history top operation card visible under the shared timeline padding contract
- [x] 2.9 Refactor expanded history into a stable document-flow mode: remove manual `scrollHeight delta` restoration, move top operation surfaces into `messages-full`, and make document-flow fallback apply to all stable history expansions

## 3. Verification

- [x] 3.1 Add focused regression tests for lightweight virtual row height and mode bar/sticky layout contract
- [x] 3.2 Run focused Vitest suites for touched message timeline behavior
- [x] 3.3 Run `npm run typecheck`
- [x] 3.4 Re-run focused validation after visual follow-up fixes
- [x] 3.5 Add regression coverage for transformed visible history user card not being pinned
- [x] 3.6 Add regression coverage that expanded heavy history exits virtual canvas and keeps lightweight summaries
- [x] 3.7 Add style regression for the shared topbar/sticky contract after moving top operation surfaces into `messages-full`
- [x] 3.8 Replace scroll-restore regression coverage with stable expanded-history head coverage and add non-lightweight expanded-history static-flow coverage
- [x] 3.9 Re-run focused Vitest and `npm run typecheck` after the expanded-history flow refactor
