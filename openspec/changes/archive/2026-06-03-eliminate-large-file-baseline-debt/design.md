# Design: Eliminate Large-File Baseline Debt

## Decision

Use boundary-driven extraction and preserve existing facades.

1. `ProjectMapPanel.tsx` remains the public React entrypoint, but lower-level panel surfaces move to a feature-local component module.
2. `daemon_state.rs` remains the daemon state facade, but Codex local thread-list projection helpers move to a domain submodule.
3. The baseline is regenerated only after actual line-count reduction. The cleanup must not simply delete baseline entries while files remain oversized.

## Architecture

### Project Map frontend split

`ProjectMapPanel.tsx` currently owns state orchestration, graph interactions, inspector rendering, relation panels, evidence file panels, settings, and dialogs. The low-risk boundary is the rendered sub-surface layer because those components receive already-derived props and do not own persistence or graph mutation.

The first split should extract:

- navigation panel;
- relation legend/inspector/group rendering;
- evidence files panel;
- detail/inspector list rendering;
- settings panel;
- delete/generation dialogs.

The facade remains `ProjectMapPanel`, and class names remain unchanged.

### Daemon Rust split

`daemon_state.rs` currently includes Codex local thread-list cursor/source projection helpers before the `DaemonState` implementation. These helpers are pure or narrowly scoped to response projection, making them safer to extract than runtime lifecycle methods.

The first split should extract:

- prefixed session id formatting;
- Codex daemon local cursor parse/build;
- optional source normalization;
- local thread entry/response builders;
- folder assignment projection.

The facade remains `daemon_state.rs`; callers continue using the same `DaemonState` methods.

## Options

| Option | Summary | Trade-off |
|---|---|---|
| Keep baseline | Do nothing beyond retained debt | Lowest code risk but keeps gate noise and contradicts cleanup request |
| Boundary split | Move cohesive surfaces/helpers behind existing facades | Best risk/value ratio; line count drops without behavior redesign |
| Deep rewrite | Re-model Project Map and daemon state ownership | Larger architectural payoff but too risky for a gate hygiene pass |

## Compatibility

- No public component export path changes.
- No CSS selector changes.
- No Tauri command name changes.
- No daemon RPC payload changes.
- New modules must not become replacement hubs over the fail threshold.

## Validation

- `npm run check:large-files:gate`
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/projectMapLayoutCss.test.ts`
- `npm run typecheck`
- `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
- `openspec validate eliminate-large-file-baseline-debt --strict --no-interactive`
