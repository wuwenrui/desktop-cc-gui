# Runtime Evidence Gate Governance Report

Generated at: 2026-06-12T13:24:15.959Z

## Archive Readiness

| Change | Tasks | Recommendation | Qualifier |
|---|---:|---|---|
| workspace-tree-and-large-file-listing-budget | 26/26 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| markdown-off-main-thread-pipeline | 27/27 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| backend-io-cache-and-bridge-payload-budget | 27/27 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| renderer-resource-backpressure | 33/33 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| composer-and-message-row-render-budget | 20/20 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |

## In Progress

- frontend-prop-chain-stability-2026-06: 43/45, not-archive-ready
- realtime-input-and-io-isolation-2026-06: 63/68, not-archive-ready

## Compatibility / Cleanup Matrix

| Path | Classification | Reason | Verification |
|---|---|---|---|
| listClaudeSessions | retain-compatibility | Native Claude continuity and diagnostic listing path; not the sidebar membership truth source. | rg references in src/services/tauri.ts, useThreadActions fallback seed, and focused tests. |
| listProjectRelatedCodexSessions | retain-compatibility | Project-related Codex diagnostics and continuity path; shared projection remains canonical for membership. | rg references in src/services/tauri/sessionManagement.ts and src/services/tauri.test.ts. |
| legacy bare-session metadata lookup | retain-legacy | Recovery fallback for older persisted/session metadata shapes. | Spec and Rust test evidence keep stable-key plus legacy bare-session metadata compatibility. |
| legacy cursor parsing | retain-legacy | Backward-compatible pagination fallback for older cursor payloads. | Session-management closeout records this as a protected compatibility path. |

## Large-File Optimization Queue

Source: .artifacts/large-files-near-threshold.json

| Path | Priority | Lines | Headroom | Facade / Boundary |
|---|---|---:|---:|---|
| src/services/tauri.ts | P0 | 2514 | 86 | Preserve service exports, payload mapping, and web/Tauri fallback semantics. |
| src-tauri/src/engine/claude_history.rs | P0 | 2505 | 95 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/codex/mod.rs | P0 | 2484 | 116 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/git/mod.rs | P0 | 2379 | 221 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/runtime/mod.rs | P0 | 2371 | 229 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/commands.rs | P0 | 2286 | 314 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/claude.rs | P0 | 2272 | 328 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/session_management.rs | P1 | 2976 | 24 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/features/threads/hooks/useThreadEventHandlers.ts | P1 | 2747 | 53 | Preserve hook input/output shape and async cleanup semantics. |
| src-tauri/src/bin/cc_gui_daemon/daemon_state.rs | P1 | 2936 | 64 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |

Next action: Pick one coherent runtime boundary; do not batch unrelated hot paths together.
