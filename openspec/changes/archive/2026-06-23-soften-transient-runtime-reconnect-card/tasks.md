## 1. UI Classification

- [x] 1.1 Add UI-only transient/blocking tone to runtime reconnect hints, with `stale_reuse_cleanup` and `internal_replacement` classified as transient cleanup sources.
- [x] 1.2 Preserve existing blocking classification for broken pipe, workspace-not-connected, recovery quarantine, stale thread/session recovery, and runtime-ended diagnostics without cleanup source.

## 2. Rendering

- [x] 2.1 Update `RuntimeReconnectCard` to render transient cleanup diagnostics as low-interruption UI while keeping recovery actions available.
- [x] 2.2 Adjust message card CSS and i18n copy for transient cleanup status without changing backend or lifecycle behavior.
- [x] 2.3 Refine transient cleanup presentation into a lightweight notice style with theme-token based copy and CSS, preserving reconnect / resend behavior.
- [x] 2.4 Hide raw transient cleanup diagnostics from the notice body and repeated message text while preserving blocking diagnostic detail.
- [x] 2.5 Scope the reconnect card to the latest assistant diagnostic and hide stale diagnostics after newer assistant output resumes.

## 3. Verification

- [x] 3.1 Add or update focused tests for transient cleanup, blocking runtime-ended, and quoted diagnostic behavior.
- [x] 3.2 Run focused Vitest suites for runtime reconnect rendering.
- [x] 3.3 Run `npm run typecheck`.
- [x] 3.4 Run `openspec validate soften-transient-runtime-reconnect-card --strict --no-interactive`.
- [x] 3.5 Check light / dark / system theme token coverage and rerun lint, typecheck, focused Vitest, and large-file checks.
- [x] 3.6 Add focused regression coverage for user follow-up retention and newer assistant output clearing stale runtime diagnostics.
