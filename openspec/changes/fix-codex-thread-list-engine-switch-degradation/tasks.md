## Tasks

- [x] 1.1 Analyze `2026-05-31` error-log timing and classify `thread/list live timeout`, `thread/list error`, and `engine/switch error`.
- [x] 1.2 Confirm `account/rateLimits/read error` is out of scope for this fix.
- [x] 1.3 Compare current code with prior OpenSpec strategy for bounded thread-list fallback and environment doctor evidence.
- [x] 2.1 Update desktop unified Codex thread listing so live `thread/list` failure degrades to local session scan.
- [x] 2.2 Preserve `local-session-scan-unavailable` priority when both local scan and live list are degraded.
- [x] 2.3 Add bounded local scan timeout for desktop fallback.
- [x] 2.4 Update daemon `list_threads` to fallback to local Codex session summaries on live timeout/error.
- [x] 2.5 Add daemon degraded empty response for local fallback timeout/error.
- [x] 3.1 Update engine switch hook to refresh stale engine detection before failing.
- [x] 3.2 Add Codex doctor evidence to remaining switch failure debug payload.
- [x] 4.1 Add Rust tests for partial-source priority and daemon degraded response shape.
- [x] 4.2 Add Vitest coverage for stale Codex status refresh and doctor evidence.
- [x] 5.1 Run focused Rust checks and tests.
- [x] 5.2 Run focused frontend lint and Vitest.
- [x] 5.3 Run runtime contract checks.
- [x] 5.4 Record unrelated full typecheck blocker.
