## 1. OpenSpec Contract

- [x] 1.1 Add proposal/design/spec artifacts for `composer-file-reference-completion-stability`; input: issue `#618` report and current composer file-reference code; output: validated OpenSpec behavior contract; validation: `openspec validate fix-composer-file-reference-at-white-screen --strict --no-interactive`; dependencies: none; priority: P0.

## 2. Composer Completion Hardening

- [x] 2.1 Normalize top-level file and directory source paths in `ChatInputBoxAdapter`; input: `directories` / `files` props; output: blank, malformed, and duplicate paths skipped before completion item creation; validation: focused adapter test; dependencies: 1.1; priority: P0.
- [x] 2.2 Normalize lazy workspace directory-child payloads; input: `getWorkspaceDirectoryChildren(...)` result; output: malformed children skipped while valid children remain searchable; validation: focused adapter test; dependencies: 2.1; priority: P0.
- [x] 2.3 Deduplicate completion item rendering keys before dropdown handoff; input: mixed direct/lazy completion items; output: stable unique item list; validation: focused adapter test asserts duplicates are collapsed; dependencies: 2.1; priority: P0.

## 3. Inline Tag Rendering Resilience

- [x] 3.1 Guard file-tag DOM rewrite and cursor restoration in `useFileTags`; input: current `renderFileTags` flow; output: render exceptions are logged and transient state is reset without app teardown; validation: focused hook test or deterministic guard test; dependencies: 1.1; priority: P0.
- [x] 3.2 Preserve raw editable text when file-tag rendering degrades; input: render failure path; output: composer remains editable for subsequent input; validation: focused hook test; dependencies: 3.1; priority: P0.

## 4. Verification

- [x] 4.1 Run focused Vitest suites for `ChatInputBoxAdapter`, `useFileTags`, and related trigger detection; input: implemented frontend changes; output: passing regression evidence; validation: `npx vitest run src/features/composer/components/ChatInputBox/hooks/useTriggerDetection.test.tsx src/features/composer/components/ChatInputBox/hooks/useFileTags.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx`; dependencies: 2.1, 2.2, 2.3, 3.1; priority: P0.
- [x] 4.2 Run strict OpenSpec validation for the change; input: completed artifacts; output: change validates strictly; validation: `openspec validate fix-composer-file-reference-at-white-screen --strict --no-interactive`; dependencies: 4.1; priority: P0.

## 5. Slash Completion Follow-up

- [x] 5.1 Normalize project custom slash commands in `ChatInputBoxAdapter`; input: `commands` props from project/runtime command discovery; output: malformed command entries skipped before calling `.trim()`/filtering; validation: focused adapter test for `/` provider with invalid entries; dependencies: 4.2; priority: P0.
- [x] 5.2 Normalize SDK/bridge slash command payloads in `slashCommandProvider`; input: mixed callback payloads from `window.updateSlashCommands`; output: invalid entries skipped, duplicates collapsed, local slash commands preserved; validation: focused provider tests; dependencies: 5.1; priority: P0.
- [x] 5.3 Isolate shared completion dropdown item mapping failures; input: provider result arrays and dropdown mapper callbacks; output: single bad item does not crash dropdown and raw item selection remains aligned; validation: focused hook test; dependencies: 5.2; priority: P0.
- [x] 5.4 Run cross-platform-safe focused validation; input: implemented slash hardening; output: passing Vitest/typecheck/OpenSpec evidence with no platform-specific key handling changes; validation: focused Vitest plus `npm run typecheck` and `openspec validate fix-composer-file-reference-at-white-screen --strict --no-interactive`; dependencies: 5.1, 5.2, 5.3; priority: P0.
