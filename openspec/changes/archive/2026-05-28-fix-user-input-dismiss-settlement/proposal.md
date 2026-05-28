## Why

`RequestUserInput` live card previously used a single “关闭” affordance for two different user intents: visually hiding the card and skipping the pending runtime question. A prior fix made that close path settle the runtime request, which repairs liveness but makes the X button too destructive for users who only want to get the card out of the way.

The refined UX contract must expose both intents explicitly: X/收起 is local presentation, while “跳过并继续” is the runtime-visible empty-answer settlement. A collapsed pending request must still keep a visible compact handling surface so the user can expand it or skip it later.

## 目标与边界

- Goal: make the explicit skip path for live user-input cards produce an explicit settled lifecycle, so the request stops blocking current and future interaction.
- Goal: keep the card X/close affordance as local collapse only, so users can reduce visual weight without sending a runtime answer.
- Goal: keep collapsed pending requests actionable through a compact bar with expand and skip controls.
- Goal: keep timeout auto-settlement failure retryable and avoid unhandled async errors.
- Goal: keep submit behavior unchanged for normal answers.
- Goal: prevent dismissed/cancelled request cards from being reintroduced by local history hydration when the user already settled them.
- Goal: preserve partial answers when the user answers earlier AskUserQuestion steps and skips later steps.
- Goal: bind submitted AskUserQuestion answers to the originating tool id and question id, so prior answers never drift into a later AskUserQuestion card.
- Goal: keep answer echo normalization compatible with free-text answers containing `=` or `;` and avoid parser-induced card mis-highlighting.
- Boundary: this change targets the live `RequestUserInput` / Claude `AskUserQuestion` card path in the chat canvas.
- Boundary: do not redesign approval dialogs, plan-mode policy, or the entire conversation history loader.

## What Changes

- Treat the live card’s explicit “跳过并继续” action as a settlement action, not a presentation-only hide.
- Treat the live card’s X affordance as “收起” / local collapse only.
- Render collapsed pending requests as a compact bar that keeps “展开” and “跳过并继续” available.
- Send an empty-answer response through the existing `respond_to_server_request` contract when the user explicitly chooses “跳过并继续”, matching the backend’s existing “dismissed without selecting” resume behavior.
- Keep stale/unknown request fallback behavior tolerant: if runtime already timed out or disconnected, remove the request locally without throwing.
- Preserve local dismissal cleanup and draft cleanup after settlement.
- Preserve already-entered answers when the user skips a later question; only the active and remaining questions are marked skipped.
- Locally complete the originating `askuserquestion` tool row after settlement so the timeline does not remain stuck on a running tool.
- Normalize Claude AskUserQuestion echo messages into `requestUserInputSubmitted` cards instead of rendering raw resume-control text as ordinary chat bubbles.
- Prefer a structured `AskUserQuestionResultBase64` marker for new AskUserQuestion answer echoes; fall back to legacy text parsing for existing history.
- Treat `key=value` as keyed answer data only when `key` matches a question id from the originating AskUserQuestion template; otherwise preserve it as normal free text.
- Update tests so the production card close path no longer asserts “without submitting”.
- No breaking API changes and no new dependency.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-chat-canvas-user-input-elicitation`: pending request card close semantics split into local collapse and explicit skip/dismiss response.
- `conversation-fact-contract`: dismissed user-input requests must stop blocking and must not rehydrate as actionable after settlement.

## 技术方案选项与取舍

| Option | Summary | Trade-off |
|---|---|---|
| A | Rename “关闭” to “收起” and keep UI-only behavior | Least invasive, but preserves the runtime mismatch and history re-pop issue. |
| B | Add a separate “跳过并继续” action and keep close as hide | More precise UX, separates presentation from runtime lifecycle, and matches user expectation for X buttons. |
| C | Make current close path submit an empty-answer settlement | Smallest contract repair, aligns with existing backend behavior, and fixes the current user complaint without broad UI redesign. |

Chosen: Option B after refinement. Option C repaired the runtime bug but made a low-risk close affordance too semantically heavy.

## 非目标

- No broad modal redesign.
- No new backend request type unless existing empty-answer settlement proves insufficient.
- No change to normal answer submission payload shape.
- No change to approval request accept/decline behavior.
- No full conversation-history architecture rewrite.

## 验收标准

- Given a pending live `RequestUserInput` card, when the user clicks X/收起, the frontend must hide the card locally without calling `respond_to_server_request`.
- Given that card is locally collapsed, the frontend must still render a compact visible request surface with expand and skip controls.
- Given a pending live `RequestUserInput` card, when the user clicks “跳过并继续”, the frontend must call `respond_to_server_request` with `{ answers: {} }` and the associated `threadId/turnId`.
- Given that response succeeds, the frontend must remove the pending request from `userInputRequests`.
- Given that response fails, the frontend must keep or restore a visible retryable request surface.
- Given the runtime reports the request is already stale or disconnected, the frontend must remove the card locally without surfacing a fatal error.
- Given a normal submit with answers, existing submitted audit item behavior must remain unchanged.
- Given a multi-question AskUserQuestion where the user answers one question and skips a later question, the submitted history card must keep the answered question selected and leave skipped questions empty.
- Given a later AskUserQuestion appears after an earlier one was answered, the earlier submitted answers must remain attached to the earlier tool id only and must not prefill or render inside the later card.
- Given a free-text answer such as `version=1.0`, the submitted history card must preserve that text as the answer instead of interpreting `version` as a question id.
- Given a structured AskUserQuestion result marker with answers containing `;` or `=`, normalization must use the structured payload and avoid delimiter-based corruption.
- Given history produced before the structured marker existed, legacy answer and skip strings must still normalize into submitted cards.
- Given focused component and hook tests, close settlement and submit behavior must both pass.

## Impact

- Frontend:
  - `src/features/app/components/RequestUserInputMessage.tsx`
  - `src/features/threads/hooks/useThreadUserInput.ts`
  - `src/features/threads/loaders/claudeHistoryLoader.ts`
  - `src/utils/threadItemsAskUserQuestion.ts`
  - related Vitest suites
- Backend:
  - Reuses existing `respond_to_server_request` / Claude `respond_to_user_input` behavior.
  - Formats Claude AskUserQuestion resume text with a human-readable summary plus structured base64 JSON marker for robust UI normalization.
- Specs:
  - `openspec/specs/codex-chat-canvas-user-input-elicitation/spec.md`
  - `openspec/specs/conversation-fact-contract/spec.md`
