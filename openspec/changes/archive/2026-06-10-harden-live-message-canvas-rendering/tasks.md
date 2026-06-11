## 1. Planning / Contract

- [x] 1.1 Add OpenSpec proposal, design, tasks, and capability delta for live message canvas render stability.
- [x] 1.2 Validate change artifacts with OpenSpec strict validation. (`openspec validate harden-live-message-canvas-rendering --strict --no-interactive`)

## 2. Live Canvas Stability Helpers

- [x] 2.1 Add pure helper logic for active live row key detection and suspicious virtualizer state classification.
- [x] 2.2 Add unit tests for helper behavior, including streaming active tail and empty virtualizer visible items.

## 3. MessagesTimeline Integration

- [x] 3.1 Integrate a bounded remeasure guard into `MessagesTimeline` without changing backend/event contracts.
- [x] 3.2 Add privacy-safe bounded renderer diagnostics for suspicious live-canvas render states.
- [x] 3.3 Keep the active live tail row layout-stable during streaming without disabling virtualization globally.

## 4. Regression Validation

- [x] 4.1 Add or update focused tests for live text growth and virtualizer collapse recovery.
- [x] 4.2 Run focused messages tests. (`npm exec vitest run src/features/messages/components/messagesTimelineVirtualization.test.ts src/features/messages/components/Messages.codex-live-streaming.test.tsx src/features/messages/components/MessagesRows.stream-mitigation.test.tsx src/features/messages/components/Messages.windows-render-mitigation.test.tsx`)
- [x] 4.3 Run `npm run typecheck`.
- [x] 4.4 Update task checkboxes with executed validation evidence.
