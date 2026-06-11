## Why

当前 Composer 的提示词增强在打开窗体后会立即发起增强请求，用户无法在请求前选择增强供应商或调整超时时间。这会造成两个问题：一是用户无法控制本次增强使用的 engine，二是慢请求或不可用供应商只能依赖固定超时与内部 fallback。

本变更将提示词增强从“打开即执行”改为“配置后主动执行”，让窗体承担本次增强配置确认，并让用户显式点击按钮触发运行。

## 目标与边界

- 目标：在“增强提示词”窗体内提供增强供应商、模型和超时时间设置。
- 目标：打开窗体时只展示原始提示词与配置，不自动调用增强请求。
- 目标：用户点击“开始增强”后才发起增强请求，并按本次窗体配置执行。
- 目标：保留现有“使用增强版本”和“保留原始版本”行为。
- 边界：供应商选择限定为现有 `EngineType` 增强引擎：Claude、Codex、Gemini、OpenCode。
- 边界：超时时间只影响本次 prompt enhancement 请求，不改变全局 engine runtime timeout。

## 非目标

- 不新增全局提示词增强设置页。
- 不新增新的模型供应商管理能力。
- 不修改 Codex provider-scoped session launch 的全局会话选择规则。
- 不改变普通 Composer 发送消息的 provider/model 行为。
- 不引入新的外部依赖。

## What Changes

- `PromptEnhancerDialog` 增加本次增强配置区：
  - 增强供应商选择。
  - 所选供应商下的模型选择。
  - 超时时间输入，按安全范围 clamp。
  - “开始增强”按钮。
- `usePromptEnhancer` 拆分两个动作：
  - 打开窗体：捕获当前原始提示词并准备默认配置。
  - 执行增强：用户点击按钮后按配置调用 `engineSendMessageSync`。
- 增强模型列表复用 Composer 已有模型解析结果，不新增模型发现逻辑。
- 请求超时从固定常量改为本次运行参数。
- 错误文案继续可追踪，包含失败 engine 与超时上下文。
- 保留现有增强结果归一化与写回 Composer 的行为。

## 技术方案对比

### 方案 A：在现有 Dialog + Hook 内局部增强

- 做法：保留 `usePromptEnhancer` 为状态编排中心，`PromptEnhancerDialog` 只新增受控配置字段与触发按钮。
- 优点：改动集中，复用现有请求、归一化、写回和测试结构。
- 缺点：Dialog props 会增加，但仍属于该 feature 的局部复杂度。
- 结论：采用。

### 方案 B：新增全局 Prompt Enhancer Settings

- 做法：把供应商和 timeout 写入全局 client store，由窗体读取默认值。
- 优点：多次使用可复用默认配置。
- 缺点：当前需求是“在这个窗体里设置”，全局持久化会引入额外状态迁移、默认值治理和设置页信息架构。
- 结论：不采用，属于过度设计。

### 方案 C：复用现有 Composer provider/model selector

- 做法：提示词增强始终跟随 Composer 当前 provider/model，只新增 timeout。
- 优点：UI 更少。
- 缺点：无法满足“让我自己设置供应商”的显式需求，并且增强引擎与普通发送引擎存在不同的临时运行语义。
- 结论：不采用。

## Capabilities

### New Capabilities

- `composer-prompt-enhancer`: Defines the Composer prompt enhancement dialog contract, including manual run, per-run engine selection, timeout control, result adoption, and failure handling.

### Modified Capabilities

- None.

## Impact

- Frontend UI:
  - `src/features/composer/components/ChatInputBox/PromptEnhancerDialog.tsx`
  - `src/features/composer/components/ChatInputBox/ChatInputBoxFooter.tsx`
  - `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`
- Frontend hook:
  - `src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.ts`
- i18n:
  - `src/i18n/locales/zh.part6.ts`
  - `src/i18n/locales/en.part6.ts`
- Tests:
  - `src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.test.tsx`
- No Rust command or Tauri IPC schema change is expected; the existing `engineSendMessageSync` bridge remains the request boundary.

## 验收标准

- 打开增强提示词窗体时，不调用 `engineSendMessageSync`。
- 窗体显示原始提示词、供应商选择、模型选择、超时时间输入和“开始增强”按钮。
- 点击“开始增强”后，才按选定供应商与模型调用 `engineSendMessageSync`。
- 切换供应商时，模型选择会切换到该供应商下的可用模型；无可用模型时允许模型为空。
- timeout 使用用户输入的本次配置；无效值会被归一化到安全范围。
- 增强过程中禁止重复触发运行，关闭窗体会让当前请求结果失效。
- 增强成功后，“使用增强版本”可将结果写回 Composer。
- 增强失败后保留原始版本路径可用，并展示可追踪错误。
