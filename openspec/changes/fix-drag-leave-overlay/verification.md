# Verification

## Passed

- `npx vitest run src/features/composer/components/ChatInputBox/hooks/usePasteAndDrop.test.ts src/features/workspaces/hooks/useWorkspaceDropZone.test.ts` — 23/23 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml forwarded_leave_drag_payload_serializes_without_position` — 1/1 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — completed 662 test files.
- `git diff --check` — passed.

## Not Run

- `openspec validate fix-drag-leave-overlay --strict --no-interactive` — local `openspec` executable is not installed or available on PATH; `npm view @openspec/cli version` also returned 404.
