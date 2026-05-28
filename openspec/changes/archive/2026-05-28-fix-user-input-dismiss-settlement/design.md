## Context

The chat canvas renders live `RequestUserInput` cards through `RequestUserInputMessage`. The UX needs two separate actions:

- X/收起: presentation-only local collapse into a compact actionable bar.
- 跳过并继续: runtime-visible empty-answer settlement through `respond_to_server_request`.

Claude already supports an empty-answer response: `format_ask_user_answer` turns an empty answer payload into a user-readable dismissed message and resumes the turn. The missing piece is that the production live-card close button does not call that path.

## Goals / Non-Goals

**Goals:**

- Make the explicit skip action on an actionable live user-input card settle the request through the existing response IPC.
- Keep X/收起 as a local collapse affordance.
- Keep collapsed pending requests visible enough to expand or skip.
- Keep timeout settlement failures visible and retryable.
- Keep stale timeout/disconnected cleanup non-fatal.
- Keep normal answer submission and submitted audit items unchanged.
- Preserve partial answers when the user skips later questions.
- Keep submitted history cards bound to the originating AskUserQuestion tool id and question id.
- Keep old transcript compatibility while avoiding delimiter parsing failures for new data.
- Keep the implementation narrowly scoped to the production live-card path and its hook.

**Non-Goals:**

- Do not add a new backend command.
- Do not redesign the entire request card UI.
- Do not change approval request behavior.
- Do not rewrite history hydration beyond preventing currently closed requests from staying actionable through the live queue.

## Decisions

### Decision: Use empty-answer settlement for explicit skip

The “跳过并继续” action will reuse `handleUserInputSubmit(request, { answers: {} })` through a dedicated dismiss-settlement wrapper instead of dispatching `removeUserInputRequest` directly.

Rationale:

- It uses the same `respond_to_server_request` contract as normal submit.
- Claude backend already formats empty answers as a dismissed AskUserQuestion response.
- Codex core already treats `{ answers }` as the user-input response shape.
- It avoids a new IPC or backend migration.

Alternative considered: add a new explicit `cancel_user_input_request` command. This is semantically cleaner but larger than necessary for the current bug and would require backend support across engines.

### Decision: Keep X/收起 local

The top-right X remains a local collapse action. It does not call the runtime and does not settle request facts.

Rationale:

- X buttons are widely understood as presentation dismissal, not durable runtime answers.
- Users can reduce visual weight without accidentally resuming the agent.
- The explicit skip button carries the destructive/resumptive semantics.

### Decision: Collapsed pending requests stay actionable

Collapsed requests render a compact bar with the request title, countdown, “展开”, and “跳过并继续”.

Rationale:

- A pending runtime request is still a blocker until settled.
- Hiding the only action surface would turn an explicit blocker into an invisible blocker.
- Keeping skip available preserves liveness without forcing the full card to stay open.

### Decision: Do not add submitted audit item for empty skip

Normal submit continues to insert a `requestUserInputSubmitted` audit item. Skip settlement should only remove the live pending request.

Rationale:

- Empty skip is not a meaningful answer.
- The backend/runtime transcript already receives the dismissed signal.
- Avoid adding noisy synthetic cards for users who simply skip an obsolete prompt.

Alternative considered: always write a local “dismissed” audit item. This improves local visibility but risks duplicate/noisy records during history replay.

### Decision: Preserve partial answers on later-question skip

When the user skips from a later step, the live card submits the collected previous answers plus `skippedQuestionIds` for the active and remaining questions.

Rationale:

- A skip action should only affect the current AskUserQuestion interaction, not erase earlier choices in the same card.
- Claude receives enough context to continue without asking the skipped questions again.
- The UI can render a submitted card that shows answered questions as selected and skipped questions as empty.

### Decision: Bind submitted cards by tool id and question id

AskUserQuestion normalization first pairs an answer echo with the pending originating AskUserQuestion tool id, then maps each answer by question id when structured/keyed data is available. Positional fallback remains only for older transcript strings.

Rationale:

- Multiple AskUserQuestion prompts may appear in one thread, and prior answers must not drift into a later prompt.
- Question order can be ambiguous when the user skips earlier or later questions.
- Tool-id and question-id binding makes the submitted card deterministic and keeps unrelated future prompts clean.

### Decision: Add structured result marker for new Claude answer echoes

Claude resume text remains human-readable, but new answer echoes append `AskUserQuestionResultBase64:<json>` containing the answer map and skipped ids. Frontend normalizers prefer the structured marker and fall back to legacy English text parsing only when the marker is absent.

Rationale:

- Delimiter text such as `style=...; language=...` is not robust when answers themselves contain `=` or `;`.
- Base64 JSON keeps the marker compact and avoids escaping collisions in the surrounding user-readable text.
- Existing history stays readable and compatible through the legacy fallback.

Rejected alternative: continue extending the text parser with more separator heuristics. This would keep accumulating edge cases and can still misparse free text like `version=1.0`.

### Decision: Preserve stale fallback behavior

If the runtime says the request is unknown, timed out, or disconnected, the frontend removes the request locally and does not fail the UI. If auto-timeout settlement fails for a non-stale reason, the card remains visible or is restored so the user can retry.

Rationale:

- The request is no longer actionable.
- Current stale-submit handling already follows this principle.
- This avoids reintroducing the exact stale-card residue the change is fixing.

## Risks / Trade-offs

- [Risk] Locally collapsed cards still represent pending runtime requests. → Mitigation: collapsed state renders a compact bar with “展开” and “跳过并继续”; timeout cleanup still settles stale cards.
- [Risk] Empty-answer settlement can resume the agent rather than fully stop it. → Mitigation: this matches existing backend semantics and fixes the current mismatch; full turn cancellation remains a separate product decision.
- [Risk] Remote backend may interpret empty answers differently. → Mitigation: use the existing response contract and keep tests focused on frontend behavior; remote parity can be validated separately if needed.
- [Risk] Raw answer text may contain parser delimiters. → Mitigation: new echoes include the structured result marker; legacy parser only treats `key=value` as keyed when `key` matches the originating question id.
- [Risk] History normalization may become expensive on long threads. → Mitigation: parsing stays linear in conversation items and answer text length, runs during history/echo normalization, and does not add React render-time full-history scans.

## Migration Plan

1. Update frontend dismiss hook to settle via empty-answer response.
2. Split card UI into local collapse and explicit skip actions.
3. Add compact collapsed request surface with expand and skip controls.
4. Update card tests to assert collapse is local, collapsed requests remain actionable, and skip is settlement.
5. Update hook/tests to cover empty-answer dismiss success, stale fallback, and timeout settlement failure.
6. Add partial-answer + skip support with `skippedQuestionIds`.
7. Complete the originating `askuserquestion` tool row locally after settlement so the UI does not remain stuck in running state.
8. Add structured AskUserQuestion result marker parsing, keyed question-id mapping, and legacy fallback tests for free-text `=` / `;`.
9. Run focused Vitest suites, Rust AskUserQuestion tests, lint, typecheck, and OpenSpec validation.

Rollback: revert the hook/component test changes and this OpenSpec change. No persisted schema or dependency migration is introduced.

## Open Questions

- Should a future UX pass split the affordance into “收起” and “跳过并继续 / 结束本轮”? This change intentionally fixes the current misleading close path first.
