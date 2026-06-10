# harden-realtime-composer-status-panel-performance

## Summary

Harden realtime conversation performance by keeping bottom status-panel summary derivation out of the Composer input hot path during active streaming.

## Problem

During Codex realtime conversations, typing in the Composer can occasionally stall, especially when multiple realtime sessions are running in parallel.

The recent input responsiveness work protected `Composer` and `ChatInputBoxAdapter` with deferred values and structural memoization, but `useLayoutNodes` still computed bottom status-panel activity from the hottest `activeItems` stream source. Each realtime delta could therefore force parent-level status summary derivation before the input subtree got a chance to stay responsive.

This is amplified in multi-session realtime runs because status summary derivation can inspect `itemsByThread` and thread relationship candidates, not only the currently visible text row.

## Goals

- Keep Composer draft text, selection, IME composition, attachments, and send payload behavior unchanged.
- Use deferred conversation items for bottom status-panel summary while a thread is processing.
- Avoid unnecessary `useStatusPanelData` recomputation caused only by wrapper-object identity churn.
- Preserve eventual status-panel convergence after streaming settles.

## Non-Goals

- Do not redesign runtime event settlement.
- Do not change backend event payloads.
- Do not change message rendering or Markdown streaming behavior.
- Do not solve all possible "completed then loading again" cases in this change.

## Approach

1. In `useLayoutNodes`, derive a `statusPanelItems` input from `useDeferredValue(options.activeItems)` while `options.isProcessing` is true.
2. Feed `statusPanelItems` into the bottom status-panel summary and dock panel instead of the live `options.activeItems` source.
3. In `useStatusPanelData`, replace broad `projectionInputs` object dependency usage with explicit field dependencies for scoped tool entry derivation and subagent projection.
4. Keep final state convergence natural by falling back to canonical `options.activeItems` when processing ends.

## Risks

- Status-panel counts can lag behind the newest realtime delta while a turn is processing.
- If a user relies on status-panel updates as the primary live surface, the panel may feel slightly less immediate during heavy streaming.

These trade-offs are intentional because Composer input responsiveness is the primary interaction path during realtime conversations.

## Validation

Suggested focused checks:

- `npm run test -- src/features/status-panel`
- `npm run test -- src/features/composer`
- Manual: run 2-3 parallel Codex realtime sessions and type continuously in the active Composer.

