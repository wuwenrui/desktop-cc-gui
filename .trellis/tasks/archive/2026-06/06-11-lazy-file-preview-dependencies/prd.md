# Lazy File Preview Dependencies

## Goal

推进 OpenSpec change `lazy-file-preview-dependencies`，继续把文件预览/编辑相关重依赖从非必要路径中拆出。

## Requirements

- 优先完成 `@codemirror/search` 首次 find-in-file 时再加载。
- 保持现有 find-in-file 行为：打开、关闭、状态判断、快捷键不回退。
- 加载期间不能崩；如果 search runtime 尚未就绪，应安全降级或延后执行。
- 保留已有 language extension async loader 和 PDF lazy boundary 行为。
- 不夹带重写整个 FileViewPanel 架构，除非必要。

## Acceptance Criteria

- [ ] `FileViewPanel.tsx` 不再静态 import `search` from `@codemirror/search`。
- [ ] `useFileNavigation.ts` 不再静态 import `closeSearchPanel` / `openSearchPanel` / `searchPanelOpen` from `@codemirror/search`。
- [ ] find-in-file first use lazy-loads search runtime with cache。
- [ ] focused FileViewPanel/find tests pass。
- [x] `npm run typecheck` passes。
- [x] `npm run lint` passes。
- [x] `npm run build` passes。
- [x] `npm run check:bundle-chunking` passes。
- [x] `openspec validate lazy-file-preview-dependencies --strict --no-interactive` passes。

## Technical Notes

- `FileViewPanel` 本身已通过 `useLayoutNodes.tsx` lazy import，但 inside panel 仍有 CodeMirror/search eager imports。
- search lazy 小切片已回滚：现有 CodeMirror search interaction 依赖 `search({ top: true })` 常驻 extension；直接改成 first-use lazy 会导致搜索面板位置和 next/replace 行为回退。
- 后续若继续做 search lazy，必须先保持 CodeMirror 原生 search panel contract，再拆打包边界。
