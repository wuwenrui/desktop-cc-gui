# Split Startup CSS Loading

## Goal

按 OpenSpec change `split-startup-css-loading` 缩小 startup CSS payload，让 `src/bootstrap.ts` 只保留 first-screen shell / shared primitive CSS，把 feature-only CSS 改为 activation-time dynamic CSS import。

## Requirements

- `bootstrap.ts` 保留 first-screen ownership 明确的 CSS：global tokens、base layout、buttons、sidebar shell、home/chat shell、messages/composer、compact shell、toasts、shared panel/status primitives。
- 非首屏 feature CSS 使用 static-analyzable dynamic import：`import("./feature.css")`。
- 每组 CSS 必须能单独回滚：把对应 import 放回 `bootstrap.ts` 或移除 loader 即可。
- 至少移动 file view、diff、runtime console、project map、intent canvas/Excalidraw、settings、release notes、loading progress、SpecHub、Git History、Kanban、Search Palette、Browser Agent、Workspace Home、About、Client Documentation。
- 通过 production build 和 bundle budget gate 记录 `App-*.css` gzip delta。

## Acceptance Criteria

- [x] `App-*.css` gzip 相比 v0.5.9 refreshed baseline 明显下降。
- [x] `npm run build` 通过。
- [x] `npm run check:bundle-chunking` 通过且 `app-css` 为 pass。
- [x] `npm run typecheck` 通过。
- [x] `npm run lint` 通过。
- [x] Manual desktop first-screen visual check。
- [x] Manual compact first-screen visual check。
- [x] Manual first-open styling checks for moved feature surfaces。

## Technical Notes

- 本轮采用 `src/styles/featureStyleLoaders.ts` 集中管理 dynamic CSS import，避免散落字符串和不可分析路径。
- Evidence 包含 build/bundle proxy evidence 和 2026-06-10 user-run manual visual QA；未发现 FOUC 或 first-open 稳态样式问题。
