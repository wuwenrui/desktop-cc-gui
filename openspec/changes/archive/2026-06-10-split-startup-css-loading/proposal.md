# split-startup-css-loading

## Summary / 摘要

缩小 startup CSS payload：`src/bootstrap.ts` 只保留 first-screen critical CSS，file preview、settings、SpecHub、Git History、Kanban、Search Palette、Intent Canvas、Browser Agent 等 feature-only styles 移到 feature activation path。

## Problem / 问题

roadmap 指出 `src/bootstrap.ts` 当前导入 60+ global CSS files，其中包含大量非首屏 surface：file view、diff viewer、runtime console、Excalidraw、SpecHub、settings、Kanban、git history、browser agent、workspace home、search palette。它们不需要在 first render 前加载，却会进入 startup CSS chunk。

当前 roadmap snapshot 中 `App-*.css` gzip 约 `269 KB`。这会带来两个问题：

- cold startup 过早支付 inactive surfaces 的 parse/style cost；
- 新 feature CSS 容易继续被加进 bootstrap，缺少 ownership 和 load timing review。

## Goals / 目标

- 定义 first-screen CSS contract。
- `bootstrap.ts` 只保留 app shell、sidebar shell、main layout、minimal messages、minimal composer、base tokens、shared primitives。
- feature-only CSS 由 feature entry 或 activation loader 负责加载。
- 延迟加载 Excalidraw、file/diff、SpecHub、Git History、Kanban、Settings、Browser Agent、Search Palette styles。
- 保持 desktop 与 compact layout 的 first-screen visual parity。
- 与 `bundle budget` gate 联动，记录 `App-*.css` gzip delta。

## Non-Goals / 非目标

- 不重做视觉设计，不重命名大量 class names。
- 不在没有 coverage evidence 的情况下删除 selectors。
- 不把全仓迁移到 CSS Modules。
- 不改变 feature behavior 或 route ownership，只调整 style load timing。

## Approach / 方案

1. Inventory `src/bootstrap.ts` 中所有 CSS imports。
2. 为每个 stylesheet 标注 `critical`、`first-visible-shell`、`feature-on-demand`、`heavy-third-party` 或 `legacy-global`。
3. `bootstrap.ts` 只保留 first-screen contract 需要的 CSS。
4. file view / diff / runtime console / project map styles 移到 panel activation。
5. settings / about / release notes / loading progress styles 移到 modal 或 settings activation。
6. SpecHub / Git History / Kanban / WorkspaceHome styles 移到 tab activation。
7. Intent Canvas 与 Excalidraw CSS 移到 intent canvas activation。
8. Browser Agent 与 Search Palette styles 移到 first-open path。
9. 对可能出现 FOUC 的 surface 增加 feature-level skeleton 或等待 CSS loaded 后展示详细内容。

## Risks / 风险

- lazy CSS 可能造成 first-open flash of unstyled content，需要 skeleton 或 load guard。
- 部分 selectors 可能被多个 feature 隐式共享，inventory 时不能误判为 feature-only。
- dynamic CSS import 会改变 Vite chunk output，需要通过 production build 验证。

## Acceptance Criteria / 验收口径

- `App-*.css` gzip 相比 refreshed baseline 有可测下降。
- first screen 在 desktop 与 compact layout 不出现 visual regression。
- moved feature surfaces first-open 不出现稳定态 unstyled panel。
- `bootstrap.ts` 中剩余 CSS import 都有 first-screen ownership reason。

## Validation / 验证

- `npm run build`
- `npm run check:bundle-chunking`
- Manual desktop first-screen visual check。
- Manual compact first-screen visual check。
- Manual first-open checks: file panel、settings、SpecHub/Git History/Kanban、search palette、intent canvas。
- `openspec validate split-startup-css-loading --strict --no-interactive`
