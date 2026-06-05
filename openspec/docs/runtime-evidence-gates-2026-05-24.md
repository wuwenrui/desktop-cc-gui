# Runtime Evidence Gate Governance Report

Generated at: 2026-06-04T15:35:39.998Z

## Archive Readiness

| Change | Tasks | Recommendation | Qualifier |
|---|---:|---|---|
| fix-claude-argv-prompt-shell-escaping | 7/7 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| fix-client-runtime-interaction-jank | 43/43 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| add-session-attribution-mode-setting | 31/31 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| deepen-project-map-query-and-association-workbench | 52/52 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |

## In Progress

- refactor-project-map-view-information-architecture: 23/25, not-archive-ready

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
| src-tauri/src/engine/claude_history.rs | P0 | 2505 | 95 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/services/tauri.ts | P0 | 2395 | 205 | Preserve service exports, payload mapping, and web/Tauri fallback semantics. |
| src-tauri/src/runtime/mod.rs | P0 | 2336 | 264 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/git/mod.rs | P0 | 2332 | 268 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/commands.rs | P0 | 2285 | 315 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/codex/mod.rs | P0 | 2259 | 341 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/app-shell.tsx | P0 | 2256 | 344 | Declare public facade before splitting. |
| src/styles/project-map.css | P1 | 2790 | 10 | Preserve selector names, import order, and cascade compatibility. |
| src/features/layout/hooks/useLayoutNodes.tsx | P1 | 2940 | 60 | Preserve hook input/output shape and async cleanup semantics. |
| src/features/threads/hooks/useThreadEventHandlers.ts | P1 | 2739 | 61 | Preserve hook input/output shape and async cleanup semantics. |

Next action: Pick one coherent runtime boundary; do not batch unrelated hot paths together.
