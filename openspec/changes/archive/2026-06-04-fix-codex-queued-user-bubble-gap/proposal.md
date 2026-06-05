## Why

Codex realtime sessions can accept a queued follow-up immediately after the previous turn settles. During this handoff, the new user message may not yet be present in authoritative history. If realtime history reconcile refreshes too early, the latest user bubble can briefly disappear until the canonical history catches up.

This breaks the user's sense of continuity: they already sent the follow-up, but the conversation appears to lose it during the queued handoff window.

## What Changes

- Preserve a visible optimistic queued follow-up user bubble while the Codex queued handoff is in flight.
- Keep the handoff bubble thread-scoped and text/image/options-equivalent to the queued message.
- Delay Codex realtime history reconcile while an optimistic queued user bubble is still pending.
- Replace the optimistic bubble with the authoritative history user message once history catches up.
- Ensure the final timeline has exactly one matching user bubble, not zero and not duplicate optimistic+history rows.

## Non-Goals

- Do not change Codex runtime send payload shape.
- Do not change Claude/OpenCode/Gemini history reconcile behavior.
- Do not rewrite the Messages live render pipeline.
- Do not make queued slash commands render as normal handoff user bubbles.

## Capabilities

### New Capabilities

- `codex-queued-user-bubble-continuity`: defines the continuity contract for queued Codex follow-up user bubbles during handoff and history reconcile.

### Modified Capabilities

- `codex-realtime-canvas-message-idempotency`: history reconcile must not remove pending optimistic queued user bubbles before an authoritative matching history user message is available.

## Acceptance Criteria

- When a queued Codex follow-up is dispatched directly to the active thread, the UI exposes a visible optimistic user bubble.
- A history reconcile that runs before canonical history catches up must not produce a zero-user-bubble gap for that follow-up.
- Once canonical history includes the matching user message, the optimistic bubble is removed and the canonical row remains.
- The visible timeline must contain exactly one matching user bubble through and after the handoff.
- Focused tests cover the queued handoff and history reconcile path.
