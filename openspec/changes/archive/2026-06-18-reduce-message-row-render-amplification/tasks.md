## 1. Evidence and Scope

- [x] 1.1 [P0][input: latest hot-start diagnostics][output: render amplification facts] Record the evidence that visible stall is gone while `render-amplification` and high completed-row `renderCount` remain.
- [x] 1.2 [P0][input: `MessagesRows.tsx` / `MessagesTimeline.tsx`][output: unstable prop hypothesis] Identify which row props can invalidate completed rows during live assistant updates.

## 2. Tests

- [x] 2.1 [P0][depends:1.2][input: focused message tests][output: completed-row stability regression] Add a regression proving unchanged completed rows do not rerender when only the live assistant row text changes.
- [x] 2.2 [P0][depends:2.1][input: existing stream mitigation tests][output: live row behavior preserved] Keep Codex lightweight Markdown and visible text tests passing.

## 3. Implementation

- [x] 3.1 [P0][depends:2.1][input: row props/comparator][output: minimized render amplification] Stabilize live-only props for non-streaming rows or narrow comparator invalidation without hiding legitimate completed-row updates.
- [x] 3.2 [P1][depends:3.1][input: diagnostics][output: content-safe evidence retained] Preserve `perf.messages.row-render-budget` diagnostics so future hot-start runs can validate render count reduction.
- [x] 3.3 [P0][depends:runtime diagnostics][input: `useFileLinkOpener`][output: stable shared file-link handlers] Keep file-link callback identities stable across recreated open target arrays while reading latest config at invocation time.
- [x] 3.4 [P0][depends:latest hot-start diagnostics][input: `MessageRow` runtime reconnect props][output: hidden reconnect props isolated] Avoid invalidating ordinary completed rows when hidden runtime reconnect callbacks change.

## 4. Validation

- [x] 4.1 [P0][depends:3.1][input: focused Vitest suites][output: test results] Run focused message row / streaming tests.
- [x] 4.2 [P0][depends:4.1][input: TypeScript/lint/OpenSpec][output: final gates] Run `npm run typecheck`, `npm run lint`, and `openspec validate reduce-message-row-render-amplification --strict --no-interactive`.
- [x] 4.3 [P0][depends:3.3][input: hook regression][output: handler identity proof] Run `useFileLinkOpener` focused tests proving stable handler identity and latest open-target behavior.
- [x] 4.4 [P0][depends:3.4][input: message row regression][output: reconnect callback proof] Add and run a focused `MessageRow` test proving hidden reconnect callback changes do not rerender ordinary rows.
