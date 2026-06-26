## Context

Codex provider-scoped runtime 已经支持通过 `providerProfileId` 创建 managed-provider conversation，并把 binding 写入 thread metadata。问题出在 Composer 首发路径：model selector 可以展示 managed provider custom models，但当前 selection resolver 只向发送链路提供 model/source/effort/mode，没有 provider origin。于是用户从 Composer 选择 `Codex / MiniMax-M3` 并直接发送时，创建线程路径无法知道该 model 来自 `MiniMax` provider。

Disk mode 先稳定后再创建 managed-provider 会话更顺，是因为 runtime/catalog/binding 链路已有热态或用户走了显式 provider entrypoint；这不等于 Composer cold-start path 被正确初始化。

## Goals / Non-Goals

**Goals:**

- 将 Codex custom model 的 provider origin 保留到 model option 与 Composer selection resolver。
- 在 Codex 首发创建 thread 时，只在 selection resolver 明确给出 `providerProfileId` 的情况下透传 provider binding。
- 给 create-session loading 增加前端 bounded timeout 和可诊断错误。
- 用 focused tests 覆盖 provider origin propagation 和 timeout 行为。

**Non-Goals:**

- 不新增全局 active provider state。
- 不根据裸 model id 扫描并猜测 provider。
- 不改后端 `thread/start` request timeout 或 provider runtime lifecycle。
- 不改变已有 active thread send、fork、stale recovery 的 provider resolution 优先级。

## Decisions

### Decision 1: provider origin travels with the selected model option

`CodexCustomModel` / `CodexModelOption` 增加可选 `providerProfileId`。`useCodexProviderManagement` 在合并 managed provider custom models 时写入该字段；disk/config-derived model 不携带该字段。

Alternative considered: send 时通过 selected model id 反查 provider catalog。拒绝原因是 model id 不是 provider 唯一键，多个供应商可能都叫同一个 model；冷启动 bug 的核心就是不能把 “选择模型” 偷换成 “猜 provider”。

### Decision 2: Composer selection resolver is the contract boundary

`composerSelectionResolverRef` 增加 optional `providerProfileId`，由 `useAppShellComposerModelSection` 根据当前 selected model option 填充。`useThreadMessaging` 在 `startThreadForMessageSend(activeWorkspace, "codex", ...)` 时透传这个字段。

Alternative considered: 在 thread messaging 内部读取 provider management hook。拒绝原因是 messaging hook 不应该耦合 vendor catalog state；selection resolver 已经是 Composer target summary 与 send path 的共享边界。

### Decision 3: loading timeout is a UI fail-fast guard, not backend protocol change

`useCreateSessionLoading` 对 wrapped action 增加 client-side timeout。timeout 后关闭 loading 并抛出明确错误；底层 promise 若随后完成，也不再保持遮罩。后端 300 秒 request timeout 暂不改动，以免影响慢启动平台和已有长耗时场景。

Alternative considered: 缩短 Rust `DEFAULT_REQUEST_TIMEOUT_SECS`。拒绝原因是 blast radius 大，会改变所有 app-server request 行为；本次目标是防止 UI 卡死和暴露初始化失败。

## Risks / Trade-offs

- [Risk] 某些 custom model item 未携带 provider origin，仍会走 disk default。→ Mitigation: 只有 managed-provider catalog merge 产物写入 `providerProfileId`；无法确认时保持现状而不是误绑。
- [Risk] Timeout 后底层 thread creation 可能晚到成功。→ Mitigation: timeout 只负责关闭 loading 与暴露失败；实际 thread catalog/metadata 后续仍按现有 store 事件处理，不主动删除或回滚后端状态。
- [Risk] 类型扩展影响多个 model option call sites。→ Mitigation: 字段全部 optional，现有调用方无需提供。

## Migration Plan

1. Add optional provider origin fields to Codex custom model option types.
2. Populate origin when composing provider custom model catalog.
3. Thread origin through Composer selection resolver into Codex first-send thread creation.
4. Add bounded timeout to create-session loading wrapper.
5. Validate with focused tests, typecheck, and OpenSpec strict validation.

Rollback: revert the frontend optional-field propagation and loading wrapper timeout change. Disk provider and explicit provider launch paths remain governed by existing backend metadata behavior.

## Open Questions

- None for this change. A future enhancement may add richer diagnostics if a timed-out `thread/start` later succeeds, but that is outside this fix.
