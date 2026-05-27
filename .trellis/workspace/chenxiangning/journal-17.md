# Journal - chenxiangning (Part 17)

> Continuation from `journal-16.md` (archived at ~2000 lines)
> Started: 2026-05-27

---



## Session 607: Project Map 节点拖拽与重复节点修复

**Date**: 2026-05-27
**Task**: Project Map 节点拖拽与重复节点修复
**Branch**: `feature/v0.5.3`

### Summary

(Add summary)

### Main Changes

本轮完成 Project Map 画布交互与数据归一化收口：
- 修复节点本体 pointer capture 后 move/up 落在 node 上时拖拽 preview 和持久化不触发的问题。
- 强化总览 Root 节点视觉层级，使用更明显的尺寸、蓝色 anchor border、halo 和 badge。
- 修复同一 ProjectMapNode.id 跨多个 lens payload 重复出现导致 graph 渲染多个相同节点的问题，在 topology normalization 层按稳定 id 去重并合并 topology/evidence。
- 更新 OpenSpec change improve-project-map-drag-and-root-visual 的 proposal/design/tasks/spec。

验证：
- npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1：28 passed。
- npm exec vitest -- run src/features/project-map/services/projectMapPersistence.test.ts src/features/project-map/utils/incrementalGeneration.test.ts --maxWorkers 1 --minWorkers 1：20 passed。
- openspec validate improve-project-map-drag-and-root-visual --strict：passed。
- npm run typecheck：passed。
- npm run lint：passed。
- npm run check:large-files：found=0。
- git diff --check：passed。


### Git Commits

| Hash | Message |
|------|---------|
| `ced4bf9e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 608: 修复 Project Map 跨工程生成串线

**Date**: 2026-05-27
**Task**: 修复 Project Map 跨工程生成串线
**Branch**: `feature/v0.5.3`

### Summary

(Add summary)

### Main Changes

## Summary

修复 Project Map 在两个工程同时收集信息时可能串线的问题。根因是生成 worker 使用 mutable active dataset 状态，且持久化边界未校验 snapshot ownership。

## Changes

- 为 Project Map worker 增加 immutable ownership context：workspaceId、storageKey、storageLocation、worker-local dataset。
- worker progress/completion/failure 只写回启动时的 storageLocation；只有当前 UI 仍匹配 workspace + storageKey + storageLocation 时才同步 UI state。
- frontend persistence 写入前校验 dataset manifest storageKey 与 expectedStorageKey。
- read-side quarantine persisted manifest storageKey mismatch，避免展示污染 snapshot。
- Rust `project_map_write_snapshot` 解析 `manifest.json.storageKey` 并拒绝 mismatch 写入。
- OpenSpec 主 spec 已回写，change 已归档到 `openspec/changes/archive/2026-05-27-fix-project-map-cross-workspace-run-isolation/`。

## Validation

- `npm exec vitest -- run src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapPersistence.test.ts --maxWorkers 1 --minWorkers 1`：40 passed。
- `npm run lint`：passed。
- `npm run typecheck`：passed。
- `cargo test --manifest-path src-tauri/Cargo.toml project_map`：9 passed。
- `openspec validate --all --strict --no-interactive`：passed。
- `git diff --check`：passed。


### Git Commits

| Hash | Message |
|------|---------|
| `05f07b8c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 609: 收口 Claude 自定义模型事实源归一化

**Date**: 2026-05-27
**Task**: 收口 Claude 自定义模型事实源归一化
**Branch**: `feature/v0.5.3`

### Summary

(Add summary)

### Main Changes

## Summary

- 新增 `normalizeClaudeCustomModels` / `readClaudeCustomModelsFromStorage`，将 Claude custom model 读取统一为 shape-only normalization。
- 替换 composer selector、engine controller、vendor settings hook 的 Claude custom model 读取路径，避免 user-entered model id 被 generic regex allowlist 过滤。
- CustomModelDialog 对 Claude 使用 `shape-only` 校验，Codex/Gemini 等非 Claude 路径继续保留 `model-id` 校验。
- 新增 OpenSpec change `fix-claude-custom-model-fact-source-normalization` 并补齐 proposal/design/tasks/spec delta。

## Verification

- `git diff --check`
- `npm exec vitest run src/features/composer/components/ChatInputBox/modelOptions.test.ts src/features/engine/hooks/useEngineController.test.tsx src/features/vendors/components/CustomModelDialog.test.tsx src/features/vendors/hooks/usePluginModels.test.tsx`
- `npm run typecheck`
- `openspec validate --all --strict --no-interactive`
- `npm run lint`

## Commit

- `0c981fc9 fix(claude-model): 保留自定义模型事实源`


### Git Commits

| Hash | Message |
|------|---------|
| `0c981fc9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
