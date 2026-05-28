## 1. Contract Calibration

- [x] 1.1 [P0][depends:none][I: existing `RequestUserInputMessage` and `useThreadUserInput` code][O: confirmed close path ownership][V: close path maps to production inline card, not unused overlay only] Reconfirm the production dismiss call chain.
- [x] 1.2 [P0][depends:1.1][I: OpenSpec delta specs][O: accepted behavior contract][V: `openspec validate fix-user-input-dismiss-settlement --strict --no-interactive`] Validate the OpenSpec change before implementation.

## 2. Implementation

- [x] 2.1 [P0][depends:1.2][I: `useThreadUserInput`][O: dismiss settlement handler][V: empty-answer close calls `respond_to_server_request` with thread/turn ids] Implement runtime-visible empty-answer settlement for dismiss.
- [x] 2.2 [P0][depends:2.1][I: stale request errors][O: tolerant stale cleanup][V: unknown/disconnected stale request removes local card without fatal submit error] Preserve stale fallback behavior.
- [x] 2.3 [P1][depends:2.1][I: request card UI tests][O: updated close semantics tests][V: component test asserts close invokes settlement, not UI-only hide] Update component coverage.

## 3. Verification

- [x] 3.1 [P0][depends:2.3][I: focused Vitest suites][O: passing regression tests][V: `npm exec vitest run src/features/app/components/RequestUserInputMessage.test.tsx src/features/threads/hooks/useThreadUserInput.test.tsx`] Run focused frontend tests.
- [x] 3.2 [P1][depends:3.1][I: TypeScript touched files][O: type safety evidence][V: `npm run typecheck`] Run typecheck if focused tests pass.
- [x] 3.3 [P0][depends:3.1][I: OpenSpec artifacts][O: final spec validation evidence][V: `openspec validate fix-user-input-dismiss-settlement --strict --no-interactive`] Validate the final OpenSpec change.

## 4. UX Refinement

- [x] 4.1 [P0][depends:2.1][I: UX feedback that X should not imply exit][O: split close/skip semantics][V: X collapses locally; skip calls runtime settlement] Split “收起” from “跳过并继续”.
- [x] 4.2 [P0][depends:4.1][I: updated component tests][O: regression coverage][V: `npm exec vitest run src/features/app/components/RequestUserInputMessage.test.tsx src/features/messages/components/chatCanvasSmoke.test.tsx src/features/threads/hooks/useThreadUserInput.test.tsx`] Run focused tests after UX refinement.
- [x] 4.3 [P1][depends:4.2][I: touched TS/i18n files][O: static validation][V: `npm run typecheck && npm run lint`] Run static validation.

## 5. Review Fixes

- [x] 5.1 [P0][depends:4.1][I: code review finding that collapse removed the only action path][O: compact collapsed request bar][V: collapsed request exposes expand and skip controls] Keep locally collapsed pending requests actionable.
- [x] 5.2 [P0][depends:4.1][I: code review finding unhandled timeout settlement rejection][O: retryable timeout failure state][V: timeout settlement failure keeps request visible and shows submit error] Handle auto-timeout settlement failure explicitly.
- [x] 5.3 [P1][depends:5.1][I: ask dialog label review finding][O: dialog-specific cancel accessible label][V: `AskUserQuestionDialog.test.tsx` close test uses `askUserQuestion.cancel`] Use dialog-specific cancel label for AskUserQuestion close/cancel.

## 6. Partial Answer / History Echo Hardening

- [x] 6.1 [P0][depends:4.1][I: user report that answering an earlier question then skipping later loses or misplaces answers][O: partial answer preservation][V: `RequestUserInputMessage.test.tsx` preserves previous answers and sends `skippedQuestionIds`] Preserve already-entered answers when skipping a later question.
- [x] 6.2 [P0][depends:6.1][I: live request settlement][O: originating AskUserQuestion tool row completed locally][V: `useThreadUserInput.test.tsx` upserts completed `askuserquestion` row before removing request] Prevent the original tool row from staying stuck in running state after settlement.
- [x] 6.3 [P0][depends:6.1][I: Claude AskUserQuestion answer echo text][O: submitted history card normalization][V: `threadItems.test.ts` and `claudeHistoryLoader.test.ts` convert answer/skip echoes into `requestUserInputSubmitted` cards] Normalize AskUserQuestion answer and skip echoes instead of rendering raw resume-control text.
- [x] 6.4 [P0][depends:6.3][I: multiple AskUserQuestion prompts in one thread][O: tool-id and question-id binding][V: regression keeps previous answers attached to the original tool only] Ensure previous AskUserQuestion answers never drift into a new AskUserQuestion card.
- [x] 6.5 [P0][depends:6.3][I: answer values containing `=` or `;`][O: structured `AskUserQuestionResultBase64` marker plus legacy fallback][V: regression preserves `version=1.0` and structured answers containing `; key=value`] Harden parser compatibility and avoid delimiter-induced card corruption.
- [x] 6.6 [P1][depends:6.5][I: changed Rust/TS normalization paths][O: validation evidence][V: `cargo test --manifest-path src-tauri/Cargo.toml ask_user_question_answer`; focused Vitest; `npm run typecheck`; `npm run lint`] Run final cross-layer validation.
