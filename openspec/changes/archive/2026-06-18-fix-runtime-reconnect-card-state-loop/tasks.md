## 1. Runtime Reconnect State

- [x] 1.1 Replace reconnect card reset dependencies with a stable semantic signature; input: current `RuntimeReconnectCard` props; output: reset only on real recovery context changes; verify with focused runtime reconnect test.
- [x] 1.2 Preserve recover-specific failure detail when `ensureRuntimeReady` succeeds but thread recovery returns null; input: existing callback result normalization; output: visible failed label and recover detail; verify with existing failed recovery scenario.

## 2. Test Stability

- [x] 2.1 Move `Messages.runtime-reconnect.test.tsx` Markdown mock rendered-value callback to effect phase; input: current mock; output: no render-phase callback side effect; verify same test suite.
- [x] 2.2 Update async assertions to wait for full recovery outcome rather than only `ensureRuntimeReady`; input: failing CI batch; output: deterministic failure/success copy assertions; verify same CI batch locally.

## 3. Validation

- [x] 3.1 Run focused runtime reconnect Vitest file.
- [x] 3.2 Run the exact four-file Vitest batch that reproduced CI failure.
- [x] 3.3 Run `npm run typecheck` or explain if skipped.
