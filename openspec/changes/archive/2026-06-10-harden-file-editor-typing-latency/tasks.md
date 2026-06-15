# Tasks / 任务

## Planning / 规划

- [x] Add roadmap P0 task for file editor typing latency hardening.
- [x] Create OpenSpec change `harden-file-editor-typing-latency`.
- [x] Define initial typing latency budgets and evidence classes.

## Implementation / 实施

- [x] Audit CodeMirror editor integration and identify synchronous work triggered by keystrokes.
- [x] Keep editor document transaction and visible echo local-first.
- [x] Coalesce cursor/selection/line-range publication into delayed/latest-wins global updates.
- [x] Ensure typing does not call Tauri file read/write commands per keystroke.
- [x] Ensure typing does not write transient editor state through `clientStorage` per keystroke.
- [x] Debounce or coalesce autosave, metadata, and preference writers related to editor state.
- [x] Harden `useFileExternalSync` so dirty buffers cannot be overwritten by watcher events.
- [x] Suppress self-save watcher reload/reparse loops using snapshot version, content hash, or equivalent guard.
- [x] Add content-safe typing latency diagnostics and bounded report output.

## Validation / 验证

- [x] Add focused tests for per-keystroke no-IPC/no-storage-write behavior where harness support exists.
- [x] Add regression coverage for dirty-buffer external-change conflict.
- [x] Add regression coverage for self-save watcher event suppression.
- [x] Add large-file edit-mode smoke or measured evidence.
- [x] Run focused file editor tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test` or focused Vitest suites.
- [x] Run `openspec validate harden-file-editor-typing-latency --strict --no-interactive`.
