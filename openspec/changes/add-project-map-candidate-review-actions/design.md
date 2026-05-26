## Context

`src/features/project-map/utils/candidates.ts` 已有纯函数：

- `confirmProjectMapCandidate()`
- `rejectProjectMapCandidate()`

它们完成 evidence gate、patch 应用和状态更新，但目前没有被 hook / UI 接入。

## Decision

在 `useProjectMapDataset` 增加两个方法：

- `confirmCandidate(candidateId: string): Promise<boolean>`
- `rejectCandidate(candidateId: string): Promise<boolean>`

两者都通过现有 `updateDataset()` / `persistDataset()` 路径落盘，保持与其他 Project Map 修改一致。

UI 层只在 selected node 有 pending candidate record 时展示候选审核块。匹配规则：

1. `candidate.status === "pending"`
2. `candidate.patch.nodeId === selectedNode.id` 或 `candidate.targetNodeId === selectedNode.id`

## Error Handling

Confirm 可能因为 evidence gate 失败或 target node 缺失返回 errors。hook 将错误写入现有 `error` state 并返回 `false`，UI 不做 optimistic patch。

Reject 不需要 evidence gate；未知 candidate id 时保持 no-op 风格，但 UI 正常关闭审核动作。

## UI

在 `candidate notice` 下方添加审核 action row：

- Confirm：主按钮，表示采纳候选 patch。
- Reject：次按钮，表示拒绝候选记录。
- 可见文案走 i18n。

## Validation

- hook tests 覆盖 confirm / reject 持久化。
- component tests 覆盖按钮显示、点击 confirm / reject 调用 controller。
- existing utility tests 保持通过。
