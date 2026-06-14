# Tasks: Fix Progressive Reveal Runtime Residual 2026-06

## 1. OpenSpec

- [x] 1.1 Create proposal/design/spec/tasks for P1 progressive reveal only.
- [x] 1.2 Validate change with `openspec validate fix-progressive-reveal-runtime-residual-2026-06 --strict`.

## 2. Implementation

- [x] 2.1 Replace multi-regex `findProgressiveRevealBoundary()` with a single newline scan.
- [x] 2.2 Preserve short pending flush and extreme backlog flush behavior.
- [x] 2.3 Preserve readable Markdown boundary priority.

## 3. Tests

- [x] 3.1 Add regression for short pending direct flush.
- [x] 3.2 Add regression for structural boundary preference.
- [x] 3.3 Add regression for long pending partial reveal.
- [x] 3.4 Run `npx vitest run src/features/messages/components/LiveMarkdown.test.tsx`.

## 4. Docs And Gate

- [x] 4.1 Update `docs/perf/jank-fix-progress.md` stage 3.
- [x] 4.2 Run `npm run typecheck`.
- [x] 4.3 Run `npm run lint`.
