## Context

当前 `ProjectMapGenerationWorker` 的 `buildPrompt()` 是单一大 prompt：它同时服务 global collection、node completion、node calibration。虽然 `requestScope` 能表达 node scope，但 prompt 本身没有把 action intent 讲清楚，也把 profile、lens ids、node ids 等上下文以较粗粒度传给 AI。结果是模型很容易输出全量地图、塞过多内容、遗漏当前节点最关键的证据。

## Goals

- prompt 更短、更可控。
- Complete / Calibrate / Collect 三类动作在内容目标上明显不同。
- 节点级动作只围绕当前节点和子树，不诱导全量重建。
- 老 run metadata 缺少 intent 时保持兼容。

## Non-Goals

- 不改 evidence collection 文件选择算法的上限。
- 不新增 AI provider-specific prompt。
- 不引入 provider-specific parser 或 `eval` 式非安全解析。

## Decision 1: Add Generation Intent

在 `ProjectMapGenerationRequest` / `ProjectMapRunMetadata` 增加可选 `generationIntent`：

- `global`: 建立或重建地图框架。
- `completeNode`: 补全当前节点缺口，可更新目标节点及其子树。
- `calibrateNode`: 对当前节点做事实核验、纠错、置信度校准。

旧 run fallback：

- `scope.kind === "global"` → `global`
- `scope.kind === "node"` → `completeNode`
- 其他 → `global`

这样不会破坏已有 pending run 或历史 metadata。

## Decision 2: Prompt Builder by Intent

`buildPrompt()` 保持 worker 内部 pure helper，但拆出以下小函数：

- `resolveGenerationIntent(run)`
- `buildNodeScopeContext(dataset, scope)`
- `buildPromptTaskLines(intent, nodeContext)`
- `buildPromptOutputRules(intent)`

最终 prompt 固定为：

1. Role + Task
2. Output contract
3. Scope context
4. Evidence

不再输出完整 profile JSON 与全部 node ids；只输出 project name、known lenses count、target node snapshot、子节点摘要。

## Decision 3: Node Scope Is a Contract, Not a Hint

节点级 prompt 必须明确：

- 只返回目标节点和允许子树内的节点。
- 不能生成与当前节点无关的 sibling / global overview。
- source.path 必须来自 evidence file path。
- 证据不足时降低 confidence，禁止补脑。

Complete Node 允许增加缺失的 child nodes；Calibrate Node 默认更保守，优先更新现有目标节点，只有证据明确显示子节点错误时才返回子树修正。

## Edge Cases

- 目标 node id 不存在：prompt 降级为 node scope summary，worker 后续 normalize/merge 仍按现有逻辑处理。
- evidence 为空：prompt 要求 unknown/low confidence，不生成 high confidence。
- AI 返回全量 nodes：`mergeNodeScopedResults` 继续只合并 allowed ids / target subtree，防止写入无关节点。
- AI 返回 JS object literal 风格的 `{ profile: ... }`：worker 在严格 `JSON.parse` 失败后仅做有限修复（quote bare keys / bare string values / strip trailing commas / single-quoted strings），不执行任意代码。

## Validation

- 单测捕获发送给 engine 的 prompt，断言：
  - complete/calibrate 包含不同 action instruction。
  - node prompt 包含 target node snapshot。
  - global prompt 不包含旧的大段 `Existing profile:` / `Existing node ids:`。
- hook/request 单测断言 `openNodeGeneration("calibrate")` 写入 `generationIntent: "calibrateNode"`。
- 运行 focused worker + hook tests、typecheck、OpenSpec strict validate。
