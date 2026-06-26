## 1. OpenSpec Artifacts

- [x] 1.1 [P0][depends:none][I: `proposal.md`][O: define why, target boundary, non-goals, option trade-offs, impact, acceptance criteria][V: file exists and references existing capabilities] Write proposal.
- [x] 1.2 [P0][depends:1.1][I: `design.md`][O: document root cause, selected design, data flow, tests, rollback][V: file exists and explains why engine batching is out of scope] Write design.
- [x] 1.3 [P0][depends:1.1][I: delta specs][O: update `messages-outline-floater` and `message-markdown-streaming-compatibility` contracts][V: `openspec validate fix-message-outline-streaming-jank --strict --no-interactive`] Write spec deltas.

## 2. Implementation

- [x] 2.1 [P0][depends:1.2,1.3][I: `MessagesTimeline.tsx`][O: replace per-render curried `handleOutlineReady(renderItem.id)` with stable live outline callback and local row adapter][V: focused timeline/helper tests prove callback/state semantics] Stabilize outline callback path.
- [x] 2.2 [P0][depends:2.1][I: `MessagesTimeline.tsx`][O: add semantic equality guard for `{ messageId, outline }` so identical payload returns previous state reference][V: same-outline test returns previous reference] Make outline state idempotent.
- [x] 2.3 [P1][depends:2.1][I: `Markdown.tsx`][O: add one-entry cache keyed by exact `throttledValue` before `extractOutlineFromMarkdown`][V: test spies extraction call count under same visible source rerender] Cache outline extraction by visible source.

## 3. Verification

- [x] 3.1 [P0][depends:2.x][I: focused Vitest][O: `Markdown.outline-streaming`, `Messages.streaming-presentation`, `messagesLiveWindow`, and timeline outline helper tests pass][V: command exit code 0] Run focused tests.
- [x] 3.2 [P0][depends:3.1][I: OpenSpec CLI][O: strict change validation passes][V: `openspec validate fix-message-outline-streaming-jank --strict --no-interactive` exit code 0] Validate OpenSpec change.
