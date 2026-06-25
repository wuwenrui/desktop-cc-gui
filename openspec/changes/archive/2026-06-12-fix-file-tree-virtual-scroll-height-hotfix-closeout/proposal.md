# Proposal: 修复文件树首屏 scroll shell 缺失(hotfix closeout)

## Review Date

2026-06-16

## Why

本仓库在 v0.5.10 阶段发现文件树(`FileTreePanel`)首次进入时无稳定 scrollbar。该修复属于 hotfix closeout:CSS contract 已在 `c5fe7b17 fix(files): 修复文件树刷新失效` 之前完成落地(`src/styles/file-tree.css` 增加 `.file-tree-panel` flex column shell;`FileTreePanel.run.test.tsx` 锁定 scroll shell 独立于 lazy Git diff styles),但当时未走完整 OpenSpec proposal lifecycle。

为对齐 lifecycle,本次把该 hotfix 复盘 review 升格为标准 proposal,标记为 closeout 形态(已实施、不再迭代),并整体移入 `openspec/changes/archive/` 维护。

## 目标与边界

- 保留 `.file-tree-panel` 自有 flex column shell,使首屏不依赖 lazy `diff.css`。
- 保留 `.diff-panel.file-tree-panel` override,避免破坏既有选择器。
- 新增 CSS contract test 锁定 scroll shell 独立于 lazy Git diff styles。
- 不重写 virtualizer、文件树数据结构、lazy directory loading 行为。

## 非目标

- 不调整 `FileTreePanel` 的 React render path。
- 不迁移 `diff-panel` class 命名。
- 不修改 `check-large-files` 阈值。
- 不重做 `useWorkspaceFiles` 数据层。

## Symptom

右侧文件树首次进入时没有稳定显示纵向 scrollbar;切换到 Git 面板再切回文件树后,scrollbar 才出现。

## Root Cause

`FileTreePanel` 的根节点同时使用 `diff-panel file-tree-panel` class。首次进入文件树时,`file-tree.css` 会加载,但 `diff.css` 不一定已经加载;而文件树外层 scroll shell 依赖 `diff.css` 中 `.diff-panel` 提供的关键布局(`display: flex` / `flex: 1` / `flex-direction: column` / `min-height: 0` / `padding: 8px 8px 0` / `position: relative`)。当这些布局规则在首次挂载时缺失,内部 `.file-tree-list` 即使有 `overflow-y: auto`,也无法稳定形成正确高度的 scroll container。切到 Git 面板后 `diff.css` 被 lazy load,再切回文件树时外层布局补齐,所以 scrollbar 才出现。

## Failed Fix Review

1. Virtualizer measurement refresh — 判定为 surface fix(问题不在 virtual row size,而在 scroll container 的外层高度链路)。已移除。
2. 强制 `.file-tree-list` scrollbar thumb 可见 — 判定为 symptom-only fix(无稳定高度时强制 thumb 颜色无法解决首屏无 scrollbar)。已移除。

## What Changes

- `src/styles/file-tree.css` 的 `.file-tree-panel` 中补齐 flex column shell。
- 保留 `.diff-panel.file-tree-panel` override,确保与现有 `.diff-panel` 共存时仍保持文件树专属间距。
- 新增 CSS contract test,锁定文件树 scroll shell 独立于 lazy Git diff styles。
- 主源 spec `openspec/specs/workspace-filetree-root-node/spec.md` 增加 hotfix closeout 段落。

## Validation

Executed and passed:

```bash
npm exec vitest run src/styles/client-typography-font-size.test.ts src/features/files/components/FileTreePanel.run.test.tsx
npm run typecheck
npm run lint
npm run check:large-files
```

## Residual Risk

无。本修复为 CSS contract 层的低 blast radius 修复,且不修改 React render path、virtualizer、文件树数据结构、拖拽 / rename / context menu / lazy directory loading 行为。

## Archive Note

本 change 已在 v0.5.11 之前完成实施(关联 commit: `c5fe7b17 fix(files): 修复文件树刷新失效` 之前的 CSS 修复)。本次按 hotfix closeout 升格 proposal lifecycle,整体移入 `openspec/changes/archive/`,不再视为 active change。
