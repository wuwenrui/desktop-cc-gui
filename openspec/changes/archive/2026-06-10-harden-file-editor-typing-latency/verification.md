# Verification / 验证

## Evidence Class / 证据级别

- File editor typing latency evidence in this implementation is `proxy`.
- 这些测试证明 no per-keystroke Tauri write / `clientStorage` write、dirty buffer protection、self-save watcher suppression 与 large-file edit-mode smoke。
- 未采集 browser/Tauri WebView `visible echo P95`、React Profiler 或 PerformanceObserver 数据，因此不能声称 release-grade measured latency improvement。

## Commands / 命令

```bash
npx vitest run src/features/files/components/FileViewPanel.typing-latency.test.tsx src/features/files/hooks/useFileDocumentState.test.tsx src/features/files/hooks/useFileExternalSync.test.tsx src/features/files/utils/fileEditorTypingDiagnostics.test.ts
npx vitest run src/features/files/components/FileViewPanel.test.tsx src/features/files/components/FileViewPanel.external-change.test.tsx
npm run typecheck
npm run lint
openspec validate harden-file-editor-typing-latency --strict --no-interactive
```

## Results / 结果

- Affected focused Vitest suites: passed, 89 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `openspec validate harden-file-editor-typing-latency --strict --no-interactive`: passed.

## Notes / 说明

- `FileViewBody` now keeps CodeMirror typing local-first and publishes parent `documentSnapshot` through a 120ms latest-wins debounce.
- `FileViewPanel` flushes the latest editor draft before explicit save and before switching to preview mode.
- `useFileDocumentState.handleSave()` reads `latestContentRef` so a just-flushed draft can be saved without waiting for a React rerender.
- `useFileExternalSync` dirty protection and self-save suppression are covered by focused regression tests.
