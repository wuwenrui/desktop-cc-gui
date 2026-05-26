## Why

Project Knowledge Map 的 AI 生成链路现在提示词偏长、偏泛，Global / Complete / Calibrate 三类动作共用近似任务描述，导致模型经常尝试重建全量地图、输出不完整或偏离当前节点。用户从 UI 侧看到的节点级按钮应该是“围绕当前节点做精确补全/校准”，而不是重复触发全量信息收集。

## 目标与边界

- 让全局收集 prompt 保持框架级，但更短、更强约束。
- 让节点补全 prompt 只聚焦当前节点及可选子树，要求补缺而不是重写全局地图。
- 让节点校准 prompt 只聚焦当前节点事实核验，要求纠错、降置信度、补证据，而不是扩写。
- 缩减 prompt 中现有 dataset 上下文，避免把大量 node id / profile JSON 直接塞给模型。
- 保持现有 `ProjectMapDataset` 存储 schema，不新增 runtime dependency。

## 非目标

- 不实现 candidate apply / reject 状态机。
- 不新增手工编辑地图内容。
- 不改变 engine dispatch、Tauri command 或持久化目录结构。
- 不把 evidence budget 调大；本轮目标是减少噪声，不是塞更多内容。

## What Changes

- 新增 generation action intent：`global`、`completeNode`、`calibrateNode`。
- 节点级 request 记录当前动作意图，worker 根据 intent 组装不同 prompt。
- `buildPrompt` 拆为短格式：任务、输出规则、scope context、evidence 四段。
- 节点级 prompt 注入当前节点 snapshot 与子节点摘要，并明确“只返回目标节点/子树内节点”。
- 校准 prompt 明确要求根据证据纠错、降低 confidence、标记 stale/candidate，而不是补写无证据内容。
- 增加 focused tests，断言三类 prompt 不再同质化。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map AI generation SHALL use concise, action-specific prompts for global collection, node completion, and node calibration.

## Impact

- 代码：
  - `src/features/project-map/types.ts`
  - `src/features/project-map/utils/generationRequests.ts`
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - `src/features/project-map/services/projectMapGenerationWorker.ts`
  - focused tests under `src/features/project-map/**`
- API / storage：
  - `ProjectMapGenerationRequest` 与 run metadata 增加前端本地字段；不改变 Tauri command payload。
  - 旧 run 没有 intent 时 fallback 到现有 scope 行为。
- 依赖：
  - 不新增依赖。

## 技术方案对比

| 方案 | 做法 | 优点 | 风险 | 结论 |
|---|---|---|---|---|
| A. 只改中文 prompt 文案 | 保持现有 request/scope，直接删减 `buildPrompt` 文本 | 改动最小 | 无法区分 Complete 与 Calibrate，按钮语义仍同质化 | 不采用 |
| B. 增加 action intent + prompt builder 分支 | 在 request/run 中记录动作，worker 根据动作生成短 prompt | 精准解决三类动作差异，兼容旧数据 | 需要更新类型、hook、测试 | 采用 |
| C. 为每个动作建立独立 worker | complete/calibrate/global 三套执行链路 | 隔离彻底 | 过度设计，重复 engine/evidence/parse 逻辑 | 不采用 |

## 验收标准

- Global prompt 不再直接包含完整 `Existing profile` JSON 与全部 node ids。
- Complete Node prompt 明确包含目标节点 title/id/lens，并要求“补缺 + 可更新子树”。
- Calibrate Node prompt 明确包含目标节点 title/id/lens，并要求“核验/纠错/降置信度”，不得要求扩展全局地图。
- 节点级 request 的 `readSources` 优先使用目标节点 sources，不回退到全量 sources。
- Focused Vitest、typecheck、OpenSpec strict validate 通过。
