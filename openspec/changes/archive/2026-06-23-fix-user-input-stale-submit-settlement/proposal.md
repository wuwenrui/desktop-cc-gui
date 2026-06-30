## Why

Claude `AskUserQuestion` / `RequestUserInput` 卡片在 5 分钟 runtime timeout 后，backend 已经清理 pending request，但 frontend 仍可能保留卡片。用户随后点击 Submit、Skip 或关闭 settlement 时会看到 `提交失败`，形成不可操作的 stale UI。

## 目标与边界

- 目标：过期 request 的后续用户操作如果被 runtime 判定为 stale / unknown / timeout-settled / workspace disconnected，frontend MUST 释放 pending card 和 optimistic processing residue。
- 目标：普通 submit failure 仍保留卡片，允许用户修正后重试。
- 边界：只修复 stale settlement 识别与本地 UI 释放，不修改 Claude backend 5 分钟 timeout 策略。

## 非目标

- 不调整 `AskUserQuestion` 的 300 秒等待上限。
- 不改变 `respond_to_server_request` payload contract。
- 不引入新的用户输入卡片样式或文案重构。

## What Changes

- 扩展 user input stale settlement classifier，覆盖超时后 Submit / Skip 等路径。
- 当 timeline 卡片本地倒计时已到 `0:00` 且 settlement 被识别为 stale 时，本地移除卡片而不是展示 fatal submit failure。
- 保留非 stale submit failure 的 retry 行为。

## 方案取舍

- 方案 A：延长 backend timeout。优点是减少过期概率；缺点是不能解决窗口已 stale 后的 UI 残留，并且改变 runtime 行为边界。
- 方案 B：frontend 针对 stale settlement 做幂等释放。优点是范围小、契约清晰、符合现有 spec；缺点是需要谨慎区分普通 submit failure。

选择方案 B。本次问题的根因是 frontend 对 stale response 的终态处理不完整，而不是 5 分钟策略本身错误。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-chat-canvas-user-input-elicitation`: Clarify stale settlement behavior for timed-out Submit / Skip interactions.

## Impact

- Frontend hook: `src/features/threads/hooks/useThreadUserInput.ts`
- Frontend component: `src/features/app/components/RequestUserInputMessage.tsx`
- Focused tests for stale settlement and retryable submit failures.

## 验收标准

- 0:00 后点击 Submit，若 runtime 返回 stale 类错误，卡片从 pending queue 移除且不显示 `提交失败`。
- 0:00 后点击 Skip / dismiss，若 runtime 返回 stale 类错误，卡片从 pending queue 移除且不显示 `提交失败`。
- 普通 bridge/backend submit failure 仍保留卡片并允许重试。
- Focused Vitest 和 OpenSpec strict validation 通过。
