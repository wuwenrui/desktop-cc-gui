# Proposal: Fix stale thread binding recovery continuity

## Problem

Codex stale thread recovery already persists verified aliases and several lifecycle paths call `resolveCanonicalThreadId`, but the active workspace thread map is the high-risk restart/restore seam. If a stale `activeThreadId` survives in that map, later lifecycle consumers can look restored while still targeting the old thread id.

## Goal

Make the active-thread canonicalization contract explicit and regression-covered without changing recovery strategy, UI labels, or runtime acquisition policy.

## Non-Goals

- Add new recovery actions.
- Change recover-only / recover-and-resend semantics.
- Change backend runtime retry budgets.
- Guess replacement threads from weak evidence.

## Scope

- Extract the active-thread map canonicalization decision into a pure helper.
- Keep `useThreads` behavior equivalent, but route the canonicalization effect through the helper.
- Add focused regression coverage for alias-chain active thread rebindings.
