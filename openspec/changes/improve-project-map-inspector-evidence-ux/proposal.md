## Why

Project Knowledge Map 已能生成、展示和校准节点，但当前 inspector 与 evidence UX 仍偏“工程调试态”：刷新入口重复且价值不清，候选只显示数量，详情面板过窄，关联证据无法形成可点击的追溯路径。用户需要的是一眼知道“哪些候选要处理、证据来自哪里、点哪里能追到源头”的工作台。

## 目标与边界

- 优化 Project Knowledge Map 的可读性与可操作性，重点覆盖候选审核、详情 inspector 宽度、证据链 link UX、低价值刷新入口清理。
- 保持现有 Project Map 数据模型、AI generation worker、持久化路径和 node selection 语义不变。
- 所有新增用户可见文案必须走 i18n；中文保留 English technical terms。

## 非目标

- 不实现 native daemon worker。
- 不引入第三方 graph library。
- 不新增人工编辑节点正文能力。
- 不修改 `.ccgui/project-map/**` 的存储 schema，除非现有字段已足够表达 link / candidate UX。
- 不在本变更中实现真正的 candidate apply / reject 持久化闭环；本轮先把候选解释与定位入口补齐。

## What Changes

- 移除 Project Map 顶部全局 `Refresh` 按钮与节点详情底部重复 `Refresh evidence` 操作，保留 `Collect`、`Task`、`Complete`、`Calibrate` 作为主操作。
- 将顶部候选 badge 从静态数字升级为可点击的候选审核入口：展示候选数量、解释默认 `createCandidate` 语义，并支持跳转到第一个候选节点。
- 在节点详情内为 candidate 节点展示明确的候选说明：候选是 evidence-backed draft，不等于已确认事实；下一步应 Calibrate 或等待 apply/reject 闭环。
- 将详情 inspector 展开宽度扩大约 50%，让 Core Description、Key Facts、Evidence 不再被迫挤压成窄列。
- 关联证据与 Evidence chip 改成 link-style UX：
  - file / test / spec path 显示可点击按钮，带 path 与 line 信息。
  - symbol / commit / conversation 显示可追溯 ref。
  - 无 path/ref 的证据仍以只读 chip 展示。
- 证据链区域明确区分 `Related Artifacts` 与 `Evidence Sources`，并优先展示 source type、label、path/ref、excerpt 摘要。

## 技术方案对比

| 方案 | 描述 | 优点 | 代价 | 取舍 |
|---|---|---|---|---|
| A. 只改 CSS 宽度与隐藏按钮 | 快速扩大 inspector，删除刷新按钮 | 风险最低 | 候选和证据仍不可理解，不能解决核心 UX | 不采用 |
| B. 在现有组件内做窄 scope UX 修正 | 复用现有 ProjectMapPanel、dataset、node/source 字段，补 link-style rendering 与候选定位 | 代码改动集中，无 schema 迁移，能直接解决截图问题 | `ProjectMapPanel.tsx` 已偏大，需要克制增量 | 采用 |
| C. 拆分完整 Candidate Review drawer | 新增候选抽屉、apply/reject 状态机和持久化 | 产品完整 | 超出本轮 UI/UX 优化，容易牵动 worker/persistence | 后续单独 change |

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `project-xray-panel`: 强化 Project Knowledge Map inspector、candidate review affordance 与 evidence link UX 的可用性要求。

## Impact

- Affected code:
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/styles/project-map.css`
  - `src/i18n/locales/zh.part5.ts`
  - `src/i18n/locales/en.part5.ts`
  - `src/features/project-map/components/ProjectMapPanel.test.tsx`
- Dependencies:
  - 不新增依赖。
- Validation:
  - focused Project Map component tests
  - `npm run typecheck`
  - `openspec validate improve-project-map-inspector-evidence-ux --strict`

## 验收标准

- 顶部 toolbar 不再出现独立 Refresh 按钮，详情底部也不再出现重复 Refresh evidence 操作。
- 顶部候选 badge 可点击；点击后选择第一个 candidate node 并展开 inspector。
- candidate node 的 inspector 显示候选语义说明，用户能理解候选不是已确认事实。
- inspector 展开宽度约为原来的 1.5 倍，并在常规桌面宽度下不遮挡主图谱核心操作。
- Related Artifacts / Evidence Sources 使用 link-style chip/button 展示 path、line、ref 或 excerpt；可追溯信息不再只是灰色静态标签。
- 没有 path/ref 的 evidence 仍保持可读只读状态，不伪造 link。
- 组件测试覆盖候选入口、移除刷新入口、证据 link rendering。
