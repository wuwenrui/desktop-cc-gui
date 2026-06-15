# Harden File Editor Typing Latency

## Goal

按 OpenSpec change `harden-file-editor-typing-latency` 实施 P0 file editor typing latency hardening，让已经打开的 editable text file 在 CodeMirror 中输入时保持 local-first，不把每次 keystroke 放大成 app-wide React state publication、Tauri IO 或 `clientStorage` write。

## Requirements

- CodeMirror document transaction 和 visible echo 先在 editor-local state 完成。
- Parent `documentSnapshot` publication 必须 delayed/latest-wins，避免每个 keystroke 触发 preview、active anchor、global file reference 等派生计算。
- Explicit save 必须先 flush 最新 editor draft，再调用 Tauri write，不能丢失 debounce window 内的内容。
- Typing window 内不得出现 per-keystroke Tauri file read/write、FS write 或 `clientStorage` write。
- Dirty buffer 遇到 external watcher/polling event 时必须保留 local draft，并进入 conflict/pending path。
- Self-save watcher feedback 不得触发 redundant full reload/reparse 或 external overwrite conflict。
- Evidence/diagnostics 必须 content-safe，不记录 file content、diff、prompt、assistant output 或 terminal output。

## Acceptance Criteria

- [ ] 在 editor 中连续输入多次，只更新 editor-local content；parent document publication 被 debounce/coalesce。
- [ ] Save shortcut/button 能写入 debounce window 内最新内容。
- [ ] Focused test 覆盖 typing 不调用 `writeWorkspaceFile`、`writeExternalSpecFile` 或 `clientStorage` write。
- [ ] Focused test 覆盖 dirty buffer external-change conflict。
- [ ] Focused test 覆盖 self-save watcher event suppression。
- [ ] OpenSpec task checklist 与 `verification.md` 记录已执行命令和剩余手测限制。

## Technical Notes

- 采用 feature-local utility 和 hooks/components 内最小改动，不引入 worker 或 editor architecture rewrite。
- Proxy evidence 可以证明 no per-keystroke side effect contract，但不能声明 release-grade measured latency improvement。
