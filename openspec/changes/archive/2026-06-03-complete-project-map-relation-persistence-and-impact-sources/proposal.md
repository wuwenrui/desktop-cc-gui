## Why

The previous Project Map context change added optional relation types, front-end context builders, and minimal impact analysis, but relation persistence and impact input sources are not yet complete. Without backend read/write support and real changed-file sources, relations and impact overlay remain a partial local capability.

This change closes that gap by making relation persistence end-to-end and by feeding impact analysis from real project signals such as git diff and agent patch/touched files.

## 目标与边界

目标：

- Persist and reload `relations/latest.json` through the Tauri Project Map storage pipeline.
- Expose a stable changed-file source for Project Map impact analysis.
- Support git diff changed files as the first concrete impact input.
- Leave room for future Agent Task patch files without blocking this change.

边界：

- This change completes the persistence/input plumbing for existing relation and impact models.
- This change does not introduce new relation extraction logic.
- This change does not redesign the Project Map graph renderer.

## 非目标

- 不实现 Guided Tour、Path Finder 或 Search 增强。
- 不实现完整 Code+Spec+Task graph。
- 不引入 post-commit auto-update hook。
- 不把 external dashboard 作为交付物。

## What Changes

- Add backend read support for Project Map relation snapshots.
- Ensure frontend persistence receives `relations` from storage reads and writes them consistently.
- Add a Project Map impact source adapter for changed file paths.
- Add a git diff based changed-file provider for the active workspace when available.
- Display impact input source metadata in the Project Map panel.

## 技术方案取舍

| 选项 | 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | Only keep relation/impact in frontend memory | Fast and simple | Loses relations on reload and cannot support saved maps | 不采用 |
| B | Extend existing Project Map storage snapshot with relations and changed-file provider | Minimal, compatible with current storage layout | Requires backend read mapping | 采用 |
| C | Build a new storage/indexing service | More flexible long term | Overkill for closing this gap | 不采用 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-map-incremental-generation`: Relation records must round-trip through Project Map storage and remain optional.
- `project-xray-panel`: Project Map impact overlay must accept changed file inputs from real workspace sources.
- `git-operations`: Git changed-file data may be used as a Project Map impact input without changing git operation semantics.

## Impact

- Frontend Project Map persistence and panel input plumbing.
- Tauri Project Map storage read response.
- Optional git changed-file provider or adapter.
- No required migration for existing Project Map datasets.

## 验收标准

- A dataset with `relations/latest.json` reloads with `dataset.relations` populated.
- A dataset without relations still loads normally.
- Project Map can compute impact from real changed files in the active workspace.
- Unmapped and ignored changed files remain visible in the impact summary.
- `openspec validate --all --strict --no-interactive` and `npm run typecheck` pass.
