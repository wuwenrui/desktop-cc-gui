## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for retained hard-debt elimination.
- [x] 1.2 Create design with boundary-driven split strategy.
- [x] 1.3 Create delta spec for retained hard-debt cleanup criteria.

## 2. Project Map Split

- [x] 2.1 Extract Project Map panel sub-surfaces into feature-local modules.
- [x] 2.2 Keep `ProjectMapPanel` as the public facade and preserve selectors/import behavior.
- [x] 2.3 Confirm `ProjectMapPanel.tsx` drops below the fail threshold.

## 3. Daemon State Split

- [x] 3.1 Extract Codex daemon local thread-list helpers into a domain submodule.
- [x] 3.2 Keep `daemon_state.rs` as the `DaemonState` facade with unchanged command behavior.
- [x] 3.3 Confirm `daemon_state.rs` drops below the fail threshold.

## 4. Baseline and Validation

- [x] 4.1 Regenerate large-file baseline after real reductions.
- [x] 4.2 Run focused Project Map tests.
- [x] 4.3 Run Rust/backend compile or focused test check.
- [x] 4.4 Run `npm run typecheck`.
- [x] 4.5 Run `npm run check:large-files:gate`.
- [x] 4.6 Run OpenSpec strict validation.
