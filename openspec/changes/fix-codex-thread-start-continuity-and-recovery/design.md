## Context

The Codex app-server path has a multi-step create/send sequence:

1. frontend starts or observes a Codex thread;
2. backend calls native `thread/start`;
3. backend confirms readiness with `thread/resume`;
4. frontend sends the first `turn/start`;
5. recovery logic handles stale or missing thread failures.

Before this change, a thread that had already passed native `thread/start` could still be classified as an empty draft and silently replaced when a later send failed with `thread not found`. That conflated local UI-only drafts with native provider threads.

## Goals / Non-Goals

Goals:

- Preserve the native thread identity returned by Codex `thread/start` unless recovery finds a verified rebind or the user explicitly chooses a continuation path.
- Keep cold-start readiness recovery same-runtime, bounded, and diagnosable.
- Protect just-started Codex runtime foreground work from idle cleanup/reconcile while readiness is pending.
- Prevent static history changes from using live auto-follow scroll behavior.

Non-Goals:

- No new provider profile model.
- No change to durable stale-thread alias persistence.
- No new user-facing recovery card copy.
- No OpenCode/Gemini behavior changes.

## Decisions

### Decision 1: Native thread-start empty drafts are not disposable

Frontend now marks Codex `thread/started` as `fact=empty-draft` with `source=thread-start`. Recovery helpers treat that source as native/provider-owned, not disposable. Silent fresh replacement is restricted to `local-first-send-draft` plus current optimistic user intent.

This preserves the distinction between "no native thread exists yet" and "native thread exists but is not ready or has become stale".

### Decision 2: Backend readiness retry uses same-runtime thread/resume

`wait_for_thread_resume_ready` retries `thread/resume` on `thread not found` response shapes with finite delays. Both `confirm_thread_ready_after_start_core` and stale `turn/start` retry reuse that helper.

The retry never switches provider, never starts a disk fallback runtime, and returns a bounded error when readiness does not converge. A `thread/resume` response is only considered ready when it has no RPC error and, if it returns a thread identity, that identity matches the newly started thread. This keeps create-session from activating a Codex thread whose resume check already proved an error or a mismatched native identity.

Codex can transiently return `no rollout found for thread id` immediately after `thread/start`. That means the new thread exists but the app-server rollout is not yet resumable; it is not evidence that creation failed. The backend treats this as retryable not-ready and, if the bounded retry window only sees rollout-pending responses, soft-confirms readiness instead of surfacing a create-session failure that would cause the client to create a duplicate thread.

### Decision 3: Runtime pool records thread-start foreground continuity

After valid `thread/start`, `WorkspaceSession::note_codex_thread_started_pending` records `RuntimeForegroundWorkState::StartupPending` with source `thread-started`. Reconcile then sees active-work protection and avoids evicting the runtime while first-turn readiness is still pending.

### Decision 4: Static history item changes are not live auto-follow

`Messages` keeps auto-follow for active work and assistant finalization, but does not call `scrollIntoView` merely because static history rows changed while no turn is active.

### Decision 5: Disk Codex runtime is prewarmed without precreating threads

Active connected workspaces prewarm only the disk/default Codex runtime (`codex-tui/default-config`) by ensuring the workspace-level Codex app-server session exists. The prewarm path does not call `thread/start`, does not create empty history rows, and does not touch managed provider profiles.

This moves the expensive app-server cold-start work out of the create-session click path while preserving provider isolation. Managed providers remain on-demand because they are already stable and have provider-scoped homes/config.

## Validation & Error Matrix

| Scenario | Required behavior | Forbidden behavior |
|---|---|---|
| `thread/start` returns blank thread id | reject as invalid and clear foreground work | record blank thread as pending |
| valid native `thread/start` | mark runtime foreground continuity as `StartupPending` / `thread-started` | allow reconcile to evict as idle before first send |
| `thread/start` readiness sees `thread not found` | retry bounded same-runtime `thread/resume` | route to disk provider or create a second thread |
| `thread/resume` returns `no rollout found for thread id` | retry bounded same-runtime resume and soft-confirm after rollout-pending exhaustion | surface create-session failure that triggers a second thread |
| `thread/resume` returns unretryable RPC error or wrong thread id | fail create-session readiness without client auto-create retry | treat any non-`thread not found` response as ready or create a replacement thread |
| active workspace becomes connected | prewarm disk Codex runtime only | precreate a Codex thread or prewarm managed providers |
| `turn/start` cold-start race | perform bounded same-runtime resume readiness before retrying original request | unbounded retry or provider switch |
| native `thread-start` empty draft send fails | visible error/rebind path; no silent fresh/fork replacement | create another fresh thread invisibly |
| unknown native missing-thread failure | fail conservatively | infer disposable draft from missing durable evidence alone |
| static history update | no auto-follow scroll when not working/finalizing | scroll to bottom on history append |

## Rollback

`git revert` the implementation/spec commit. No storage schema migration is involved.
