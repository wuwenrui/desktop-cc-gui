## Why

Project Map 现在能显示 candidate 节点并解释候选语义，但用户还不能在 UI 中把候选采纳或拒绝。候选如果只能看、不能处理，会继续堆积成噪声，破坏“知识地图可信度”。

## 目标与边界

- 在候选节点详情内提供明确的 Confirm / Reject 审核动作。
- Confirm 复用现有 evidence gate，只在候选 patch 合法时更新目标节点并落盘。
- Reject 只更新 candidate 状态，不改 active node。
- 操作后保留当前选中节点与详情上下文，并给出错误反馈。

## 非目标

- 不实现 candidate 列表抽屉或批量审核。
- 不修改 `.ccgui/project-map/**` 存储 schema。
- 不新增 AI 生成候选的逻辑。
- 不把节点 `candidate: true` 的视觉状态等同于 pending `ProjectMapCandidate` 记录；本轮只处理有 candidate record 的审核动作。

## What Changes

- `useProjectMapDataset` 暴露 `confirmCandidate` / `rejectCandidate`。
- `ProjectMapPanel` 在 selected node 匹配 pending candidate 时显示审核动作。
- Confirm 成功后调用 `confirmProjectMapCandidate` 并持久化 dataset。
- Reject 成功后调用 `rejectProjectMapCandidate` 并持久化 dataset。
- Confirm 失败时展示 evidence gate error，不做部分写入。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map candidate review SHALL support confirming or rejecting pending candidate records from the node inspector.

## Impact

- `src/features/project-map/hooks/useProjectMapDataset.ts`
- `src/features/project-map/components/ProjectMapPanel.tsx`
- `src/features/project-map/utils/candidates.ts`
- `src/i18n/locales/*`
- focused Project Map tests

## 技术方案对比

| 方案 | 做法 | 优点 | 风险 | 结论 |
|---|---|---|---|---|
| A. 只在详情里加文案 | 告诉用户以后会支持审核 | 改动最小 | 不能解决候选堆积 | 不采用 |
| B. 节点详情内加单候选 Confirm / Reject | 复用现有 candidate utility 和 dataset persistence | 窄 scope、立刻闭环 | 暂不支持批量 | 采用 |
| C. 做完整 candidate drawer | 顶部 badge 打开列表，可批量处理 | 产品更完整 | 牵动布局和状态，超出本轮 | 后续再做 |

## 验收标准

- 选中带 pending candidate record 的节点时，详情区显示 Confirm / Reject。
- Confirm 合法候选后，目标节点被 patch，candidate 状态变为 `confirmed`，evidence records 被追加。
- Reject 后，candidate 状态变为 `rejected`，目标节点不变。
- Confirm 不合法候选时，UI 显示错误且不修改节点。
- Focused tests、typecheck、OpenSpec strict validate 通过。
