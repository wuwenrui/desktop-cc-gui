## Context

当前客户端已经有若干局部性能保护：

- `Messages` 已有 stable timeline snapshot + live row override，用于避免长 streaming 时 parent timeline-heavy derivations 每个 delta 全量重算。
- `Composer` 已对部分 live props 使用 `useDeferredValue`，并在 active typing 期间延后 context usage / rate limit / stream activity 等 advisory state。
- `ChatInputBoxAdapter` 已有自定义 comparator，覆盖 context usage、dual context、Claude context usage、account rate limits、部分 string arrays。
- `MessagesTimeline` 已接入 TanStack virtualizer，但当前 thinking 状态下 virtualization 被关闭。
- workspace session catalog 已有 shared projection 概念，但部分 frontend/backend 调用仍使用大 page size、related attribution 宽口径、prewarm/hydration 级联。

用户反馈的真实症状集中在更热的交互路径：

- 实时对话期间，对话框打字卡顿。
- 长 streaming 输出时，Composer、按钮、滚动响应下降。
- 切换会话不丝滑，点击后 UI transition 被 history restore、sidebar projection、catalog hydration 抢占。
- settings/session management 优化不足以覆盖上述 runtime hot path。

约束：

- 必须遵守现有 `Messages Streaming Render Contract` 和 `Composer Input Responsiveness Under Streaming Load`。
- 不改变 conversation reducer 的 canonical message identity、ordering、terminal settlement。
- 不改变 session membership truth，只优化获取、调度、缓存和展示层重算。
- 不引入大规模状态框架迁移。

## Goals / Non-Goals

**Goals:**

- 把用户可感知交互拆成可测预算：input latency、render commit、thread switch visible latency、catalog request pressure、long task evidence。
- 将 Composer 输入 source-of-truth 与 streaming advisory state 明确分轨。
- 将 status panel / subagent / thread status projection 从 Composer render hot path 中降频或索引化。
- 将会话切换拆成 foreground commit 与 deferred hydration 两阶段。
- 将 sidebar/session folder projection 做 workspace-scoped memoization，减少 active row/status pulse 造成的全树重建。
- 将 session catalog first page、related attribution、Radar prewarm 改成 bounded / staged / deduped。
- 让所有性能优化都有 kill switch 或局部回滚策略。

**Non-Goals:**

- 不重写 `app-shell.tsx` 为新架构。
- 不改变 engine runtime streaming protocol。
- 不改变 `related` / `workspace-only` 的业务语义。
- 不用隐藏真实内容、延迟 input text、丢弃 live assistant text 来换取假性能。
- 不把 jsdom 代理测试当成最终 release-grade 性能证据。

## Decisions

### Decision 1: 以 hot path 分层，而不是按文件清单优化

将优化拆为六层：

1. Composer input layer：draft text、IME、selection、attachments、send payload。
2. Composer advisory layer：context usage、rate limits、stream activity、status panel、queue/request indicators。
3. Conversation render layer：live assistant row、timeline grouping、anchors、sticky、boundary、scroll work、streaming controls。
4. Thread switch layer：active workspace/thread selection、engine selection、history restore、layout mutation。
5. Sidebar projection layer：thread rows、folder tree、running/recent counts、expanded state。
6. Session catalog layer：backend pagination、related attribution candidate scan、source status、prewarm.

理由：用户体感卡顿来自这些层共同抢主线程。按文件加 memo 会遗漏跨层依赖，且难以定义验收。

### Decision 2: Composer input source-of-truth 绝不进入 deferred path

`text`、composition state、selection、attachments、imperative handle、submit payload 必须保持 immediate。只允许对 advisory props 使用 deferred / transition / cache。

替代方案是把整个 Composer 放进 deferred path。该方案会让输入内容本身延迟或 selection 回退，违反项目 state-management contract。

### Decision 3: Status panel projection 使用 scoped index 或 deferred summary

当前 `useStatusPanelData` 可通过 `itemsByThread` 和 `threadParentById` 收集相关 subagent/collab tool entries。深入优化时应避免 active typing + streaming 每个 delta 重建 fallback parent map、遍历全部 threads。

可接受策略：

- 按 root thread 构建 scoped projection cache。
- 将 `itemsByThread` 预索引成 `toolEntriesByThreadId` / `fallbackParentById`。
- 在 active typing window 使用 last-good status summary，streaming idle 后收敛。

不可接受策略：

- 在 `ChatInputBox` render 中直接扫描全部 workspace threads。
- 为了降低成本删除 status panel 信息或改变 subagent navigation truth。

### Decision 4: Thread switch 使用 foreground-first transition

点击会话时，foreground 必须优先完成：

- active workspace/thread id
- main chat shell/header active state
- target thread lightweight cached snapshot or loading shell

以下操作应进入 `startTransition`、idle queue 或 staged async path：

- right panel collapse / layout-heavy mutation
- engine inference that requires scanning thread list
- history restore / refreshThread
- workspace thread list hydration
- related catalog prewarm
- sidebar non-active workspace projection refresh

快速连续切换时，所有 async restore/hydration 必须带 request token 或 scope guard，stale response 不得覆盖当前 thread。

### Decision 5: Sidebar projection 以 workspace 为 memo boundary

Sidebar 不应因 active thread change 或 single processing pulse 重算全部 workspace folder tree。应按 workspace 拆分 projection：

- `threadRowsByWorkspace[workspaceId]`
- `folderProjectionByWorkspaceId`
- `moveTargetsByWorkspaceId`
- `running/recent count by workspaceId`
- active row state 使用 primitive ids 传递到 row level

替代方案是给整个 Sidebar 加更大的 `memo`。这无法阻止内部 projection 每次 render 重算，也会掩盖依赖漂移。

### Decision 6: Session catalog 必须是真分页或显式 capped partial

`SESSION_CATALOG_PAGE_SIZE = 9_999` 是伪分页，会在大历史 workspace 下把 first-page 变成全量请求。优化应改为：

- frontend first page 使用小 page size。
- backend 支持 cursor / ordered candidate cap / source scan cap。
- 无 native cursor 的 engine 返回 partial/degraded evidence。
- filter keyword 使用 debounce + transition。
- related attribution 结果按 workspace/mode/filter/source 缓存并 dedupe。

### Decision 7: Thinking 状态下的 timeline virtualization 要谨慎分阶段

当前 `shouldVirtualizeTimelineRows` 在 thinking 时关闭 virtualization，主要是为了保护 live row 和 scroll intent。深入优化不应直接打开全量 virtualization，而应先验证：

- live row override 是否保持最新文本。
- active assistant row 是否会被虚拟化回收。
- auto-follow / selection / copy / message anchor 是否保持。

可先采用 content-visibility、middle steps collapse、active row chunk measurement、scroll work throttle，再决定是否允许 thinking virtualization 的受控子场景。

### Decision 8: Streaming controls 保持 immediate action path

Stop、message toolbar、copy/fork/rewind、context controls、scroll interaction 属于用户即时交互，不应依赖 timeline grouping、status projection、catalog hydration 或 sidebar projection 完成。

可接受策略：

- runtime-critical enabled/disabled state 来自 canonical runtime/control state。
- 非关键视觉 summary 可 deferred，但不得阻止 click handler 注册和触发。
- control action 执行后，deferred visual summary 在 idle 或 turn settlement 后自然收敛。

不可接受策略：

- Stop control 使用 deferred advisory snapshot 决定是否吞掉点击。
- message toolbar handler 绑定依赖每 delta 全量 timeline recomputation。
- 为了降低 render 成本隐藏或延迟注册用户可点击控件。

### Decision 9: 性能证据分级

证据分级：

- `measured`: Browser/Tauri/WebView profiler、React Profiler、PerformanceObserver long task、真实或可运行的 E2E scenario。
- `proxy`: Vitest/jsdom render count、pure helper complexity test、fixture latency approximation。
- `manual-only`: 人工录屏/观察，无可重复指标。
- `unsupported`: 当前环境无法采集，必须说明下一步。

Archive 或 release-grade 结论必须至少有 measured evidence；proxy 只能作为回归防线。

## Risks / Trade-offs

- [Risk] deferred advisory props 显示略滞后 → Mitigation: 只延迟非 send-critical props，turn settled 后强制自然收敛。
- [Risk] status panel cache 显示旧 subagent 状态 → Mitigation: active typing window 使用 last-good，idle/settled 后刷新；navigation target 仍来自 canonical state。
- [Risk] thread switch foreground-first 让后台数据稍后出现 → Mitigation: 使用 lightweight loading shell 和 stale guard，不用空白页掩盖。
- [Risk] sidebar memoization 依赖过窄导致 UI 不更新 → Mitigation: 为 active row、processing pulse、folder overrides、expanded state 添加 focused tests。
- [Risk] catalog page size 降低后用户看不到旧会话 → Mitigation: 保留 Load older、next cursor、partial source marker 和 search older 行为。
- [Risk] thinking virtualization 破坏 live row → Mitigation: 分阶段验证，先加 evidence，不直接全开。
- [Risk] profiler 指标在不同机器漂移 → Mitigation: 记录相对基线和分类，不用单一绝对数值作为唯一通过条件。

## Migration Plan

1. 建立基线证据：记录当前 streaming typing、thread switch、sidebar projection、catalog request 的 measured/proxy 数据。
2. Composer advisory props 稳定化：扩展 comparator、减少对象重建、验证 input source-of-truth。
3. Status panel scoped projection：拆出 pure helper/cache/index，替换 render hot path 全量扫描。
4. Thread switch foreground-first：将非关键 mutation 和 hydration 分层调度，补 stale guard tests。
5. Sidebar workspace-scoped projection：按 workspace memoize folder/thread projections，限制 active row 更新范围。
6. Session catalog bounded fetch：降低 page size、支持 cursor/cap/degraded evidence、filter debounce。
7. Messages streaming render 二次验证：确认 timeline-heavy derivations 没回热路径，验证 streaming controls 仍可即时响应，再评估 thinking virtualization 子场景。
8. 汇总证据并执行 OpenSpec validation、focused tests、typecheck、必要 Rust tests。

Rollback 策略：

- 每层优化单独可回滚。
- Comparator/cache/index 优化可回退到 baseline render，但保留 diagnostics。
- Thread switch staged hydration 可回退到同步路径，但 stale guard 不应回退。
- Catalog bounded fetch 可通过配置恢复较大 page size，但 partial/degraded source evidence 保留。

## Open Questions

- 需要确定 Tauri/WebView 环境下可稳定采集的 input latency 与 React commit duration 工具链。
- thinking 状态下是否允许对非 live row 开启 virtualization，需要先用 fixture 和 browser evidence 验证。
- Status panel 的 subagent projection 是否已有可复用 domain index，还是需要新增 feature-local helper。
