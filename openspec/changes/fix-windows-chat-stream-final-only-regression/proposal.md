## Why

Windows chat streaming has regressed into "final output only" symptoms for Claude Code, while macOS remains healthy. The previous Claude fix (`fix-windows-claude-stream-json-stdin-prompt`) correctly removed the empty `-p ""` positional prompt, but the codebase still lacks regression coverage proving that live text is emitted before process/turn completion; Codex needs the same audit because it has a separate app-server stream path.

## Goals And Boundaries

- Keep macOS/Linux Claude streaming semantics unchanged: non-Windows text deltas continue to flush immediately.
- Preserve the existing Windows Claude 32ms coalescing window; it mitigates per-character UI pressure and is not the suspected final-only root cause.
- Add backend-level regression protection for Claude process stdout and Codex app-server events before touching frontend rendering mitigations.
- Make Codex diagnostics recognize existing app-server text-delta aliases consistently with frontend adapters.

## Non-Goals

- Do not add a new stream transport, dependency, or frontend rendering mode.
- Do not disable Windows `CREATE_NO_WINDOW` globally or introduce terminal popups.
- Do not change Claude prompt input back to argv.
- Do not claim Codex can be made truly streaming if the upstream app-server only emits a terminal completion; in that case the system must classify the missing delta path accurately.

## What Changes

- Add a Claude process-level regression guard that verifies delayed stdout text deltas are forwarded before the fake Claude process exits.
- Extend Codex backend timing detection so supported text-delta legacy aliases count as first assistant text ingress.
- Add Codex final-only timing coverage proving terminal completion text does not masquerade as a streamed delta.
- Keep platform-specific behavior scoped: Windows coalescing remains Windows-only, macOS/Linux immediate flush remains protected.

## Technical Options

| Option | Summary | Decision |
| --- | --- | --- |
| Patch frontend rendering only | Treat final-only symptoms as display lag and force visible recovery. | Rejected: it hides backend ingress failures and can misdiagnose Codex upstream/app-server behavior. |
| Remove Windows Claude coalescing | Emit every Windows delta immediately. | Rejected: prior fix intentionally addressed Windows per-character slowness; removing it risks performance regressions and would affect a healthy mitigation. |
| Add backend regression tests and narrow parser/timing compatibility | Prove live ingress before completion and align Codex backend timing with existing event aliases. | Chosen: smallest change that protects the real contracts without affecting mac behavior. |

## Capabilities

### New Capabilities

### Modified Capabilities

- `claude-code-realtime-stream-visibility`: add backend/process contract that Claude text deltas must be emitted before process completion and preserve non-Windows immediate flush.
- `conversation-stream-latency-diagnostics`: add Codex first text timing alias and final-only classification requirements.

## Impact

- Rust backend tests and small Codex timing helper logic.
- OpenSpec behavior contracts for Claude realtime visibility and Codex stream latency diagnostics.
- No new dependencies.
- No frontend visual contract changes.

## Acceptance Criteria

- A delayed fake Claude CLI produces `TextDelta` before process exit in tests.
- Codex backend timing marks `item/agentMessage/delta`, `text:delta`, `text/delta`, and `item/agentMessage/textDelta` as first assistant text when they carry non-empty text.
- Codex `turn/completed` with final text but no delta remains classified as no streamed first text.
- Focused Rust tests and strict OpenSpec validation pass.
