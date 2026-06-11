# lazy-file-preview-dependencies

## Summary / 摘要

把 CodeMirror language extensions、PDF.js / docs preview runtime 从 file panel startup/static path 中拆出，只在对应 file type、edit mode 或 preview mode 激活时加载。find-in-file search module 保持原状（见下“已撤回的优化点 / Withdrawn Optimization”）。

## Problem / 问题

`P0-10` 指出 `FileViewPanel.tsx` 静态导入 CodeMirror types/search/keymap 与 language resolver；`codemirrorLanguageExtensions.ts` 静态导入所有 language packages；`FilePdfPreview.tsx` 静态导入 `pdfjs-dist`。当前 `vendor-codemirror` gzip 约 `302 KB`，`vendor-docs` gzip 约 `394 KB`，`pdf.worker` gzip 约 `369 KB`。

这会让打开 app 或非文件 feature 时过早支付编辑器/PDF/doc 预览成本，也让 image/plain/markdown preview 误带全部语言扩展。

## Goals / 目标

- File panel 拆为 shell + editor renderer + preview renderer lazy boundaries。
- CodeMirror 只在 edit mode 或 text editor surface 需要时加载。
- Language extension resolver 改为 async per-language dynamic imports。
- `pdfjs-dist` 只在 PDF preview path 内加载。
- Image/plain/markdown preview 保持 lightweight，不加载全量 language extensions。

## Non-Goals / 非目标

- 不重写 file editor typing latency；该问题已由 `harden-file-editor-typing-latency` 覆盖。
- 不删除现有 PDF/doc/table preview 能力。
- 不降低 dirty-buffer、external sync、save semantics。
- 不把所有 file preview 迁移到 worker；本 change 聚焦 dependency load timing。

## Approach / 方案

1. Audit file panel import graph and current Vite chunks。
2. 拆分 `FileViewPanel` shell 与 editor/preview runtime。
3. 将 CodeMirror editor runtime 移到 edit/text activation path。
4. 将 language extension resolver 改为 async loader with cache。
5. 将 PDF.js runtime 和 worker init 限定在 PDF preview。
6. 增加 file type switching / initialization race tests。

## Risks / 风险

- Async language loading 可能导致 editor 首次打开短暂 fallback，需要 stable loading state。
- 文件切换时 lazy import race 可能把旧语言/PDF runtime 应用到新文件。
- PDF worker 初始化失败必须显式 fallback，不能留下空白面板。

## Acceptance Criteria / 验收口径

- Opening app or non-file features does not load CodeMirror/PDF chunks。
- Opening image/plain text preview does not load all language extensions。
- Switching file types during lazy load does not apply stale renderer state。
- Bundle evidence shows CodeMirror/PDF/docs dependencies remain lazy from startup path。

## Final Implementation / 最终实现

- `FileViewPanel` / `FileViewBody` 只保留 file panel shell、navigation state、preview dispatch 和 editor activation props，不再 runtime import `@uiw/react-codemirror`、`@codemirror/view` keymap、`@codemirror/search` commands。
- `FileCodeMirrorEditor.tsx` 提供 `React.lazy` boundary；`FileCodeMirrorEditorImpl.tsx` 作为 editor runtime chunk，集中持有 CodeMirror editor、persistent `search({ top: true })`、save keymap、definition/reference keymap、git line markers、annotation widgets 和 navigation flash extension。
- `useFileNavigation` 不再导出 CodeMirror extension；shell 只通过 `FileCodeMirrorEditorHandle` 调用 `openFindPanel()`、`toggleFindPanel()`、`flashNavigationLine()` 和 `clearNavigationFlash()`，避免把 CodeMirror runtime 拉回 startup graph。
- Language extension loader 保持 async per-language dynamic import with cache，并通过 request token 防止 slow loader 在文件切换后污染当前 editor。
- PDF/docs preview runtime 保持在对应 preview activation path；image/plain/markdown preview 不需要 CodeMirror/PDF runtime。

## Evidence / 证据

- `dist/index.html` 不再 `modulepreload` `vendor-codemirror`。
- `npm run check:bundle-chunking` 显示 `vendor-codemirror-*` gzip `296.7 KiB`，由 lazy `FileCodeMirrorEditorImpl-*` edge 引入，不在 app shell startup path。
- 同一轮 evidence 显示 `vendor-docs-*` gzip `384.5 KiB`，仍保持在 docs/PDF preview lazy path。
- 运行通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run check:bundle-chunking`、`openspec validate lazy-file-preview-dependencies --strict --no-interactive`。

## Withdrawn Optimization / 已撤回的优化点

**目标**：将 `@codemirror/search` 设为首次打开 find-in-file 时再 dynamic import。
**结论**：撤回。

**问题**：

- `@codemirror/search` 的 `search({ top: true })` 是一个**状态 extension**，需要跟随当前 editor view 的 `EditorState`。当 shell 在 `useMemo` 中构造它并通过 `extensions` prop 注入时，它与 editor state 的生命周期是耦合的。
- 拆到 lazy 边界后，第一次打开时 dynamic import 还未 resolve，需要先返回 `null` extension，editor view 内的 `openSearchPanel` 就会因 `searchState` field 尚未注册而无法持续进入“搜索+高亮+替换”的工作循环。
- 进一步的 `toggleFindPanelInEditor` / `openFindPanelInEditor` / Mod-f keymap 都需要 `searchState` 同步可用。dynamic import 是异步的，Mod-f 同步 keymap run 路径无法在 import 落定前就完成 toggle；用户连续敲 Cmd+F 时会出现“开了但跳不回原文位置”、“替换模式不同步”、“光标错位”等行为。
- 关键的 replace / replace-all 是基于 `searchState` 的 transactional effect 链，不是简单的 panel 开关；拆出 startup 路径后反而需要重新实现 replace state 与 search query 的同步，原生 extension 的 contiguous navigation 语义就丢了。

**当前做法**：

- `FileCodeMirrorEditorImpl` 继续在 lazy editor chunk 内构造 `search({ top: true })` 并作为 persistent extension 注入；`FileViewPanel` shell 不再 runtime import `@codemirror/search`。
- `FileCodeMirrorEditorImpl` 继续静态 import `openSearchPanel` / `closeSearchPanel` / `searchPanelOpen`，保持 Mod-f keymap / open-find / toggle-find 在 lazy editor chunk 内同步生效；`useFileNavigation` shell hook 不再 runtime import CodeMirror commands。
- 后续如果还需要压缩 `@codemirror/search` 体积，需要在保证 contiguous search / replace 行为的前提下另立 change 重新设计（候选方向：拆出仅 `searchPanelOpen` 状态读取、把 `openSearchPanel` 拉一个 wrapper、避免对 `searchState` field 的 transactional 依赖等），不在这份 change 范围内。

### 复发禁止条款（No-Reintroduction Lockout）

本次撤回必须被视为 **永久** 而不是“之后再试一次”。任何后续 contributor / AI assistant 重新评估 `lazy-file-preview-dependencies` 涉及 `@codemirror/search` 拆出 startup 路径时：

- **必须** 先读 `.trellis/spec/frontend/quality-guidelines.md` 末尾 *CodeMirror State-Coupled Extensions 不可跨越 Lazy Boundary* 章节（Hard Rule）。
- **必须** 在 proposal / design 文件显式回答：本次修改是否触及 state-coupled extension（参考 `openspec/docs/lazy-state-extension-regression-2026-06-11.md` 的触发场景判断标准）？若触及，禁止合入。
- **必须** 在 PR 描述里引用本 change ID（`lazy-file-preview-dependencies`）和回归备忘路径，否则 review 阶段直接拒收。
- 该规则已注册到 `.trellis/spec/frontend/index.md` 的 Pre-Development Checklist，对应章节标题固定为“CodeMirror State-Coupled Extensions 不可跨越 Lazy Boundary”，禁止后续 AI 在不清楚原因的情况下删改。

### 历史回归备忘

- 2026-06-11：本次撤回。
- 失败时引入的代码：`.useFileSearchExtension`（`FileCodeMirrorEditorImpl.tsx`）、`ensureSearchCommandsLoaded`（`useFileNavigation.ts`）、`isFindInFileOpen` / `markFindInFileOpened` props 透传。
- 失败时新增的测试：`findInFile.lazy-search.test.tsx`（已删除）。
- 长期备忘：`openspec/docs/lazy-state-extension-regression-2026-06-11.md`。

## Validation / 验证

- Focused file preview/editor lazy load tests。
- File type switching and stale import race tests。
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run check:bundle-chunking`
- `openspec validate lazy-file-preview-dependencies --strict --no-interactive`
