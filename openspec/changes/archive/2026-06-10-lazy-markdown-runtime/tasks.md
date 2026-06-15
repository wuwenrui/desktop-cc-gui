# Tasks / 任务

## Planning / 规划

- [x] Audit Markdown import graph and identify full parser dependencies.
- [x] Define lightweight, fallback, and full renderer responsibilities.
- [x] Define complexity triggers and safety constraints.

## Implementation / 实施

- [x] Split `Markdown.tsx` into shell plus lazy full renderer module.
- [x] Route simple live streaming rows through lightweight renderer by default.
- [x] Load full renderer for completed or complex Markdown.
- [x] Preserve `onRenderedValueChange`, progressive reveal, and history/live convergence.
- [x] Ensure raw HTML waits for sanitization-capable renderer.

## Validation / 验证

- [x] Add/adjust live lightweight -> final full renderer tests.
- [x] Add/adjust complex Markdown final rendering tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run check:bundle-chunking` and record markdown chunk startup evidence.
- [x] Run `openspec validate lazy-markdown-runtime --strict --no-interactive`.
