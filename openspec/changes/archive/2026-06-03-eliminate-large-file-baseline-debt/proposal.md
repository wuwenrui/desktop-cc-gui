## Why

`npm run check:large-files:gate` still reports two retained hard-debt files even though the gate exits successfully. This leaves the repository in a tolerated-debt state and weakens the signal value of the large-file gate.

## 目标与边界

- Remove the retained hard-debt entries by reducing `ProjectMapPanel.tsx` and `daemon_state.rs` below their fail thresholds.
- Preserve existing public entrypoints, UI behavior, Tauri/RPC contracts, selectors, persisted fields, and test expectations.
- Treat this as modularization hygiene, not a product behavior redesign.

## What Changes

- Extract Project Map panel sub-surfaces from `ProjectMapPanel.tsx` into feature-local component modules while keeping `ProjectMapPanel` as the public facade.
- Extract Codex daemon local thread response helpers from `daemon_state.rs` into a domain-specific Rust submodule while keeping `DaemonState` command behavior unchanged.
- Update the large-file baseline after both retained files are no longer over the fail threshold.
- Validate with large-file gate, focused Project Map tests, Rust/backend checks, typecheck, and OpenSpec strict validation.

## 技术方案取舍

- Option A: keep baseline and accept retained debt. Rejected because it leaves `check:large-files:gate` output noisy and normalizes hard-debt tolerance.
- Option B: boundary-driven extraction behind existing facades. Recommended because it reduces line counts while preserving caller contracts.
- Option C: deep rewrite of Project Map graph/runtime and daemon state ownership. Rejected for this change because it mixes behavioral risk into a hygiene gate.

## 非目标

- No Project Map UX redesign.
- No daemon RPC protocol or payload shape changes.
- No command registration changes.
- No opportunistic rewrite of Project Map generation, graph layout, runtime lifecycle, or web-service daemon behavior.
- No baseline-only suppression of the retained entries.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `large-file-modularization-governance`: define that authorized retained hard-debt cleanup must remove retained fail-scope entries through boundary-driven splits and update baseline only after actual reduction.

## Impact

- Frontend: `src/features/project-map/components/ProjectMapPanel.tsx` and extracted Project Map component modules.
- Backend: `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs` and extracted daemon helper modules.
- Governance: `docs/architecture/large-file-baseline.json` and `openspec/specs/large-file-modularization-governance`.

## 验收标准

- `npm run check:large-files:gate` reports no retained fail-scope entries for `ProjectMapPanel.tsx` or `daemon_state.rs`.
- `ProjectMapPanel.tsx` and `daemon_state.rs` are both below the configured fail threshold.
- Project Map focused tests pass.
- Rust daemon/backend focused checks pass or compile-check cleanly.
- `openspec validate eliminate-large-file-baseline-debt --strict --no-interactive` passes.
