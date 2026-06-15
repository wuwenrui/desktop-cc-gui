# Verification / 验证

## Evidence Class / 证据级别

- CSS payload reduction evidence is `measured` for production build artifact size.
- Visual first-screen / first-open styling evidence remains `manual-only` and has not been executed in this run.

## Commands / 命令

```bash
npm run typecheck
npm run lint
npm run build
npm run check:bundle-chunking
```

## Results / 结果

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run check:bundle-chunking`: passed.
- `App-*.css`: `135.38 KiB gzip` in the latest production build output.
- Refreshed baseline reference before this change: `App-*.css` about `269 KiB gzip`.
- Bundle gate `app-css`: `pass`, `132.2 KiB gzip` against target `175.8 KiB` and hard-fail `214.8 KiB`.
- 2026-06-10 rerun: `openspec validate split-startup-css-loading --strict --no-interactive` passed.

## Moved CSS Groups / 已移动 CSS 组

- file surfaces: `file-tree.css`, `file-view-panel-shell.css`, `file-view-panel.css`, `file-view-panel.footer.css`, `detached-file-explorer.css`
- diff surfaces: `review-inline.css`, `diff.css`, `diff-viewer.css`
- feature panels: `runtime-console.css`, `project-map.css`, `workspace-home.css`
- canvas/browser: `@excalidraw/excalidraw/index.css`, `intent-canvas.css`, `browser-agent-window.css`
- modal/settings/search/spec/task boards: `settings.css`, `release-notes.css`, `loading-progress-modal.css`, `search-palette.css`, `spec-hub-header.css`, `spec-hub.css`, `spec-hub.reader-layout.css`, `git-history.css`, `kanban.css`
- detached/lazy windows: `about.css`, `client-documentation.css`

## Manual Checks Pending / 待人工验证

## Manual QA / 人工验证

- 2026-06-10 user-run desktop first-screen visual check passed.
- 2026-06-10 user-run compact first-screen visual check passed.
- 2026-06-10 user-run first-open styling checks passed for moved feature surfaces, including file panel, settings, SpecHub, Git History, Kanban, search palette, intent canvas, browser agent, and release notes where reachable.
