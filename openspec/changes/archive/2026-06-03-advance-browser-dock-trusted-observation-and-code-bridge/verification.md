# Verification Notes - Browser Dock Trusted Observation and Code Bridge

Date: 2026-06-03

## Verification Status

No automated validation was run during this writeback session.

Reason: this session is documentation/spec calibration only. The working tree already contains broad browser-related implementation changes, and validation should be run deliberately as a separate checkpoint to avoid mixing documentation writeback with behavioral debugging.

## Recommended Minimum Verification

Run these after the current documentation writeback is reviewed:

```bash
pnpm vitest run \
  src/features/browser-agent/components/BrowserContextPreview.test.tsx \
  src/features/browser-agent/utils/attachment.test.ts \
  src/features/browser-agent/utils/codeCandidates.test.ts \
  src/features/browser-agent/capture/readOnlyCaptureScript.fixture.test.ts
```

```bash
pnpm tsc --noEmit
```

If the Tauri toolchain is available, also run the smallest available Rust check for the Browser Agent crate/module path.

## Manual Verification Matrix

| Scenario | Expected result |
| --- | --- |
| Open Browser Dock in Chinese locale | Toolbar title/button/status/open/close/new tab labels render in Chinese. |
| Open Browser Dock in English locale | Toolbar title/button/status/open/close/new tab labels render in English. |
| Multiple toolbar tabs, attach current tab | Attach action targets the clicked tab session, not the first created session. |
| Multiple toolbar tabs, close current tab | Close action closes the clicked/active tab and preserves remaining tab state. |
| Reopen detached dock window | Existing latest browser agent session can be reopened without losing active context metadata. |
| Capture readable page | Evidence panel shows read-only page context and does not mutate the browser page. |
| Code bridge candidate extraction | Candidate list is derived from captured evidence and remains auditable. |
| Thread send with browser context | Browser context prompt is injected once and does not duplicate stale context. |

## Residual Risks

- Multi-window and multi-workspace session state can still regress if future toolbar actions stop carrying explicit `sessionId` / `workspaceId`.
- Rust-injected toolbar labels are separate from React i18n resources; future toolbar copy needs both sides updated unless a shared localization bridge is introduced.
- Visual evidence capability may degrade across runtime/browser/platform combinations and should remain explicitly represented in UI copy and capability matrix.
