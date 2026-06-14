# Design: Fix Progressive Reveal Runtime Residual 2026-06

## Current State

`resolveProgressiveRevealValue()` computes `pendingText` and uses `findProgressiveRevealBoundary()` to reveal a readable chunk. The current boundary finder creates a slice and then runs 6 regex passes over the same string. This is readable but wasteful on long pending tails because every pass traverses the same candidate window.

Existing protections that MUST remain:

- `pendingText.length <= PROGRESSIVE_REVEAL_SMALL_PENDING_CHARS` returns `targetValue` directly.
- Huge visible + huge pending backlog returns `targetValue` directly.
- Adaptive chunk size grows with visible length and pending length.
- Boundary selection may return a boundary after preferred chars, or the best readable boundary before preferred chars, but never below `PROGRESSIVE_REVEAL_MIN_CHARS` unless falling back to `preferredEnd`.

## Approach

Replace the regex list with one line-oriented scan over `candidateSlice`.

Pseudo flow:

1. Normalize preferred / max chars exactly as today.
2. Compute `searchEnd`, `preferredEnd`, and `candidateSlice`.
3. Scan newline positions once.
4. Classify each newline boundary by the next line:
   - blank line / paragraph gap
   - Markdown heading
   - unordered / ordered list
   - block quote
   - fenced code block
   - plain newline
5. Track the best boundary for each class before `preferredEnd`.
6. Return immediately when the first boundary at or after `preferredEnd` is found, respecting class priority.
7. If no after-preferred boundary exists, return the best before-preferred boundary by priority.
8. Fall back to `preferredEnd`.

The implementation stays local to `LiveMarkdown.tsx`; no exported API change is required.

## Risk

The main risk is changing reveal boundary behavior subtly around Markdown structures. To keep the change safe:

- tests assert that headings, lists, quotes, code fences remain preferred boundaries;
- tests assert short pending still bypasses chunking;
- tests assert long pending still reveals a partial chunk rather than flushing everything.

## Validation

- `npx vitest run src/features/messages/components/LiveMarkdown.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `openspec validate fix-progressive-reveal-runtime-residual-2026-06 --strict`
