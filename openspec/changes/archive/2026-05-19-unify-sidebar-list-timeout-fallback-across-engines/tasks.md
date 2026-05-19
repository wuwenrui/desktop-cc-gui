# Tasks

任务粒度遵循 OpenSpec config 约束：每项可在 2 小时内完成，含明确输入/输出/验证方式。任务编号即依赖顺序，未标 `parallel` 的下游任务依赖上游。

## 1. Specification

- [x] 1.1 编写 `specs/sidebar-list-timeout-fallback/spec.md` delta，ADDED 4 个 Requirement，每个含 2-3 个 Scenario，覆盖：(a) OpenCode listing timeout 保留 last-good；(b) OpenCode listing reject 保留 last-good 并发出诊断；(c) 通用 seed 引擎参数化契约（含 Gemini/Codex 不纳入主链路的设计契约）；(d) 连续 OpenCode timeout 不递减。
    - **验收**：`openspec validate unify-sidebar-list-timeout-fallback-across-engines --strict --no-interactive` 通过。

## 2. Test-First (TDD Red)

- [x] 2.1 新建 `src/features/threads/hooks/useThreadActions.opencode-timeout-fallback.test.tsx`，复用既有 `useThreadActions.timeout-fallback.test.tsx` 的 hook 渲染脚手架（`renderActionsWithMutableThreadState`、`getLatestSetThreadsDispatch`、`NEVER_RESOLVES`）并新增 `makeCachedOpenCodeSummary` fixture。
    - **验收**：测试文件可独立加载，beforeEach 完成全部依赖 mock，4 个 case 在实现前全部红。
- [x] 2.2 写 case 1（OpenCode timeout + Codex 仍有数据）失败用例，期望 `visibleSummaries` 包含 last-good 全部 OpenCode 条目。
    - **验收**：`npx vitest run src/features/threads/hooks/useThreadActions.opencode-timeout-fallback.test.tsx` 红，错误信息明确指向缺失 OpenCode 条目（`expected [ 'codex-1' ] to include 'opencode:oc-a'`）。
- [x] 2.3 写 case 2（OpenCode rejected + Codex 仍有数据）失败用例，期望 last-good OpenCode 条目保留 + `rememberPartialSource("opencode-session-error")` 被调用 + `onDebug` 收到 `thread/list opencode error` 事件。
    - **验收**：红，错误信息指向 OpenCode 条目缺失。
- [x] 2.4 写 case 3（连续两次 OpenCode null）失败用例，期望第二次的 last-good 仍是首次完整 OpenCode 列表（自污染防御回归）。
    - **验收**：红，错误信息指向第二次 last-good 已被污染（`expected [] to deeply equal ArrayContaining{…}`）。
- [x] 2.5 写 case 4（archived last-good OpenCode 不被 seed 复活）回归用例，验证 retainable 过滤路径正确。OpenCode 正常 + 其他子源 null 的回归路径由既有 `useThreadActions.test.tsx`（46 case）覆盖，故本测试文件不重复实现。
    - **验收**：红，错误信息指向 live OpenCode 条目缺失。

## 3. Implementation (Green)

- [x] 3.1 在 `useThreadActions.helpers.ts` 新增 `isRetainableEngineContinuitySummary(engine, summary)` 通用函数 + `PENDING_PREFIXES_BY_ENGINE` 映射 + `isPendingEngineThreadId` 私有 helper；既有 `isRetainableClaudeContinuitySummary` / `isRetainableCodexContinuitySummary` 改写为薄包装；引入 `EngineSource = NonNullable<ThreadSummary["engineSource"]>` 类型别名收紧入参。
    - **依赖**：1.1, 2.2-2.5。
    - **验收**：`useThreadActions.helpers.test.ts` 7 case 全绿；既有 Codex / Claude retainable 调用点行为不变。
- [x] 3.2 在 `useThreadActions.helpers.ts` 新增 `seedLastGoodEngineIntoMerged(engine, mergedById, lastGood, excluded)` 通用函数，engine 联合类型仅 `"claude" | "opencode"`（从类型层挡 Gemini/Codex 误用）；既有 `seedLastGoodClaudeIntoMerged` 改写为薄包装；新增 `seedLastGoodOpenCodeIntoMerged` export 薄包装。
    - **依赖**：3.1。
    - **验收**：既有 `useThreadActions.timeout-fallback.test.tsx` 4 case 零退化。
- [x] 3.3 改 `useThreadActions.ts` OpenCode timeout 分支（`opencodeResult.value === null`）：在 `rememberPartialSource("opencode-session-timeout")` 与 `onDebug` 之后调用 `seedLastGoodOpenCodeIntoMerged(mergedById, lastGoodThreadSummaries, hiddenSharedBindingIds)`。
    - **依赖**：3.2。
    - **验收**：case 1（OpenCode timeout + Codex 仍有数据）转绿。
- [x] 3.4 改 `useThreadActions.ts` OpenCode 子结果处理分支：补全缺失的 `else (rejected)` 分支，结构对称 Claude reject 分支：`rememberPartialSource("opencode-session-error")` + `onDebug({ label: "thread/list opencode error", ... })` + `seedLastGoodOpenCodeIntoMerged(...)`。
    - **依赖**：3.3。
    - **验收**：case 2（OpenCode rejected）转绿。
- [x] 3.5 检视 `isRetainableCodexContinuitySummary` 既有调用路径（仅 `mergeDegradedCodexContinuitySummaries` 一处），确认改写为薄包装后行为完全一致；Codex pending 检查迁移到 `PENDING_PREFIXES_BY_ENGINE`，删除原 `isPendingCodexThreadId` 死代码。
    - **依赖**：3.1。
    - **验收**：`useThreadActions.test.tsx` 46 case 全绿，无 Codex 相关回归。

## 4. Validation

- [x] 4.1 运行 `openspec validate unify-sidebar-list-timeout-fallback-across-engines --strict --no-interactive`。
    - **验收**：`Change ... is valid`，0 error，0 warning。
- [x] 4.2 运行 `npx vitest run src/features/threads/hooks/useThreadActions.opencode-timeout-fallback.test.tsx`。
    - **验收**：4/4 绿。
- [x] 4.3 运行 `npx vitest run src/features/threads/hooks/useThreadActions.timeout-fallback.test.tsx`（既有 Claude 用例零退化）。
    - **验收**：4/4 绿，无新增 skip。
- [x] 4.4 运行 `npx vitest run src/features/threads/hooks/useThreadActions.test.tsx + useThreadActions.helpers.test.ts`。
    - **验收**：53/53 全绿。
- [x] 4.5 运行 `npm run typecheck`。
    - **验收**：0 error；薄包装与 engine 联合类型签名通过。
- [x] 4.6 运行 `npm run lint`（受影响文件）。
    - **验收**：0 error。
- [x] 4.7 运行 `npx vitest run src/features/threads src/features/session-activity src/features/app`（受影响周边模块的回归）。
    - **验收**：143 个测试文件 / 1501 case 全绿。

## 5. Manual QA

- [ ] 5.1 启动 mossx dev build，工作区下应有 ≥2 条 OpenCode 会话 + ≥1 条 Claude / Codex 会话；打开应用后等待 90 秒；OpenCode 列表 MUST 保持完整。
    - **验收**：肉眼观测列表数与启动时一致。
- [ ] 5.2 临时把 OpenCode 子源 `withTimeout` 第二参数改为 `1`（强制超时），重启验证 fallback 路径；恢复后再次验证。
    - **验收**：强制超时下列表仍保持完整 + Debug 面板看到 `thread/list opencode timeout` 事件。
- [ ] 5.3 临时让 `getOpenCodeSessionListService` 抛 `throw new Error("synthetic")`，重启验证 reject 路径。
    - **验收**：列表保留 last-good + Debug 面板出现 `thread/list opencode error` 事件 + `rememberPartialSource("opencode-session-error")` 触发。
- [ ] 5.4 验证 Claude 既有兜底未被退化：临时把 Claude 子源 `withTimeout` 改为 `1`，验证 Claude 列表仍保持完整。
    - **验收**：与 1f2f87f1 之后的行为一致。

## 6. Review Hardening

- [x] 6.1 自审：`seedLastGoodEngineIntoMerged` 在 `mergeCodexCatalogSessionSummaries` 之前调用；若 catalog 重组路径会洗掉 seed 的 OpenCode 条目，需在 catalog merge 之后再补一次。
    - **验收**：case 1 在打开 catalog 路径开关时仍绿；通过阅读 `mergeCodexCatalogSessionSummaries` 源码确认 OpenCode 条目不会被洗。
- [x] 6.2 自审：`isRetainableEngineContinuitySummary` 的引擎分支判定 MUST NOT 把 Codex/Gemini 的 degraded 标记当成 OpenCode 的问题（避免 cross-engine 污染）。
    - **验收**：补一个 mixed-engine fixture（Claude healthy + Codex degraded + OpenCode last-good），验证 OpenCode seed 不受 Codex degraded 影响。
- [x] 6.3 自审：薄包装 `seedLastGoodClaudeIntoMerged` 行为 100% 等价于原实现（即 `engine="claude"` 分支）。
    - **验收**：把 `useThreadActions.timeout-fallback.test.tsx` 跑两遍：第一遍调用旧函数名，第二遍直接调用通用函数，结果一致。

## 7. Archive Prep（不在本次执行）

- [x] 7.1 实现合并到 develop 后，运行 `openspec archive unify-sidebar-list-timeout-fallback-across-engines --strict`。
    - **执行时机**：合并 PR 之后，由维护者执行。
- [x] 7.2 归档同时 sync delta 到 `openspec/specs/sidebar-list-timeout-fallback/spec.md`。
    - **执行时机**：随 archive 自动完成。
