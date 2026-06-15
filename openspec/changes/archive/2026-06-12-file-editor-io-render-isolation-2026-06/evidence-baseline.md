## Evidence Baseline

Current baseline before human acceptance testing.

| Interaction | Evidence class | Current evidence | Notes |
|---|---|---|---|
| File open | proxy | `fileInteractionEvidenceGate` validates stage fields: read, snapshot-ready, first-useful-viewport, heavy-preview | Runtime WebView timing is not yet measured in a real app session. |
| Tab activation | proxy | `FileViewPanel.typing-latency.test.tsx` verifies cached clean snapshot reuse and dirty draft retention | This proves no default re-read in React tests; human test must confirm perceived tab switch latency. |
| Typing | proxy | `FileViewPanel.typing-latency.test.tsx` verifies local-first typing without per-keystroke Tauri/clientStorage writes; `FileViewBody` no longer calls React `setEditorContent` for every keystroke | Real WebView long-task evidence is not yet collected. |
| Line change | proxy | `FileViewPanel.test.tsx` verifies cursor/selection changes stay editor-local until debounce, then publish latest line range; stale publish after file switch is dropped | Human test must confirm cursor movement feels lighter. |
| Git markers / preview stale work | proxy | `FileViewPanel.test.tsx` and `useFilePreviewPayload.test.tsx` verify stale async work does not overwrite current file state | Runtime timing still classified as proxy. |
| Realtime pressure | proxy | `fileSurfaceRuntimeBoundaryGuard.test.ts` verifies file surfaces do not accept `threadStatusById` / conversation reducer state | AppShell still computes active pressure from active thread status; broad Sidebar selectorization remains a follow-up candidate if human test still shows pressure. |
| User perceived lag | manual-only | 2026-06-13 user acceptance: "有重大改善" after file open / editing / cursor movement recheck | No runtime long-task trace collected yet; acceptance is manual-only. |
| Native filesystem IO latency | unsupported | No Rust/Tauri IO timing evidence added in this change | Do not open a backend cache proposal in this closeout; only revisit if follow-up evidence points at raw file read or file tree polling. |

## 2026-06-13 Hot Path Recheck

用户反馈“文件已打开后，在 edit mode 随机点行、输入仍有延迟”。代码复核后判定：这不是单纯文件读取问题，主要 remaining risk 在 renderer hot path。

- Typing path before fix: CodeMirror `onChange` -> `FileViewBody.handleEditorContentChange` -> `setEditorContent(nextContent)` per keystroke -> `FileViewBody` render。父级 publish 虽已 debounce，但局部 React render 仍在每字符发生。
- Typing path after fix: CodeMirror owns immediate typed content; React document snapshot only receives debounced/explicit publish. Save still flushes `editorDraftContentRef` before write.
- Line click path before fix: CodeMirror `onUpdate(selectionSet)` -> `FileViewPanel.handleEditorLineRangeChange` -> local line range React state update immediately -> delayed Composer/global publish。
- Line click path after fix: selection updates editor-local refs immediately; React line label and Composer/global publish are both latest-only debounced.
- Background IO note: workspace file tree polling and external file monitoring can still add noise, but ordinary cursor movement does not directly trigger file-system reads or code-intel requests.

## 2026-06-13 Acceptance Closeout

用户复测反馈：“有重大改善”。本轮 closeout 判定：

- File open / tab switch / typing / line click 的体感改善来自 renderer hot path 拆离，而不是 backend IO cache。
- 本轮证据不支持继续扩大到 Rust/Tauri file IO cache；该方向保留为后续独立提案，触发条件是 runtime evidence 指向 raw file read、file tree polling 或 native command backlog。
- 当前 closeout 仍明确保留证据等级：automated proxy + manual-only acceptance，未宣称 measured WebView long-task 数据。
