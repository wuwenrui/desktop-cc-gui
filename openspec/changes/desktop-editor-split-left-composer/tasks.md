## 1. Contract And Layout

- [x] 1.1 Add OpenSpec proposal/spec/design artifacts for `desktop-editor-split-layout`; input: approved desktop split requirement; output: validated change artifacts; validation: `openspec validate desktop-editor-split-left-composer --strict --no-interactive`; priority: P0; dependencies: none.
- [x] 1.2 Update `DesktopLayout` so non-maximized editor split renders composer inside the chat layer; input: existing `messagesNode`/`composerNode`; output: single composer mount in conversation column; validation: focused Vitest; priority: P0; dependencies: 1.1.
- [x] 1.3 Update desktop split CSS so the chat layer is a vertical stack and editor side remains full-height; input: `.content.is-editor-split-*`; output: messages grow above composer in the left column; validation: focused Vitest plus lint/typecheck; priority: P0; dependencies: 1.2.
- [x] 1.4 Update workspace file open so desktop editor opens request sidebar collapse, horizontal split, and non-maximized file state; input: `handleOpenFile`; output: side-by-side editor default from workspace file surfaces; validation: focused hook test; priority: P0; dependencies: 1.1.
- [x] 1.5 Update composer send/queue wrappers so submitting a message preserves desktop editor split; input: `handleComposerSendWithEditorFallback` and `handleComposerQueueWithEditorFallback`; output: no implicit `centerMode` fallback on submit; validation: targeted ESLint/typecheck; priority: P0; dependencies: 1.2.

## 2. Verification

- [x] 2.1 Add regression tests for horizontal editor split, maximized editor, and normal chat composer placement; input: `DesktopLayout.test.tsx`; output: DOM ancestry assertions; validation: `npx vitest run src/features/layout/components/DesktopLayout.test.tsx --maxWorkers 1 --minWorkers 1`; priority: P0; dependencies: 1.2.
- [x] 2.2 Add regression tests for desktop file open layout request and compact no-op behavior; input: `useGitPanelController.test.tsx`; output: callback invocation assertions; validation: focused Vitest; priority: P0; dependencies: 1.4.
- [x] 2.3 Run focused validation and update tasks; input: changed files; output: passing test/lint/typecheck/OpenSpec evidence; validation: focused Vitest, targeted ESLint, `npm run typecheck`, `openspec validate`; priority: P0; dependencies: 1.3, 1.4, 1.5, 2.1, and 2.2.
