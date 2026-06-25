## 1. CSS contract 落地(已在 v0.5.11 之前完成)

- [x] 在 `src/styles/file-tree.css` 的 `.file-tree-panel` 补齐 flex column shell
- [x] 保留 `.diff-panel.file-tree-panel` override,保持文件树专属间距
- [x] 新增 CSS contract test 锁定 scroll shell 独立于 lazy Git diff styles
- [x] `npm exec vitest run src/features/files/components/FileTreePanel.run.test.tsx` 通过
- [x] `npm run typecheck` 与 `npm run lint` 通过
- [x] `npm run check:large-files` 通过

## 2. Lifecycle 补齐(本次提交完成)

- [x] 把 `openspec/changes/fix-file-tree-virtual-scroll-height/` 移入 `openspec/changes/archive/2026-06-12-fix-file-tree-virtual-scroll-height-hotfix-closeout/`
- [x] `proposal-review.md` 升格为 `proposal.md`,补齐 Why / 目标与边界 / 非目标 / Archive Note 段
- [x] 在主源 `openspec/specs/workspace-filetree-root-node/spec.md` 增加 hotfix closeout 段落
- [x] `openspec validate --all --strict --no-interactive` 覆盖该 archive artifact 与主 spec,并通过
