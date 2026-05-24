# Runtime Evidence Gate Governance Report

Generated at: 2026-05-24T11:31:59.707Z

## Archive Readiness

| Change | Tasks | Recommendation | Qualifier |
|---|---:|---|---|
| refactor-file-open-rendering-scheduler | 37/37 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| stabilize-runtime-performance-evidence-gates | 21/21 | archive-candidate-after-qualifier-review | Archive only after evidence report identifies measured/proxy/unsupported boundaries. |
| fix-claude-issue529-second-turn-blank-session | 6/6 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| harden-claude-sidebar-list-timeout-fallback | 30/30 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| fix-stale-thread-recovery-confidence-gates | 50/50 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| unify-claude-workspace-session-catalog | 55/55 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| stabilize-session-management-truth-boundaries | 23/23 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| preserve-editor-on-topbar-session-switch | 7/7 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| refactor-workspace-session-management | 62/62 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| desktop-editor-split-left-composer | 8/8 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| add-file-markdown-math-preview | 12/12 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| adjust-git-worktree-checkbox-placement | 15/15 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| integrate-openspec-trellis-bridge-into-status-panel | 18/18 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| optimize-long-list-virtualization | 16/16 | archive-candidate-after-qualifier-review | Archive only after evidence report identifies measured/proxy/unsupported boundaries. |
| optimize-realtime-event-batching | 17/17 | archive-candidate-after-qualifier-review | Archive only after evidence report identifies measured/proxy/unsupported boundaries. |
| stabilize-markdown-preview-awareness-and-large-rendering | 15/15 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| add-email-driven-session-continuation | 57/57 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| add-memory-reference-persistent-mode | 13/13 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| dynamic-project-governance-evidence | 34/34 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| fix-codex-empty-draft-stale-thread-auto-replay | 11/11 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| fix-markdown-preview-auto-refresh | 8/8 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| add-cross-workspace-cost-admin-view | 6/6 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| add-engine-plugin-onboarding-kit | 6/6 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| advance-harness-governance-to-90 | 51/51 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| stabilize-core-runtime-and-realtime-contracts | 32/32 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| fix-codex-deferred-completion-after-assistant-ingress | 7/7 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| improve-email-mail-session-list-controls | 21/21 | archive-candidate-after-qualifier-review | Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive. |
| optimize-bundle-chunking | 14/14 | archive-candidate-after-qualifier-review | Archive only after evidence report identifies measured/proxy/unsupported boundaries. |
| refactor-mega-hub-split | 16/16 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| stabilize-composer-control-surface | 22/22 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| fix-bottom-status-dock-collapse-stability | 11/11 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |
| stabilize-file-markdown-preview-render-architecture | 26/26 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |

## In Progress

- add-codex-structured-launch-profile: 0/7, not-archive-ready

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
| src-tauri/src/engine/claude_history.rs | P0 | 2308 | 292 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/app-shell.tsx | P0 | 2248 | 352 | Declare public facade before splitting. |
| src/services/tauri.ts | P0 | 2237 | 363 | Preserve service exports, payload mapping, and web/Tauri fallback semantics. |
| src/features/threads/hooks/useThreadActions.ts | P1 | 2777 | 23 | Preserve hook input/output shape and async cleanup semantics. |
| src-tauri/src/session_management.rs | P1 | 2952 | 48 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/session_management_tests.rs | P1 | 2717 | 283 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/app-shell-parts/useAppShellSections.ts | P1 | 2623 | 377 | Declare public facade before splitting. |
| src/styles/status-panel.css | P1 | 2333 | 467 | Preserve selector names, import order, and cascade compatibility. |
| src/styles/settings.part2.css | P1 | 2283 | 517 | Preserve selector names, import order, and cascade compatibility. |
| src/styles/composer.part2.css | P1 | 2205 | 595 | Preserve selector names, import order, and cascade compatibility. |

Next action: Pick one coherent runtime boundary; do not batch unrelated hot paths together.
