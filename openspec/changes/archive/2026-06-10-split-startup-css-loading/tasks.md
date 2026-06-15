# Tasks / 任务

## Planning / 规划

- [x] Inventory `src/bootstrap.ts` 中所有 CSS imports。
- [x] 标注每个 CSS import 的 load class：critical、first-visible-shell、feature-on-demand、heavy-third-party、legacy-global。
- [x] 记录 legacy-global exceptions 的 owner 与 follow-up。

## Implementation / 实施

- [x] `src/bootstrap.ts` 只保留 first-screen critical CSS。
- [x] file view、diff、runtime console、project map styles 移到 file/diff activation path。
- [x] settings、about、release-notes、loading-progress styles 移到 modal/settings activation。
- [x] SpecHub、Git History、Kanban、WorkspaceHome styles 移到 tab activation。
- [x] intent canvas 与 Excalidraw CSS 移到 intent canvas activation。
- [x] browser agent styles 移到 browser agent activation。
- [x] search palette styles 移到 first search open。
- [x] 对可能 FOUC 的 surface 增加 skeleton 或 CSS load guard。

## Validation / 验证

- [x] 运行 `npm run build`。
- [x] 运行 `npm run check:bundle-chunking` 并记录 `App-*.css` gzip delta。
- [x] 手动验证 desktop first screen。
- [x] 手动验证 compact first screen。
- [x] 手动验证被移动 CSS 的 feature first-open styling。
- [x] 运行 `openspec validate split-startup-css-loading --strict --no-interactive`。
