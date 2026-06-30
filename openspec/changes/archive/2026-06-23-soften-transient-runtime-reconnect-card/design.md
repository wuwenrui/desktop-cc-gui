## Context

`Messages` locates the latest assistant message that looks like a runtime reconnect diagnostic and renders `RuntimeReconnectCard` for that row. The card currently treats all `[RUNTIME_ENDED]` diagnostics as blocking runtime loss. During managed runtime cleanup (`stale_reuse_cleanup`, `internal_replacement`), the backend may still auto-recover and later stream usable output, but the UI briefly presents a high-severity recovery card in the live canvas.

## Goals / Non-Goals

**Goals:**

- Keep runtime diagnostics visible without over-stating transient cleanup as a blocking failure.
- Preserve existing manual reconnect / resend affordances.
- Keep assistant message text readable for transient cleanup diagnostics.
- Limit the implementation to frontend UI classification and rendering.

**Non-Goals:**

- No backend `runtime/ended` payload changes.
- No runtime lifecycle ownership or settlement changes.
- No assistant-completion-based terminal inference.
- No new dependencies.

## Decisions

1. Add UI-only tone to `RuntimeReconnectHint`
   - Use `tone: "blocking" | "transient"`.
   - `blocking` remains the default to preserve existing behavior.
   - `transient` applies only to runtime-ended diagnostics that contain expected managed cleanup sources such as `stale_reuse_cleanup` or `internal_replacement`.
   - Alternative considered: suppress transient diagnostics entirely. Rejected because diagnostics are still useful and should remain visible.

2. Render transient diagnostics as lightweight notice
   - Use the same component to avoid duplicating recovery behavior.
   - Add CSS class modifier for quieter spacing, thin notice border, low-emphasis background, muted copy, and optional detail handling.
   - Use theme tokens such as `--surface-card`, `--surface-hover`, `--border-subtle`, `--text-secondary`, and `--text-muted` so light / dark / system themes and Windows WebView2 light surfaces inherit existing platform tuning.
   - Copy should describe `Runtime 切换中` and automatic continuation, not a connection failure.
   - Hide raw diagnostic details for transient cleanup notices because the user-facing state is recoverable and the raw `[RUNTIME_ENDED]` text creates duplicate failure copy. Blocking recovery and thread recovery cards keep diagnostic details.
   - Preserve existing buttons so user-initiated recovery remains available if auto-recovery does not converge.
   - Alternative considered: create a separate component. Rejected because it would duplicate action handling without changing behavior.
   - Alternative considered: hide the buttons for transient cleanup. Rejected because it would change the interaction contract and remove manual fallback.

3. Keep backend and lifecycle untouched
   - The UI does not reinterpret terminal authority.
   - The UI only changes visual severity for known cleanup diagnostics.
   - Alternative considered: adjust `runtime/ended` routing to not call `onTurnError` for cleanup sources. Rejected because that would change behavior and may hide legitimate owner-gated terminal evidence.

4. Scope the card to the active assistant diagnostic
   - `Messages` should only render `RuntimeReconnectCard` when the latest assistant message is itself a runtime reconnect diagnostic.
   - User follow-up messages do not clear the card because they do not prove assistant recovery; the latest assistant message remains the diagnostic.
   - A newer normal assistant reply clears the card and suppresses the stale diagnostic row, because the visible conversation has moved past the recoverable interruption.
   - Alternative considered: keep scanning backward for the latest diagnostic. Rejected because it allows stale recoverable errors to keep presenting as current failures after output resumes.

## Risks / Trade-offs

- [Risk] A truly blocking failure may include `stale_reuse_cleanup` in text.
  - Mitigation: keep reconnect/resend actions available and only reduce visual severity, not functionality.
- [Risk] Raw diagnostic detail for transient cleanup becomes less visible.
  - Mitigation: only suppress it in the user-facing transient notice; blocking failures still render diagnostic detail, and runtime logs/events remain the debugging source.
- [Risk] Lightweight styling could lose contrast in one theme.
  - Mitigation: reuse existing theme variables instead of platform-specific colors; validate light / dark / system token coverage and Windows light overrides.
- [Risk] Hiding stale diagnostics could reduce transcript-level debugging context.
  - Mitigation: only hide them after a newer assistant reply exists; active diagnostics and runtime logs remain available for recovery and debugging.
- [Risk] Tests could overfit translation keys.
  - Mitigation: focused tests assert role/card presence and raw diagnostic behavior using existing i18n test style.

## Migration Plan

No migration required. This is a frontend-only presentation change.

Rollback: revert the UI-only tone classification and CSS modifier; backend state remains unaffected.

## Open Questions

- None for this change. Broader runtime diagnostic taxonomy can be handled separately if more shutdown sources need distinct visual severity.
