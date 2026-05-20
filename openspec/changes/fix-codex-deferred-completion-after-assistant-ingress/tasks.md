## 1. Diagnosis

- [x] 1.1 [P0][depends:none][I: screenshots + event hook code][O: root-cause path][V: spinner maps to `isProcessing=true`] Identify terminal settlement as the failing surface.
- [x] 1.2 [P0][depends:1.1][I: Codex deferral diagnostics][O: minimal event sequence][V: stale child blocker + assistant ingress + `turn/completed` reproduces stuck condition] Confirm missing assistant completion evidence can keep deferral active.

## 2. Implementation

- [x] 2.1 [P0][depends:1.2][I: `useThreadEventHandlers` Codex deferral branch][O: narrow bypass for assistant stream ingress][V: no-output child blocker path remains deferred] Implement assistant-ingress terminal bypass.
- [x] 2.2 [P0][depends:2.1][I: diagnostic payload][O: blocker-preserving diagnostic][V: bypass log includes remaining blockers and delta evidence] Preserve observability for stale child blockers.

## 3. Verification

- [x] 3.1 [P0][depends:2.1][I: hook regression test][O: Vitest coverage][V: assistant delta + stale child blocker + `turn/completed` clears processing] Add focused regression coverage.
- [x] 3.2 [P0][depends:3.1][I: touched frontend files][O: validation evidence][V: `npm exec vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts`, `npm run typecheck`, `npm run lint`] Run targeted validation.
- [x] 3.3 [P1][depends:3.2][I: OpenSpec artifacts][O: strict validation evidence][V: `openspec validate fix-codex-deferred-completion-after-assistant-ingress --strict --no-interactive`] Validate change contract.
