## Why

Assistant replies already support copy, fork, and rewind behavior through separate surfaces, but those actions are not available at the message tail where users naturally review completed output. This adds a compact, repeatable action affordance without changing the underlying session contracts.

## 目标与边界

- Add a message-tail icon group for assistant messages in the conversation timeline.
- Keep copy available on historical assistant replies.
- Show fork only on the latest final assistant reply for the active thread.
- Show rewind only on the latest final assistant reply for the active thread.
- Reuse existing fork / rewind session commands; do not introduce a new backend protocol.

## 非目标

- Do not redesign the conversation timeline or final-message boundary.
- Do not add text-heavy buttons or a new toolbar outside the message tail.
- Do not change Codex / Claude rewind semantics.
- Do not add new dependencies.

## What Changes

- Replace the single hover copy affordance with a compact action group aligned to assistant reply tails.
- Copy remains available for each assistant reply and keeps the current clipboard feedback state.
- Fork is exposed only for the latest final assistant reply when the thread/workspace context can route to the existing fork flow.
- Rewind is exposed only for the latest final assistant reply and routes to the existing rewind-from-message flow.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-render-surface-stability`: add the user-facing message-tail action visibility contract for completed assistant replies.

## Impact

- Frontend message timeline components: `Messages.tsx`, `MessagesTimeline.tsx`, `MessagesRows.tsx`.
- Styles: `src/styles/messages.part1.css`.
- i18n copy for action labels in `src/i18n/locales/*`.
- Focused React tests for action visibility and copy behavior.
