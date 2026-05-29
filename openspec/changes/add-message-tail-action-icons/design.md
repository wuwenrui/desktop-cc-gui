## Context

The message renderer already computes final assistant boundaries and already has copy state at the row level. The composer already exposes the shared fork flow, and rewind already has an anchored confirmation path. The missing piece is a small UI adapter that renders assistant tail actions without creating a second fork semantic.

## Goals / Non-Goals

**Goals:**

- Render a compact icon group at assistant message tails.
- Keep copy visible for historical assistant messages.
- Keep fork visible only for the latest final assistant message.
- Render rewind only on the latest final assistant reply.
- Route fork through the existing composer fork flow after confirmation.
- Route rewind through the existing anchored rewind confirmation dialog.
- Preserve streaming render invariants: no hot-path timeline recomputation per text delta.

**Non-Goals:**

- No new Tauri command or backend session model.
- No change to provider history parsing.
- No broad visual refresh of messages or final boundary separators.

## Decisions

### Decision 1: Extend the existing MessageRow action surface

The message row path already owns copy state and rendered text. The tail action row keeps icon placement and copy feedback local to the message render surface while letting `MessagesTimeline` pass latest-final capability flags and handlers.

Alternatives considered:

- Add a separate timeline-level toolbar after every final boundary. Rejected because historical replies still need copy, and it would visually detach actions from their message.
- Add actions inside Markdown content. Rejected because it risks selection/copy interference and mixes document content with controls.

### Decision 2: Resolve assistant actions to the previous user message

Existing rewind callbacks operate from a user message anchor. For an assistant reply, the semantic rewind anchor is the closest previous user message in the same thread. `Messages` can compute this mapping once from the current item list and pass the target id down by assistant message id. Fork now reuses the shared composer fork flow, so historical assistant replies keep copy only while the latest final assistant reply exposes fork as the branch action.

Alternatives considered:

- Pass assistant message id directly into rewind. Rejected because it violates the existing service contract and could select the wrong runtime turn.
- Add backend support for assistant anchors now. Rejected as unnecessary scope expansion.

### Decision 3: Keep branch actions latest-final only

Fork and rewind both change the user's active navigation context, so they should be visually attached only to the latest final assistant reply. Older assistant messages keep copy without showing branch controls through the middle of history.

Alternatives considered:

- Show fork or rewind on every assistant reply. Rejected because it creates branch controls throughout history and clutters review scans.
- Show rewind only in the final boundary row. Rejected because the user asked for message-end icons and the boundary is metadata, not the reply action surface.

## Risks / Trade-offs

- Assistant-to-user anchor mapping can be missing for imported or malformed transcripts; in that case rewind should not render, and latest fork should also remain hidden when the shared action is unavailable.
- Exposing branch actions on historical replies increases visual noise, so fork and rewind are constrained to the latest final assistant reply.
- Rewind remains engine-scoped through existing callbacks; unsupported threads should simply omit the action.
- Message-tail rewind should request the existing composer confirmation dialog instead of executing immediately, preserving the same explicit confirm step as the bottom composer rewind entry.

## Migration Plan

1. Add OpenSpec delta and task checklist.
2. Add message action props and pure helper mapping in the message render path.
3. Replace the assistant copy-only tail affordance with a compact action row.
4. Add a shared confirmation dialog for message-tail fork and reuse the composer fork flow after confirmation.
5. Add i18n labels and CSS.
6. Run focused message/layout tests and typecheck.

Rollback is a normal revert of the UI, tests, and spec delta. No persisted data migration is involved.
