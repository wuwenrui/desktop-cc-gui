## Why

重启客户端后，Composer 首发创建 Codex managed provider 会话时，model selection 与 provider runtime selection 没有形成同一条 contract：用户选择了 provider custom model，但创建线程可能仍按 disk default provider 初始化，导致首段文本等待长时间卡住或进入错误 runtime。

同时，创建会话 loading 目前跟随后端默认 request timeout，失败前可能等待数分钟；这会把 provider 初始化错误伪装成“Codex 已启动，正在等待首段文本...”，削弱可诊断性。

## 目标与边界

- 让 Codex Composer 首发会话能够从已选择的 managed-provider custom model 推导唯一 `providerProfileId`，并传入创建线程路径。
- 让创建会话 loading 有前端 bounded timeout 和可见失败态，不再无限遮罩等待。
- 保持 disk mode 默认行为不变；无法唯一推导 provider 时显式回落现有默认路径，不猜测。
- 保持已有 provider-bound thread、fork、stale recovery、catalog refresh 逻辑不被重写。

## 非目标

- 不引入新的全局 active Codex provider。
- 不改变后端 provider-scoped runtime key、`CODEX_HOME` materialization 或线程 metadata schema 的既有含义。
- 不重构整个 Composer model selector 或 thread messaging 流程。
- 不缩短后端 app-server / `thread/start` 的协议级 timeout；本次只补客户端 UX bounded wait。

## What Changes

- Codex custom model catalog item 将携带可选 `providerProfileId`，用于 Composer 选择态到 thread creation 的反向映射。
- Composer selection resolver 将暴露 `providerProfileId`，Codex 首发新会话时透传给 `startThreadForMessageSend`。
- 若同一个 model id 被多个 managed providers 定义，系统不得凭 model id 猜 provider；只有 selector 当前项携带唯一 provider binding 时才透传。
- 创建会话 loading 将增加前端 bounded timeout，超时后关闭 loading 并抛出可诊断错误，避免 UI 长时间卡死。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-provider-scoped-session-launch`: Codex Composer 首发创建会话 MUST preserve selected managed provider binding when the selected model carries a provider profile.
- `composer-model-selector-config-actions`: Codex custom model options MUST retain provider origin metadata through hydrated model catalogs.
- `composer-send-readiness-ux`: create-session loading MUST fail visibly after a bounded client timeout rather than masking initialization failure indefinitely.

## 技术方案取舍

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| A. 只按 selected model id 查 provider | 在发送时扫描 providers 的 customModels，匹配 model id 后补 providerProfileId | 实现短，但 model id 可能跨 provider 重复；冷启动时会把选择态变成猜测，风险不可接受。 |
| B. 在 model option 层保留 provider origin | custom model merge 时携带 `providerProfileId`，Composer selection resolver 读取当前选中项的 origin | 改动稍多，但 contract 清晰；无法唯一时自然不透传，保留 disk fallback。 |
| C. 改成全局 active provider | 选模型时同步设置全局 provider，再由创建会话读取 | 违背 provider-scoped session launch 的核心设计，会影响已有会话与并发 provider。 |

本变更选择 B。

## 验收标准

- 重启后直接在 Composer 选择 `Codex / <managed provider custom model>` 并首发消息，新线程创建请求 MUST 带上该 managed provider 的 `providerProfileId`。
- 选择 disk/config-derived Codex model 或无法确定 provider origin 的模型时，首发路径 MUST 维持当前默认行为。
- 创建会话 promise 超过 bounded client timeout 后，loading MUST 关闭，并给出包含操作名/timeout 的诊断错误。
- 现有 provider-bound stale recovery 和 fork 路径继续显式使用 thread metadata provider binding。

## Impact

- Frontend:
  - `src/features/composer/types/provider.ts`
  - `src/features/vendors/hooks/useCodexProviderManagement.ts`
  - `src/app-shell-parts/useAppShellComposerModelSection.ts`
  - `src/app-shell.tsx`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/app-shell-parts/useCreateSessionLoading.ts`
- Tests:
  - Focused tests for custom model provider origin propagation and create-session loading timeout behavior.
- Backend:
  - No Rust protocol or runtime process behavior change expected.
