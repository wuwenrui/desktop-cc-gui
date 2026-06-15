# Runtime Evidence Gate Governance Report

Generated at: 2026-06-13T05:53:58.534Z

## Archive Readiness

| Change | Tasks | Recommendation | Qualifier |
|---|---:|---|---|

## Previous Archive Context

- close-performance-iteration-2026-06: 25/25, previous-closure-context. Retained as historical closure context; not a current completed-active archive candidate.

## In Progress

- close-client-performance-residual-2026-06: 0/30, not-archive-ready
- collect-release-grade-performance-evidence: 28/32, not-archive-ready

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
| src/app-shell.tsx | P0 | 2547 | 53 | Declare public facade before splitting. |
| src/services/tauri.ts | P0 | 2514 | 86 | Preserve service exports, payload mapping, and web/Tauri fallback semantics. |
| src-tauri/src/engine/claude_history.rs | P0 | 2505 | 95 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/codex/mod.rs | P0 | 2484 | 116 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/git/mod.rs | P0 | 2379 | 221 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/runtime/mod.rs | P0 | 2371 | 229 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/commands.rs | P0 | 2286 | 314 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/claude.rs | P0 | 2272 | 328 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/session_management.rs | P1 | 2976 | 24 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/features/threads/hooks/useThreadEventHandlers.ts | P1 | 2747 | 53 | Preserve hook input/output shape and async cleanup semantics. |

Next action: Pick one coherent runtime boundary; do not batch unrelated hot paths together.
