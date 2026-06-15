# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 1 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Evidence / 证据先行

- [x] 记录当前 `useComposerEditorState`、ChatInputBoxAdapter / ChatInputBox value path、`MessagesRows.tsx` 的 subscription / render chain，并明确 `useComposerEditorState` 当前只管理 `textareaHeight`。
- [x] 为 Composer 与 MessageRows 增加 dev/test-only render diagnostics，不记录用户正文。
- [x] 跑一次 `npm run perf:composer:baseline` 作为变更前 proxy anchor。

## Implementation / 实施

- [x] 基于 diagnostics 收窄真实 Composer value path 的订阅范围；若热点不在 `useComposerEditorState`，不得为“隔离”而重写该 hook。
- [x] 复用现有 `useIMEComposition` / `useControlledValueSync`，补齐 streaming 干扰下的 composition guard。
- [x] 将 input history hydration 调整为 first render 后后台加载，并在 thread switch / unmount 后丢弃 stale result。
- [x] 为 `MessagesRows` live row、history row、sticky indicator 建立稳定 id / version / sourceVersion props。
- [x] 将高成本派生 map/set/projection 按 sourceVersion memoize。
- [x] 只对证据显示高频 rerender 的 row subtype 增加 memo boundary，避免一次性重写全部 subtype。
- [x] 扩展 `runtime-performance-evidence-gates` 的 composer / message-row budget 字段。

## Validation / 验证

- [x] IME composition 回归测试：streaming 干扰下 `compositionstart` / `compositionend` 顺序与最终 value 正确。
- [x] Input history hydration stale-drop 测试。
- [x] MessageRows streaming fixture：live row 可 rerender，history row render count 在 budget 内。
- [x] Diagnostics content-safety 测试：不包含 prompt / assistant body / tool output。
- [x] `npm run perf:composer:baseline`
- [x] `npm run perf:realtime:boundary-guard`
- [x] `npm run check:runtime-evidence-gates`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `openspec validate composer-and-message-row-render-budget --strict --no-interactive`
