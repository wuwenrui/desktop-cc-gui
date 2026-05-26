## 1. OpenSpec Readiness

- [x] 1.1 [P0][依赖: 无][输入: proposal/design/spec][输出: strict-valid change][验证: `openspec validate wire-project-map-auto-ingestion --strict`] 完成 Auto Ingestion 接线 change artifacts。

## 2. Scheduler And Request Contract

- [x] 2.1 [P0][依赖: 1.1][输入: `ProjectMapAutoIngestionSettings` + `memoryCursor`][输出: interval/threshold/duplicate guard helpers][验证: autoIngestion util tests cover interval and active-run guards] 实现自动补充调度判断。
- [x] 2.2 [P0][依赖: 2.1][输入: Project Memory messages][输出: `ProjectMapGenerationRequest` auto scope with memory evidence metadata][验证: generation request / hook tests assert `kind=auto` queued run] 创建真实 auto generation request。
- [x] 2.3 [P0][依赖: 2.2][输入: `checkIntervalMinutes`][输出: footer interval setting wiring][验证: component test renders interval control; hook test persists interval updates] 补齐底部 interval UI 接线。

## 3. Worker And Candidate Safety

- [x] 3.1 [P0][依赖: 2.2][输入: auto run memory evidence][输出: worker prompt includes bounded Project Memory snippets][验证: worker test prompt includes memory evidence block for auto run] 接入 Project Memory evidence prompt。
- [x] 3.2 [P0][依赖: 3.1][输入: applyMode][输出: default candidate-safe generated updates][验证: worker / merge tests keep createCandidate auto output as candidate] 默认 createCandidate 不直接信任自动补充事实。
- [x] 3.3 [P1][依赖: 3.1][输入: run completion state][输出: success-only processed marker update][验证: hook test success marks processed, failure does not] 成功后才写 processed marker。
- [x] 3.4 [P0][依赖: 3.1][输入: auto-generated nodes + existing root][输出: root-reachable normalized topology][验证: worker / merge / persistence tests cover auto node parent links and persisted orphan repair] 修复自动补充产生孤儿节点的问题，确保新增节点从项目根可达。
- [x] 3.5 [P0][依赖: 2.3][输入: Auto Ingestion enable click][输出: engine/model confirmation before `enabled=true`][验证: ProjectMapPanel test covers configure-before-enable; hook test covers configured engine/model in auto run] 启用自动补充前必须选择引擎和模型，避免使用隐藏默认模型。
- [x] 3.6 [P0][依赖: 3.1][输入: malformed or prose AI output][输出: one JSON-only repair attempt before final failure][验证: worker test covers non-json first response repaired by second JSON response] 增加结构化输出修复重试，提升自动补充和收集画像的抗抖动能力。
- [x] 3.7 [P1][依赖: 3.5][输入: Confirm Generation / Enable Auto Ingestion dialogs][输出: adaptive desktop width with compact min-width][验证: ProjectMapPanel focused tests + CSS contract check] 让配置弹窗以当前紧凑宽度作为最小宽度，内容较宽时自适应扩展，并保留窄屏单列回退。
- [x] 3.8 [P1][依赖: 3.7][输入: Project Map canvas controls][输出: default-collapsed toolbar with local persisted preference][验证: ProjectMapPanel focused tests cover default collapsed, preference restore, and unrelated graph actions not mutating state] 将画布布局工具组改为默认折叠，并独立记忆用户折叠态。

## 4. Validation

- [x] 4.1 [P0][依赖: 2.*-3.*][输入: Project Map focused suites][输出: tests pass][验证: `npm exec vitest -- run src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/utils/autoIngestion.test.ts --maxWorkers 1 --minWorkers 1`] 运行聚焦测试。
- [x] 4.2 [P0][依赖: 4.1][输入: TypeScript project][输出: typecheck pass][验证: `npm run typecheck`] 运行类型检查。
- [x] 4.3 [P0][依赖: 4.2][输入: OpenSpec change][输出: strict validation pass][验证: `openspec validate wire-project-map-auto-ingestion --strict`] 最终 OpenSpec 校验。
- [x] 4.4 [P1][依赖: 3.7][输入: updated dialog layout][输出: regression check pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/projectMapLayoutCss.test.ts --maxWorkers 1 --minWorkers 1` + `npm run typecheck` + `git diff --check`] 验证弹窗布局和类型不回归。
- [x] 4.5 [P1][依赖: 3.8][输入: collapsible canvas controls][输出: regression check pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/projectMapLayoutCss.test.ts --maxWorkers 1 --minWorkers 1` + `npm run typecheck` + `openspec validate wire-project-map-auto-ingestion --strict` + `git diff --check`] 验证折叠工具组和规格不回归。
