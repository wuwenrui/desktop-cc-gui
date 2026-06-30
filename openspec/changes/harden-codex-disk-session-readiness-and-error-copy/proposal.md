## Why

Codex disk sessions currently expose a mismatch between user expectation and runtime reality: once the create-session loading state completes, users reasonably expect the first `sendMessage` to be ready, yet proxy/network instability can still surface `RUNTIME_ENDED`, `stale_reuse_cleanup`, `thread not found`, or `stale-thread-binding` as raw session failures.

This change records a narrow hardening pass for disk-backed Codex sessions only: loading completion must represent send readiness, and recoverable runtime/thread-binding failures must be described as connection/recovery states instead of misleading manual-shutdown or template-placeholder errors.

## 目标与边界

- Codex disk provider only: no provider profile id or `__disk__`.
- First-turn and immediate post-create send readiness only; durable stale-session recovery remains governed by existing stale-binding contracts.
- Runtime notice and recovery copy for the observed disk Codex failure modes: `stale_reuse_cleanup`, `stale-thread-binding`, `thread not found`, and `RUNTIME_ENDED`.
- Keep diagnostics correlatable through stable `reasonCode` / `userAction`; only the user-facing summary should be softened.

## 非目标

- Do not change Claude Code session creation, runtime lifecycle, recovery, or copy.
- Do not change managed Codex provider session creation or provider-scoped runtime behavior.
- Do not introduce a new recovery engine, new provider abstraction, or broad runtime lifecycle refactor.
- Do not hide real unrecoverable failures; failures should remain visible with actionable wording.
- Do not silently switch a disk session to any managed provider, or a managed provider session to disk.

## What Changes

- Tighten the disk Codex create-session readiness contract so a completed loading state means the created session is ready for an immediate first `sendMessage`, or the UI remains in a recovering/failed state.
- Audit the existing disk create-session loading path to confirm whether it already waits for native thread/runtime readiness; if it does, preserve behavior and document the evidence.
- If a defect exists, ensure disk create-session loading does not settle as ready while the disk runtime is still stopping, recovering, stale, or missing its just-created native thread binding.
- Map recoverable disk Codex runtime/thread-binding failures to concise user-facing copy such as "Codex connection interrupted; retry or reconnect" instead of raw `manual shutdown`, `thread not found`, or internal source strings.
- Prevent runtime notice template placeholders such as `{{reasonCode}}` and `{{actionHint}}` from leaking when optional values are absent.
- Keep implementation narrowly scoped through explicit checks/tests proving Claude Code and managed Codex provider session creation are not affected.

## 技术方案对比

| Option | Approach | Trade-off | Decision |
| --- | --- | --- | --- |
| A | Patch only the notice copy and leave create-session readiness untouched | Smallest change, but can mask a real loading/readiness contract bug | Not enough by itself |
| B | Add a disk-only readiness audit and targeted fix, plus copy mapping | Addresses both user expectation and observed misleading text without widening provider scope | Preferred |
| C | Redesign shared runtime lifecycle for every engine/provider | Could unify behavior, but risks Claude Code and managed-provider regressions | Explicitly out of scope |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-provider-scoped-session-launch`: strengthen disk-provider create-session readiness without applying the same behavior to managed Codex providers.
- `codex-stale-thread-binding-recovery`: refine stale thread/runtime copy and recovery surfacing for disk Codex stale binding failures.
- `global-runtime-notice-dock`: prevent raw diagnostics and missing interpolation placeholders from becoming final user-facing notice text.
- `runtime-session-lifecycle-stability`: clarify that recoverable internal cleanup during disk Codex create/send readiness must be represented as recovery state, not misleading manual user shutdown.

## Impact

- Frontend:
  - Codex disk create-session/loading hooks and message send readiness checks.
  - Runtime notice copy mapping and optional interpolation handling.
  - Focused Vitest coverage for disk Codex only, including non-regression assertions for Claude Code and managed Codex providers.
- Backend/Rust:
  - Audit only unless evidence shows disk create-session can return success before native thread/runtime readiness is actually usable.
  - Any backend change must remain disk-provider scoped and preserve existing managed provider behavior.
- Dependencies:
  - No new dependencies.

## Acceptance

- Creating a Codex disk session with healthy network completes loading and immediately allows the first `sendMessage`.
- If disk runtime/thread readiness is still recovering, the loading flow does not present the session as ready; it either keeps a bounded recovering state or settles to a clear retry/reconnect failure.
- `stale_reuse_cleanup` and equivalent internal cleanup are not described to the user as if they manually shut down Codex.
- `thread not found` / `stale-thread-binding` is presented as an old session binding or connection recovery issue, with retry/reconnect/fresh-session guidance where applicable.
- Optional notice placeholders never leak as `{{reasonCode}}` or `{{actionHint}}`.
- Claude Code session creation behavior is unchanged.
- Managed Codex provider session creation behavior is unchanged.
- OpenSpec validation passes for this change.
