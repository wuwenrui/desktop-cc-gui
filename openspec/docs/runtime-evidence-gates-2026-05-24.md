# Runtime Evidence Gate Governance Report

Generated at: 2026-06-23T12:31:55.749Z

## Archive Readiness

| Change | Tasks | Recommendation | Qualifier |
|---|---:|---|---|
| fix-codex-provider-composer-cold-start-binding | 11/11 | archive-candidate-after-qualifier-review | Review validation and platform qualifiers before archive. |

## Accepted Budget Residuals

| Record | Owner | Decision | Next Action |
|---|---|---|---|
| S-LL-200/commitDurationP50 | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-200/commitDurationP95 | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-200/firstPaintAfterMount | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-500/commitDurationP50 | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-500/commitDurationP95 | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-500/firstPaintAfterMount | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-1000/commitDurationP50 | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-1000/commitDurationP95 | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-LL-1000/firstPaintAfterMount | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-CI-50/compositionToCommit | input-latency-budget | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-CI-100-IME/compositionToCommit | input-latency-budget | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-RS-PE/dedupHitRatio | realtime-runtime-evidence | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-RS-PE/assemblerLatency | realtime-runtime-evidence | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-CS-COLD/firstPaintMs | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |
| S-CS-COLD/firstInteractiveMs | release-grade-evidence-collection | accepted-normal-mode-deferral | Keep release-mode evidence strict; replace this accepted residual with owner-approved budget metadata when measured runtime evidence exists. |

## Accepted Proxy Evidence Debt

- Status: accepted-normal-mode-deferral
- Owner: runtime-perf-evidence-classification
- Decision: Normal-mode archive readiness may pass with this accepted disposition; release mode remains stricter and still reports release-required proxy or unsupported evidence.
- Next action: Promote release-relevant proxy records to measured Tauri/WebView evidence before release-grade archive.

## Accepted Unsupported Evidence

| Record | Owner | Platform Qualifier | Next Action |
|---|---|---|---|
| S-CS-COLD/firstPaintMs | release-grade-evidence-collection | supported Tauri/WebView startup marker runner unavailable in current CI/local evidence set | Collect real Tauri webview first-paint timing on a supported runner. |
| S-CS-COLD/firstInteractiveMs | release-grade-evidence-collection | supported Tauri/WebView startup marker runner unavailable in current CI/local evidence set | Collect real Tauri webview first-interactive timing on a supported runner. |
| S-LR-101/sampledOsChildLivenessAfterClose | long-running-runtime-evidence | cross-platform OS child process sampler unavailable | Add or explicitly waive a platform-safe child process sampler before release-grade closure. |
| S-LR-200/moduleSwitchP95Ms | long-running-runtime-evidence | Tauri/WebView module-switch trace unavailable in jsdom evidence | Collect module switch P95 from a supported Tauri/WebView trace. |

## In Progress

- 2026-06-24-harden-realtime-interaction-jank-during-tool-call: 32/40, not-archive-ready
- 2026-06-22-release-pipeline-cache-sccache: 7/13, not-archive-ready
- 2026-06-18-extend-search-palette-with-commands: 0/0, not-archive-ready
- 2026-06-18-extend-editor-file-tab-lifecycle: 0/0, not-archive-ready
- 2026-06-18-add-shortcuts-overview-and-conflict-detection: 0/0, not-archive-ready

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
| src/app-shell.tsx | P0 | 2593 | 7 | Declare public facade before splitting. |
| src-tauri/src/engine/commands.rs | P0 | 2528 | 72 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/claude_history.rs | P0 | 2505 | 95 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/codex/mod.rs | P0 | 2484 | 116 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/git/mod.rs | P0 | 2379 | 221 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/runtime/mod.rs | P0 | 2371 | 229 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/engine/claude.rs | P0 | 2309 | 291 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src-tauri/src/session_management.rs | P1 | 2976 | 24 | Preserve command registration, Rust module facade, payload shape, and cross-platform paths. |
| src/features/threads/hooks/useThreads.ts | P1 | 2772 | 28 | Preserve hook input/output shape and async cleanup semantics. |
| src/features/app/hooks/useAppServerEvents.ts | P1 | 2950 | 50 | Preserve hook input/output shape and async cleanup semantics. |

Next action: Pick one coherent runtime boundary; do not batch unrelated hot paths together.
