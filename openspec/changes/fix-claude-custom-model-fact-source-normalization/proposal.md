## Why

Claude custom models are currently accepted by the settings dialog but later re-filtered by stricter composer and engine-controller readers. This causes user-entered model facts such as `Haiku 4.5` to disappear from Claude Code model selection even though the system already persisted them.

## What Changes

- Treat Claude custom models as user-owned facts: readers normalize structure but do not apply model-id regex allowlists.
- Use one shared frontend normalization path for Claude custom models consumed by both the composer selector merge and engine model catalog merge.
- Keep Claude settings/env override models from the backend and merge user custom models deterministically without rewriting user-entered model values.
- Keep Codex/Gemini validation behavior unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `claude-dynamic-model-discovery`: Clarifies that Claude custom model normalization is shape-only and must not reject user-entered model ids solely because of spaces, punctuation, Unicode, or non-official naming.

## Impact

- Frontend model normalization and catalog merge:
  - `src/features/models/claudeCustomModels.ts`
  - `src/features/composer/components/ChatInputBox/modelOptions.ts`
  - `src/features/engine/hooks/useEngineController.ts`
  - `src/features/vendors/components/CustomModelDialog.tsx`
  - `src/features/vendors/hooks/usePluginModels.ts`
- Focused tests:
  - `src/features/composer/components/ChatInputBox/modelOptions.test.ts`
  - `src/features/engine/hooks/useEngineController.test.tsx`
  - `src/features/vendors/components/CustomModelDialog.test.tsx`
  - `src/features/vendors/hooks/usePluginModels.test.tsx`
- No backend API change, no dependency change.

## 目标与边界

- 目标：Claude Code selector 同时读取 settings/env override catalog 与用户自定义模型，且自定义模型只做结构归一化。
- 边界：不改变 Codex、Gemini、OpenCode 的模型合法性规则；不改写用户 localStorage 数据；不新增官方模型白名单。

## 非目标

- 不判断用户自定义模型是否由 Claude 官方支持。
- 不把用户输入的模型 id 自动改写成 slug。
- 不改变 Claude CLI 最终对模型值的 runtime 处理。

## 技术方案对比

| 方案 | 描述 | 取舍 |
|---|---|---|
| A | 在现有两处读取点分别放宽校验 | 短期可用，但继续存在规则漂移风险，不采用 |
| B | 把 Claude custom model 读取抽成共享 shape-only helper | 单一事实链，改动小，可测试，采用 |

## 验收标准

- `Haiku 4.5` 这类带空格的 Claude custom model MUST 显示在 selector 中。
- 用户自定义 Claude model 的 runtime model MUST 等于用户填写的 id。
- Composer selector merge 与 engine controller merge MUST 对 Claude custom models 使用同一 normalization 行为。
- 空 id、缺 id、非对象 payload 仍 MUST 被丢弃。
