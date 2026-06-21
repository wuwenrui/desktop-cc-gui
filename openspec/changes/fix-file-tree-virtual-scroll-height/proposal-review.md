# Proposal Review: fix-file-tree-virtual-scroll-height

## Review Date

2026-06-16

## Symptom

右侧文件树首次进入时没有稳定显示纵向 scrollbar；切换到 Git 面板再切回文件树后，scrollbar 才出现。

## Root Cause

`FileTreePanel` 的根节点同时使用 `diff-panel file-tree-panel` class。首次进入文件树时，`file-tree.css` 会加载，但 `diff.css` 不一定已经加载；而文件树外层 scroll shell 依赖 `diff.css` 中 `.diff-panel` 提供的关键布局：

- `display: flex`
- `flex: 1`
- `flex-direction: column`
- `min-height: 0`
- `padding: 8px 8px 0`
- `position: relative`

当这些布局规则在首次挂载时缺失，内部 `.file-tree-list` 即使有 `overflow-y: auto`，也无法稳定形成正确高度的 scroll container。切到 Git 面板后 `diff.css` 被 lazy load，再切回文件树时外层布局补齐，所以 scrollbar 才出现。

## Failed Fix Review

1. Virtualizer measurement refresh
   - 判定为 surface fix。
   - 问题不在 virtual row size，而在 scroll container 的外层高度链路。
   - 已移除。

2. 强制 `.file-tree-list` scrollbar thumb 可见
   - 判定为 symptom-only fix。
   - 如果 scroll container 没有稳定高度，强制 thumb 颜色仍无法解决首屏无 scrollbar。
   - 已移除。

## Final Fix

最终修复让 `.file-tree-panel` 自己拥有完整 scroll shell，不再依赖 Git 面板触发 `diff.css` 后才能获得布局能力：

- 在 `src/styles/file-tree.css` 的 `.file-tree-panel` 中补齐 flex column shell。
- 保留 `.diff-panel.file-tree-panel` override，确保与现有 `.diff-panel` 共存时仍保持文件树专属间距。
- 新增 CSS contract test，锁定文件树 scroll shell 独立于 lazy Git diff styles。

## Review Findings

No blocking issues found.

### Compatibility

- 不修改 React render path、virtualizer、文件树数据结构、拖拽、rename、context menu 或 lazy directory loading 行为。
- 保留 `diff-panel` class，避免破坏既有选择器和 reduced-transparency 兼容路径。
- 修复只把文件树首屏必需布局移动到文件树自己的 stylesheet，属于低 blast radius CSS contract 修复。

### Edge Cases

- Git 面板从未打开：文件树仍能形成完整 scroll shell。
- Git 面板已打开：`.diff-panel.file-tree-panel` 保持文件树 gap/padding，不受 `.diff-panel` 默认 gap 影响。
- 大 workspace virtualized tree：内部 `.file-tree-list` 的 scroll container 高度由 `.file-tree-panel` 的 `flex: 1` 与 `min-height: 0` 保证。

## Validation

Executed and passed:

```bash
npm exec vitest run src/styles/client-typography-font-size.test.ts src/features/files/components/FileTreePanel.run.test.tsx
npm run typecheck
npm run lint
npm run check:large-files
```

## Residual Risk

当前 active change 只有目录骨架，没有 `proposal.md`、`tasks.md` 或 delta `spec.md`。本次按 hotfix closeout review 记录事实，不伪造完整 proposal lifecycle。后续若要归档该 change，应先补齐标准 OpenSpec artifacts 或将本 review 作为一次独立修复记录归档依据。
