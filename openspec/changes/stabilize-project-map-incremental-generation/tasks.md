## 1. OpenSpec Readiness

- [x] 1.1 [P0][依赖: 无][输入: proposal/design/specs][输出: strict-valid OpenSpec artifacts][验证: `openspec validate stabilize-project-map-incremental-generation --strict`] 完成增量生成 change artifacts。

## 2. Incremental Merge Core

- [x] 2.1 [P0][依赖: 1.1][输入: `ProjectMapDataset` + AI payload][输出: feature-local merge helper][验证: unit test repeated global run preserves omitted existing node] 实现全局生成增量合并。
- [x] 2.2 [P0][依赖: 2.1][输入: node scoped payload][输出: scoped merge helper][验证: unit test complete/calibrate preserves unrelated nodes] 实现节点级增量合并。
- [x] 2.3 [P0][依赖: 2.1][输入: sources/artifacts/detail arrays][输出: deterministic dedupe/union][验证: unit test source/artifact/detail 不重复且不丢失] 实现 evidence-aware 字段合并。
- [x] 2.4 [P0][依赖: 2.1][输入: confidence/stale/candidate fields][输出: confidence guard][验证: unit test 无 source 不升级 high，校准可降级/标 stale] 实现置信度保护。

## 3. Manual Pruning

- [x] 3.1 [P0][依赖: 2.1][输入: dataset + node id][输出: prune helper][验证: unit test 删除节点、后代、父 children 引用、pending candidates] 实现人工剪枝数据逻辑。
- [x] 3.2 [P1][依赖: 3.1][输入: ProjectMapPanel inspector][输出: every-node Delete node action][验证: component test root/非 root 均显示删除入口] 增加删除节点按钮。
- [x] 3.3 [P1][依赖: 3.2][输入: zh/en locale + CSS][输出: destructive action 文案和样式][验证: i18n key / class assertion] 补齐交互文案与样式。

## 4. Prompt Semantics

- [x] 4.1 [P0][依赖: 2.1][输入: global prompt builder][输出: incremental global prompt][验证: worker test prompt contains no-delete/delta semantics] 收敛收集画像 prompt。
- [x] 4.2 [P0][依赖: 2.2][输入: completeNode prompt builder][输出: selected-node enrichment prompt][验证: worker test prompt targets selected node only] 收敛补全节点 prompt。
- [x] 4.3 [P0][依赖: 2.2][输入: calibrateNode prompt builder][输出: selected-node verification prompt][验证: worker test prompt requests verification not expansion] 收敛校准节点 prompt。

## 5. Verification

- [x] 5.1 [P0][依赖: 2.*,3.*,4.*][输入: Project Map focused suites][输出: tests pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/utils/candidates.test.ts --maxWorkers 1 --minWorkers 1`] 运行聚焦测试。
- [x] 5.2 [P0][依赖: 5.1][输入: TypeScript project][输出: typecheck pass][验证: `npm run typecheck`] 运行类型检查。
- [x] 5.3 [P0][依赖: 5.2][输入: lint/style guards][输出: lint and large-file pass][验证: `npm run lint && npm run check:large-files && git diff --check`] 运行质量门禁。
- [x] 5.4 [P0][依赖: 5.3][输入: OpenSpec change][输出: strict validation pass][验证: `openspec validate stabilize-project-map-incremental-generation --strict`] 最终 OpenSpec 校验。

## 6. Evidence Trace Navigation

- [x] 6.1 [P1][依赖: 3.2][输入: evidence/artifact path + line][输出: ProjectMapPanel trace open callback][验证: component test clicking evidence calls `onOpenEvidenceFile(path, { line, column: 1 })`] 证据链 chip 接入文件打开事件。
- [x] 6.2 [P1][依赖: 6.1][输入: layout `onOpenFile`][输出: center editor split navigation][验证: typecheck + existing `handleOpenFile` editor mode contract] Project Map 面板接入中间 editor 打开能力。
- [x] 6.3 [P1][依赖: 6.1][输入: ref/hash/conversation evidence][输出: inert non-clickable chip][验证: component test conversation evidence remains `span`] 非文件证据不伪造 link。

## 7. Project Map Evidence Split Context

- [x] 7.1 [P1][依赖: 6.2][输入: Project Map evidence open event][输出: `editorSplitCompanion=projectMap` open option][验证: hook test Project Map evidence open stores projectMap companion] 给 Project Map 证据链文件打开增加专用来源标记。
- [x] 7.2 [P1][依赖: 7.1][输入: DesktopLayout editor split][输出: editor + Project Map split companion][验证: layout test Project Map companion active and chat hidden] 文件视图分屏时保留 Project Map 作为左侧上下文。
- [x] 7.3 [P1][依赖: 7.2][输入: normal file open][输出: default chat companion unchanged][验证: existing editor split tests + typecheck] 保持普通文件打开仍使用 chat companion。

## 8. Project Map Toolbar Toggle And Closeback

- [x] 8.1 [P1][依赖: 7.2][输入: right toolbar Project Map tab][输出: active Project Map tab click closes Project Map surface][验证: `useLayoutNodes` typecheck + toolbar state branch] 地球图标改为打开/关闭切换。
- [x] 8.2 [P1][依赖: 7.1][输入: editor tabs opened from Project Map evidence][输出: last-file close returns to Project Map][验证: hook test closing last Project Map evidence file sets `centerMode=projectMap`] 关闭最后一个证据文件后回到 Project Map。
- [x] 8.3 [P1][依赖: 8.2][输入: close-all editor tabs][输出: Project Map closeback preserved][验证: hook test close all Project Map evidence files sets `centerMode=projectMap`] 关闭全部证据文件后保持 Project Map 打开。
- [x] 8.4 [P1][依赖: 8.1][输入: editor center mode + Project Map toolbar tab][输出: editor companion toggle branch][验证: `useLayoutNodes` test opens Project Map as editor companion without replacing editor] 修复地球图标在 editor 场景下的打开/关闭切换。
- [x] 8.5 [P0][依赖: 8.1][输入: app-shell layout adapter][输出: Project Map toggle setters forwarded into `useLayoutNodes`][验证: adapter contract test protects `setCenterMode` / `editorSplitCompanion` forwarding] 修复真实 shell 中地球图标无法关闭 Project Map。

## 9. Artifact Writeback

- [x] 9.1 [P0][依赖: 5.*,8.*][输入: 用户本地测试通过反馈 + implementation diff][输出: proposal/design implementation writeback][验证: `openspec validate stabilize-project-map-incremental-generation --strict`] 回写提案、设计与验收结论。

## 10. Task Drawer UX Density

- [x] 10.1 [P1][依赖: 4.*,8.*][输入: Project Map generation runs + node index][输出: compact task cards with action and target context][验证: ProjectMapPanel test asserts node-scoped run action and target node title/id] 补齐任务卡片“点了哪个按钮、目标节点是谁”的信息。
- [x] 10.2 [P1][依赖: 10.1][输入: task drawer CSS][输出: reduced drawer/card spacing and denser metadata grid][验证: `git diff --check` + component render test] 压缩任务面板留白和卡片排版。

## 11. Related Artifact Trace Links

- [x] 11.1 [P1][依赖: 6.1][输入: related artifact label/ref/path][输出: path-like related artifact trace target][验证: ProjectMapPanel test clicks legacy `src/.../application.yml` artifact and `README.md` artifact] 让关联证据中的文件路径项复用证据链 link 交互。

## 12. Claude JSON Output Compatibility

- [x] 12.1 [P0][依赖: 4.2][输入: Claude Code node completion failure `AI output did not contain valid JSON`][输出: valid JSON schema prompt + evidence instruction isolation][验证: worker prompt test asserts valid profile skeleton and evidence block markers] 修复 Claude 补全节点 prompt 中非法 schema 示例和证据指令污染。
- [x] 12.2 [P0][依赖: 12.1][输入: noisy/fenced/multi-object Claude output][输出: balanced JSON candidate scanner + Project Map payload shape gate][验证: worker test selects fenced Project Map payload while skipping unrelated JSON] 增强 AI 输出 JSON 候选提取。
- [x] 12.3 [P0][依赖: 12.2][输入: copied placeholder `"profile": {...}`][输出: targeted lenient repair before payload normalization][验证: worker test repairs placeholder ellipsis output] 兼容 Claude 复制 schema 占位符造成的 JSON parse error。
- [x] 12.4 [P0][依赖: 12.1-12.3][输入: implementation diff][输出: validation evidence][验证: `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/services/projectMapPersistence.test.ts src/features/project-map/utils/incrementalGeneration.test.ts src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx --maxWorkers 1 --minWorkers 1` + `npm run typecheck` + `npm run lint` + `npm run build`] 验证 Claude JSON hardening 不破坏 Project Map 生成链路。
