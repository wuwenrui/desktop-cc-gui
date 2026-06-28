## Context

The previous Windows fixes corrected Claude stream-json command construction and added streaming timing regression tests. They explicitly did not clean already polluted history. The current screenshots show the remaining gap: raw stdin protocol JSON can still be loaded as a normal Claude user message and can become the thread title.

## Decisions

### Decision 1: Reuse control-plane filtering

Add a small predicate to the existing Claude history control-plane classifier rather than adding a separate UI-only sanitizer. Backend scan/load is the authority for native Claude history, and frontend parsing already mirrors that contract for legacy/cache fallback.

The predicate is intentionally high-confidence:

- text must parse as a JSON object;
- top-level `type` must be `user`;
- nested `message.role` must be `user`;
- nested `message.content` must be an array containing text/image-style content blocks.

This distinguishes leaked Claude stdin protocol from normal user discussion that merely contains JSON text.

### Decision 2: Quarantine polluted assistant echoes until the next real user

Windows failures can persist a protocol user payload followed by Claude's response to that payload. Filtering only the raw JSON row leaves the assistant echo visible, which can still create a polluted second-session view. When the parser sees a leaked stream-json stdin payload, it MUST suppress subsequent assistant-side rows until the next non-control-plane user row.

This keeps the rule scoped:

- real user rows terminate quarantine;
- normal assistant rows before any leaked payload remain visible;
- successful native session continuation is unaffected because no leaked stdin payload is present.

### Decision 3: Do not alter pending native-session state here

The root cause is curated skill transport through Windows wrappers, handled by `fix-codex-app-server-curated-skill-transport`. This history compatibility change must not add a separate frontend pending-session state-machine branch.

## Risks / Trade-offs

- A user could intentionally send the exact Claude protocol envelope as their message. This will now be hidden in Claude history. The risk is acceptable because that exact shape is an internal transport envelope and was the observed pollution signature.
- Frontend and backend sanitizer logic can drift. Tests will cover the same shape on both sides.
- Assistant-side quarantine can hide a legitimate assistant message immediately after a leaked protocol row. That pairing is only produced by a failed bootstrap transcript, so the safer user-visible behavior is to drop it until a real user turn restarts the conversation.

## Validation

- Focused Rust history tests for control-plane predicate, list summary, and load restore.
- Focused Vitest for frontend fallback parser.
- Focused cargo check/test around touched Rust modules where feasible.
- Strict OpenSpec validation for this change.
