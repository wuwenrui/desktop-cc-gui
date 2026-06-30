## Tasks

- [x] 1.1 [P0][depends:none][I: observed MiniMax Codex jsonl session][O: root cause documented in proposal/design][V: proposal references `exec_command` heredoc replay gap] Record investigation.
- [x] 1.2 [P0][depends:1.1][I: `conversation-tool-card-persistence`][O: spec delta for shell-backed Codex mutation replay][V: OpenSpec strict validation] Write spec delta.
- [x] 2.1 [P0][depends:1.1][I: `src/utils/threadItemsFileChanges.ts`][O: export narrow command-text mutation inference helper][V: converter regression tests] Add helper.
- [x] 2.2 [P0][depends:2.1][I: `src/utils/threadItems.ts`][O: successful non-`apply_patch` shell mutations convert to `fileChange`][V: heredoc write test] Update converter.
- [x] 2.3 [P0][depends:2.2][I: temp patch artifact commands][O: `.diff` / `.patch` artifact-only writes remain command cards][V: existing patch-text-only regression stays passing] Preserve safety boundary.
- [x] 3.1 [P0][depends:2.x][I: Codex local session replay fixture][O: `exec_command` heredoc write reconstructs as `File changes`][V: `historyLoaders.test.ts`] Add history replay regression.
- [x] 3.2 [P0][depends:3.1][I: focused Vitest][O: related tests pass][V: `npx vitest run src/utils/threadItems.test.ts src/utils/threadItemsFileChanges.test.ts src/features/threads/loaders/historyLoaders.test.ts`] Validate implementation.
