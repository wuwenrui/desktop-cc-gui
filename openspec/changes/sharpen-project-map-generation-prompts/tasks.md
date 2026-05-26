## 1. Prompt Contract

- [x] 1.1 [P0][输入: Project Map generation run metadata][输出: `generationIntent` 类型与 fallback][验证: typecheck + focused tests] 增加 action intent 表达 Global / Complete / Calibrate。
- [x] 1.2 [P0][输入: selected node][输出: node request 使用动作 intent 与节点 sources][验证: hook tests] 修正节点按钮 request，不再把补全/校准做成同质化请求。
- [x] 1.3 [P0][输入: worker buildPrompt][输出: 短 prompt builder][验证: worker prompt assertions] 缩短全局 prompt，移除噪声上下文 dump。
- [x] 1.4 [P0][输入: node scope][输出: target node snapshot + child summary][验证: worker tests] 节点级 prompt 注入当前节点上下文。
- [x] 1.5 [P0][输入: complete/calibrate intent][输出: 差异化 action instructions][验证: worker tests] 区分补全与校准语义。
- [x] 1.6 [P0][输入: AI JSON-shaped object output][输出: bounded parser repair + stricter prompt rule][验证: worker regression test] 修复 unquoted property name 导致生成失败。
- [x] 1.7 [P0][输入: AI object-literal bare string values][输出: bounded parser repair][验证: worker regression test] 修复 `Unrecognized token '登'` 这类裸中文值解析失败。

## 2. Verification

- [x] 2.1 [P0][依赖: 1.*][输出: OpenSpec strict validate][验证: `openspec validate sharpen-project-map-generation-prompts --strict`] 验证 artifact。
- [x] 2.2 [P0][依赖: 1.*][输出: focused Vitest][验证: `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/hooks/useProjectMapDataset.test.tsx --maxWorkers 1 --minWorkers 1`] 验证 prompt/request 行为。
- [x] 2.3 [P0][依赖: 1.*][输出: typecheck][验证: `npm run typecheck`] 验证类型闭环。
- [x] 2.4 [P0][依赖: 1.6][输出: focused Vitest][验证: `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts --maxWorkers 1 --minWorkers 1`] 验证 JSON repair 回归。
- [x] 2.5 [P0][依赖: 1.7][输出: focused Vitest][验证: `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts --maxWorkers 1 --minWorkers 1`] 验证裸中文字符串值回归。
