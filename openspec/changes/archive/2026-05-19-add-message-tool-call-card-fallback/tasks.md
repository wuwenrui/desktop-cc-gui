## 1. Parser Foundation

- [x] 1.1 Create `src/features/messages/utils/toolCallBlocks.ts` exporting `Block`, `ToolCallBlock`, `MarkdownBlock` types and `parseToolCallBlocks(text: string): Block[]`; implement fast path returning `[{kind:'md',content:text}]` only when `text` contains none of `function_calls`, `invoke`, `antml:function_calls`, or `antml:invoke`.
- [x] 1.2 Implement protected-region scanner inside the parser to mask fenced code blocks (``` and ~~~ fences) and inline code spans (`` ` ``) before tag matching, so literal `<function_calls>` inside code is ignored.
- [x] 1.3 Implement paired-block detection for `<function_calls>...</function_calls>`, `<antml:function_calls>...</antml:function_calls>`, bare `<invoke name="...">...</invoke>`, and `<antml:invoke name="...">...</antml:invoke>`; extract `tool` from the first invoke tag and `params` from each prefixed or unprefixed parameter tag.
- [x] 1.4 Implement streaming partial handling: when an opening tag has no matching closing tag and input ends, emit a trailing `{kind:'tool-call', complete:false}` block carrying the remaining raw text.
- [x] 1.5 Add `src/features/messages/utils/toolCallBlocks.test.ts` with ≥ 8 cases: paired/antml-paired/unclosed-streaming/nested-tolerance/plain-text-fast-path/fenced-code-protection/inline-code-protection/multiple-blocks-in-one-message.

## 2. Card Component

- [x] 2.1 Create `src/styles/tool-call-block.css` with `tcb-` namespaced selectors covering collapsed header, expanded parameter list, raw payload code block, streaming pulse, and copy confirmation; import the new sheet from the existing global styles entry alongside other `src/styles/*.css` imports.
- [x] 2.2 Create `src/features/messages/components/ToolCallBlock.tsx` accepting `{raw, tool?, params?, complete, isLive?}`; render collapsed-by-default header with parsed tool name (or i18n unknown-tool placeholder) and one-line preview.
- [x] 2.3 Add expand affordance toggling local state to reveal parameter key/value list and raw payload code block; ensure `aria-expanded` and `role="group"` semantics.
- [x] 2.4 Add copy affordance using `navigator.clipboard.writeText(raw)` with a localized confirmation transient state.
- [x] 2.5 Render streaming indicator (pulsing dot + localized suffix) when `isLive || !complete`; ensure card mounts with a stable React key strategy based on block start offset, tag name, and stable signature rather than growing raw content.
- [x] 2.6 Add `src/features/messages/components/ToolCallBlock.test.tsx` covering: collapsed default render, expand reveals parameters and raw, copy triggers clipboard + confirmation, streaming indicator visibility, unknown-tool fallback, no-parameters fallback.

## 3. Markdown Integration

- [x] 3.1 In `src/features/messages/components/Markdown.tsx`, add a top-level `useMemo` calling `parseToolCallBlocks(content)`; when the result is a single `md` block, take the existing render path with zero changes.
- [x] 3.2 When the parser returns mixed blocks, render `md` segments through the existing `<ReactMarkdown>` subtree (preserving all current plugins, components map, and `liveRenderMode` lightweight branch) and `tool-call` segments through `<ToolCallBlock />`, keyed by a stable parser-provided identity such as `tcb-${startOffset}-${tagName}-${stableHash(initialSignature)}`.
- [x] 3.3 Apply the same segmentation strategy to the `LightweightMarkdown` branch so streaming first-paint also gains the fallback card without modifying `LightweightMarkdown` internals.
- [x] 3.4 Verify no plugin array, sanitize schema, urlTransform, or components map mutation is required; confirm by diff review.

## 4. i18n

- [x] 4.1 Add keys under `messages.toolCallCard.*` in `src/i18n/locales/zh.part1.ts`: `title`, `expand`, `collapse`, `copy`, `copied`, `streaming`, `unknownTool`, `noParams`.
- [x] 4.2 Mirror the same key set with English translations in `src/i18n/locales/en.part1.ts`.
- [x] 4.3 Confirm `npm run test -- src/i18n/locales/chatLocaleMerge.test.ts` (or equivalent locale parity check) stays green to guarantee zh/en key parity.

## 5. Integration Tests

- [x] 5.1 Create `src/features/messages/components/Markdown.tool-call.test.tsx`; feed assistant text equivalent to the failure screenshot (paired XML with command line content) and assert the rendered DOM contains the `tcb-` card with parsed tool name and raw payload, and that no raw `<function_calls>` text remains as user-visible content.
- [x] 5.2 Add an integration scenario asserting that a message mixing markdown headings/lists, fenced code blocks containing literal `<function_calls>` text, KaTeX inline math, and one paired XML block renders the markdown segments unchanged while only the paired block becomes a card.
- [x] 5.3 Add a streaming scenario asserting that a message with an open tag but missing close tag renders a streaming card, and that appending the closing tag in a subsequent render converges to the completed card without losing user expand state for stable raw prefixes.

## 6. Regression & Quality Gates

- [x] 6.1 Run `npx vitest run src/features/messages/` and ensure all existing suites (`Markdown.codeblock-rendering`, `Markdown.file-links`, `Markdown.list-rendering`, `Markdown.math-rendering`, `LiveMarkdown`, `Messages.*`) remain green.
- [x] 6.2 Run `npm run typecheck` and `npm run lint`; fix any new findings without expanding scope.
- [x] 6.3 Run `openspec validate add-message-tool-call-card-fallback --strict` and `openspec validate --all --strict --no-interactive`.
- [ ] 6.4 Manually verify on a live subagent thread that the screenshot scenario now renders as a card with expand/copy working; capture before/after screenshot for the PR description.

## 7. Spec & Archive Readiness

- [x] 7.1 Update `openspec/changes/add-message-tool-call-card-fallback/tasks.md` checkboxes as work completes (do not batch).
- [x] 7.2 Prepare archive plan note: this change adds a new spec `message-assistant-tool-call-card-fallback` with no Modified Capabilities, so archive will sync the new spec into `openspec/specs/` without delta merges.

## Archive Plan Note

This change adds the new capability spec `message-assistant-tool-call-card-fallback` only. It does not modify existing capabilities, so archive should sync the new spec into `openspec/specs/message-assistant-tool-call-card-fallback/spec.md` without resolving delta merges.
