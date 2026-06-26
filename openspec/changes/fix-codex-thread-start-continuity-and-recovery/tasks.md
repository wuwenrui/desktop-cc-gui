## 1. Backend Codex Readiness

- [x] 1.1 Trim and reject blank thread ids in `extract_thread_id_from_response`.
- [x] 1.2 Add bounded `thread/resume` readiness retry helper for `thread/start` confirmation and stale `turn/start` recovery.
- [x] 1.3 Keep retry same-runtime and same-provider; do not fallback to disk or start a replacement thread.
- [x] 1.4 Add Rust coverage for blank thread ids and runtime foreground continuity protection.
- [x] 1.5 Reject false-ready `thread/resume` responses during create-session readiness when they contain RPC errors or a mismatched thread id.
- [x] 1.6 Treat `no rollout found for thread id` as rollout-pending readiness and avoid surfacing a duplicate-triggering create failure.

## 2. Runtime Foreground Continuity

- [x] 2.1 Record `thread-started` foreground work continuity after valid Codex `thread/start`.
- [x] 2.2 Preserve active-work protection through runtime pool reconcile while startup/first-turn readiness is pending.
- [x] 2.3 Prewarm only the active workspace disk/default Codex runtime without precreating threads or touching managed providers.

## 3. Frontend Recovery Boundary

- [x] 3.1 Mark native Codex `thread/started` empty drafts with accepted-turn source `thread-start`.
- [x] 3.2 Restrict silent fresh replacement to authoritative disposable local first-send drafts with optimistic user intent.
- [x] 3.3 Prevent fork continuation for unknown/native missing-thread failures without accepted or durable activity.
- [x] 3.4 Treat refresh returning the same missing thread as unverified and settle conservatively instead of creating a second thread.
- [x] 3.5 Preserve disk provider metadata fallback for selected disk profile bindings.
- [x] 3.6 Prevent post-start readiness failures from auto-running create-session again.

## 4. Message Auto-Follow

- [x] 4.1 Gate auto-follow scroll requests behind active work or assistant finalization.
- [x] 4.2 Add regression coverage proving static history item changes do not trigger auto-follow scroll.

## 5. Spec And Guideline Writeback

- [x] 5.1 Add OpenSpec deltas for `codex-stale-thread-binding-recovery`.
- [x] 5.2 Add OpenSpec deltas for `conversation-runtime-stability`.
- [x] 5.3 Add OpenSpec delta for `long-list-virtualization-performance`.
- [x] 5.4 Update `.trellis/spec/frontend/hook-guidelines.md` so future hook work preserves native `thread-start` recovery semantics.

## 6. Verification

- [x] 6.1 User reported the working tree code has already passed tests before this writeback/commit request.
- [x] 6.2 Run `openspec validate fix-codex-thread-start-continuity-and-recovery --strict --no-interactive`.
- [x] 6.3 Run `git diff --check`.
- [ ] 6.4 Commit implementation and OpenSpec writeback.
- [ ] 6.5 Record Trellis session after commit.
