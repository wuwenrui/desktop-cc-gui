## 1. Candidate Review Hook

- [x] 1.1 [P0][输入: candidate utilities][输出: hook confirm/reject methods][验证: hook tests] 接入候选采纳/拒绝持久化。
- [x] 1.2 [P0][输入: invalid candidate][输出: error state][验证: hook test] Confirm 失败时保留原 dataset 并暴露错误。

## 2. Candidate Review UI

- [x] 2.1 [P0][输入: selected node + pending candidate][输出: inspector action row][验证: component test] 在详情区显示 Confirm / Reject。
- [x] 2.2 [P0][输入: i18n][输出: zh/en 文案][验证: component/i18n tests] 补充审核文案。

## 3. Verification

- [x] 3.1 [P0][依赖: 1.*,2.*][输出: focused Vitest][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/utils/candidates.test.ts --maxWorkers 1 --minWorkers 1`] 验证候选审核闭环。
- [x] 3.2 [P0][依赖: 1.*,2.*][输出: typecheck][验证: `npm run typecheck`] 验证类型。
- [x] 3.3 [P0][依赖: 1.*,2.*][输出: OpenSpec strict validate][验证: `openspec validate add-project-map-candidate-review-actions --strict`] 验证规范。
