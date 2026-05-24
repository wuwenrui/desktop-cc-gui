# Proposal Refresh Audit - 2026-05-23

## Scope

This report was first created for the 2026-05-23 OpenSpec proposal refresh against the current `feature/v0.5.2` branch. The 2026-05-24 calibration below supersedes stale status counts while preserving the original refresh context.

2026-05-24 follow-up scope: proposal/project documents were reconciled with current code facts, one stale `ButtonArea` comment and a dead commented line were removed, and trailing whitespace in session-catalog proposal/design docs was cleaned. No runtime behavior code was changed.

## 2026-05-24 Calibration Addendum

- Current branch: `feature/v0.5.2`
- Active changes: 30
- Main specs: 271
- Archive changes: 318
- Active change status: 29 completed task sets, 1 in-progress task set.
- Only `add-codex-structured-launch-profile` remains implementation-in-progress (`0/7`).
- `harden-claude-sidebar-list-timeout-fallback` is now task-complete (`30/30`) after local dev-build manual QA was recorded.
- `fix-stale-thread-recovery-confidence-gates` is task-complete (`50/50`) with a recorded Windows + Claude manual smoke qualifier.
- Windows manual QA is still not covered locally. Archive notes must not claim Windows pass evidence unless a later Windows run, CI artifact, or explicit manual record is added.
- Compatibility / diagnostic paths such as `listClaudeSessions`, `listProjectRelatedCodexSessions`, legacy bare-session metadata lookup, and legacy cursor parsing are intentionally retained; they are not dead code in the current proposal boundary.

## Workspace Facts

- Current branch: `feature/v0.5.2`
- Active changes: 30
- Main specs: 271
- Archive changes: 318
- Strict validation before the original 2026-05-23 refresh: `openspec validate --all --strict --no-interactive` passed 299 items.
- Active change status after 2026-05-24 calibration: 29 completed task sets, 1 in-progress task set.

## Triage Table

| Change | Tasks | Status | Recommendation |
|---|---:|---|---|
| `add-codex-structured-launch-profile` | 0/7 | In progress / planning only | 继续实施前置项 |
| `add-cross-workspace-cost-admin-view` | 6/6 | Completed as deferred Product P2 | 延后，不进当前治理批次 |
| `add-email-driven-session-continuation` | 57/57 | Completed / pending verify-archive | 候选 verify/archive |
| `add-engine-plugin-onboarding-kit` | 6/6 | Completed as deferred Tooling P2 | 延后，不进当前治理批次 |
| `add-file-markdown-math-preview` | 12/12 | Completed / pending verify-archive | 候选 verify/archive |
| `add-memory-reference-persistent-mode` | 13/13 | Completed / pending verify-archive | 候选 verify/archive |
| `adjust-git-worktree-checkbox-placement` | 15/15 | Completed / pending verify-archive | 候选 verify/archive |
| `advance-harness-governance-to-90` | 51/51 | Completed / pending verify-archive | 候选 verify/archive |
| `desktop-editor-split-left-composer` | 8/8 | Completed / pending verify-archive | 候选 verify/archive |
| `dynamic-project-governance-evidence` | 34/34 | Completed / pending verify-archive | 候选 verify/archive |
| `fix-bottom-status-dock-collapse-stability` | 11/11 | Completed / pending verify-archive | 候选 verify/archive |
| `fix-codex-deferred-completion-after-assistant-ingress` | 7/7 | Completed / pending verify-archive | 候选 verify/archive |
| `fix-codex-empty-draft-stale-thread-auto-replay` | 11/11 | Completed / pending verify-archive | 候选 verify/archive |
| `fix-markdown-preview-auto-refresh` | 8/8 | Completed / pending verify-archive | 候选 verify/archive |
| `fix-stale-thread-recovery-confidence-gates` | 50/50 | Completed / pending verify-archive with Windows manual QA qualifier | 候选 verify/archive，保留 Windows qualifier |
| `harden-claude-sidebar-list-timeout-fallback` | 30/30 | Completed / pending verify-archive with local manual QA recorded | PR merge 后做 archive prep，保留 Windows qualifier |
| `improve-email-mail-session-list-controls` | 21/21 | Completed / pending verify-archive | 候选 verify/archive |
| `integrate-openspec-trellis-bridge-into-status-panel` | 18/18 | Completed / pending verify-archive | 候选 verify/archive |
| `optimize-bundle-chunking` | 14/14 | Completed / pending verify-archive | 候选 verify/archive |
| `optimize-long-list-virtualization` | 16/16 | Completed / pending verify-archive | 候选 verify/archive |
| `optimize-realtime-event-batching` | 17/17 | Completed / pending verify-archive | 候选 verify/archive |
| `preserve-editor-on-topbar-session-switch` | 7/7 | Completed / pending verify-archive | 候选 verify/archive |
| `refactor-mega-hub-split` | 16/16 | Completed / pending verify-archive | 候选 verify/archive |
| `refactor-workspace-session-management` | 62/62 | Completed / pending verify-archive | 候选 verify/archive |
| `stabilize-composer-control-surface` | 22/22 | Completed / pending verify-archive | 候选 verify/archive |
| `stabilize-core-runtime-and-realtime-contracts` | 32/32 | Completed / pending verify-archive | 候选 verify/archive |
| `stabilize-file-markdown-preview-render-architecture` | 26/26 | Completed / pending verify-archive | 候选 verify/archive |
| `stabilize-markdown-preview-awareness-and-large-rendering` | 15/15 | Completed / pending verify-archive | 候选 verify/archive |
| `stabilize-session-management-truth-boundaries` | 23/23 | Completed / pending verify-archive | 候选 verify/archive |
| `unify-claude-workspace-session-catalog` | 55/55 | Completed / pending verify-archive | 候选 verify/archive |

## Cross-Cutting Findings

1. The project-level OpenSpec snapshot was stale: `openspec/project.md` still described the 2026-05-20 `feature/v0.5.0-md` branch with active=15 before the original refresh. After the 2026-05-24 calibration the current workspace is `feature/v0.5.2` with active=30.
2. Most active changes are already task-complete but not archived. The next work is not broad implementation; it is closure hygiene: verification notes, strict validation, evidence qualifiers, sync/archive decisions.
3. One proposal must remain implementation-active:
   - `add-codex-structured-launch-profile` is still implementation-unstarted for the preview/editor contract.
4. Deferred P2 proposals (`add-cross-workspace-cost-admin-view`, `add-engine-plugin-onboarding-kit`) should not be mistaken for missed implementation; their current task-complete state records deliberate deferral.
5. Harness/governance changes now have visible code substrate in `StatusPanel`, governance evidence adapters, policy audit, check scripts, realtime batching, long-list/bundle gates, and source-fact/session catalog paths. Archive notes must preserve platform/evidence qualifiers instead of claiming unobserved Windows/Linux/manual coverage.
6. Session-management compatibility code remains intentional: native history/detail scans, Codex-related wrapper calls, stable-key read compatibility, and legacy cursor parsing are compatibility / diagnostics, not default Sidebar membership truth.

## Code Evidence Index

- Email continuation: `src/features/threads/utils/conversationCompletionEmail.ts`, `src/features/threads/hooks/useMailDrivenSessionContinuation.ts`, `src-tauri/src/email/session_continuation.rs`.
- Markdown preview: `src/features/files/components/FileMarkdownPreview.tsx`, `src/features/files/utils/fileMarkdownDocument.ts`, `src/features/files/hooks/useFileExternalSync.ts`, `src/features/markdown/markdownMath.ts`.
- Governance/status panel: `src/features/status-panel/components/StatusPanel.tsx`, `src/features/governance/evidence/*`, `scripts/check-governance-evidence-bridge.mjs`, `scripts/check-agent-domain-event-adoption.mjs`.
- Workspace sessions: `src-tauri/src/session_management*.rs`, `src-tauri/src/engine/claude_history_inline_tests.rs`, `src/services/tauri/sessionManagement.ts`, `src/services/tauri.test.ts`.
- Runtime/realtime/perf: `src/features/threads/contracts/realtimeEventBatcher.ts`, `src/features/threads/contracts/realtimeReplayHarness.ts`, `scripts/realtime-perf-report.ts`, `vite.config.ts`, `scripts/check-bundle-chunking.mjs`.
- Composer/editor surfaces: `src/features/composer/components/ChatInputBox/*`, `src/app-shell-parts/threadEditorPreservation.ts`, `src/features/layout/components/DesktopLayout.tsx`.

## Next Closure Sequence

1. Use the recorded local dev-build manual QA for `harden-claude-sidebar-list-timeout-fallback`, then run archive prep after the PR is merged while preserving the missing Windows evidence qualifier.
2. Keep `add-codex-structured-launch-profile` in implementation queue; do not archive until preview/editor/doctor contract lands.
3. For task-complete active changes, add or update verification artifacts before archive. Use existing focused tests and current strict validation as evidence, and record skipped/manual/platform gaps explicitly.
4. For `harden-claude-sidebar-list-timeout-fallback` and `fix-stale-thread-recovery-confidence-gates`, preserve the local manual-QA record and the missing Windows evidence boundary from `openspec/docs/session-management-refactor-closeout-2026-05-24.md`.
5. Refresh `openspec/project.md` only as a low-drift inventory snapshot; keep high-detail evidence in change artifacts or this report.
