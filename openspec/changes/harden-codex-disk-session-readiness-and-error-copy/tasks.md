## 1. Readiness Audit

- [x] 1.1 [P0][I: disk Codex create-session UI action + backend `thread/start` path][O: concise audit note in implementation PR or verification notes][V: trace identifies the exact point where loading settles] Trace Codex disk create-session loading from user action to native thread/runtime readiness.
- [x] 1.2 [P0][depends:1.1][I: managed Codex provider create-session path][O: explicit non-impact note][V: trace proves disk-only checks are gated by no provider profile id or `__disk__`] Confirm managed provider create-session is not on the disk readiness path.
- [x] 1.3 [P0][depends:1.1][I: Claude Code session creation path][O: explicit non-impact note][V: trace proves no shared helper change is needed or helper changes are guarded] Confirm Claude Code is not affected by this change.

## 2. Disk Readiness Hardening

- [x] 2.1 [P0][depends:1.1][I: readiness audit result][O: no-op evidence or minimal disk-only fix][V: healthy disk session loading completion permits immediate first send] If audit finds loading already waits for send readiness, preserve behavior and document evidence; otherwise patch the disk-only readiness boundary.
- [x] 2.2 [P0][depends:2.1][I: disk runtime stopping/recovering/stale states][O: bounded recovering or actionable failure state][V: create-session does not settle as loaded while disk thread binding is stale or unconfirmed] Ensure disk readiness failure does not masquerade as loaded.
- [x] 2.3 [P1][depends:2.1][I: existing stale recovery classification][O: at-most-once retry/reconnect behavior if already supported][V: no unbounded retry loop under repeated proxy/network failures] Preserve bounded recovery behavior for unstable proxy/network scenarios.

## 3. Runtime Notice And Copy

- [x] 3.1 [P0][I: `runtimeNotice.error.threadTurnFailed` and runtime notice rendering][O: safe optional interpolation][V: notices never render `{{reasonCode}}` or `{{actionHint}}`] Fix optional runtime notice placeholders so missing fields are omitted cleanly.
- [x] 3.2 [P0][I: `stale_reuse_cleanup`, `internal_replacement`, `RUNTIME_ENDED`, `stale-thread-binding`, `thread not found`][O: disk Codex user-readable copy mapping][V: screenshot-class failures show retry/reconnect wording, not raw manual shutdown text] Map known disk Codex recovery states to concise actionable copy.
- [x] 3.3 [P1][depends:3.2][I: structured diagnostics payloads][O: raw reason/source retained outside final summary][V: diagnostics still include correlatable reason/source fields] Keep diagnostics useful while softening final UI copy.

## 4. Regression Coverage

- [x] 4.1 [P0][depends:2.1][I: focused frontend tests for disk Codex create-session/send readiness][O: regression coverage][V: test proves loading completion implies first-send readiness or visible recovery/failure] Add focused coverage for disk Codex readiness.
- [x] 4.2 [P0][depends:3.1,3.2][I: runtime notice tests][O: copy/interpolation coverage][V: tests cover missing optional params, `stale_reuse_cleanup`, and `thread not found`] Add runtime notice copy tests for observed failure classes.
- [x] 4.3 [P0][depends:2.1,3.2][I: managed Codex provider and Claude Code test seams][O: non-regression assertions][V: tests or trace assertions prove neither path uses disk-only readiness/copy behavior] Add or document explicit non-regression checks for managed Codex providers and Claude Code.

## 5. Verification

- [x] 5.1 [P0][depends:1.1-4.3][I: completed implementation][O: focused test command output][V: relevant Vitest/Rust tests pass] Run focused tests for touched frontend/backend behavior.
- [x] 5.2 [P0][I: this OpenSpec change][O: validation output][V: `openspec validate harden-codex-disk-session-readiness-and-error-copy --strict --no-interactive` passes] Validate the OpenSpec change.
- [x] 5.3 [P1][depends:5.1][I: final diff][O: implementation summary][V: summary lists files touched and states Claude Code / managed Codex provider impact as unchanged] Record final implementation impact and remaining manual test notes.
