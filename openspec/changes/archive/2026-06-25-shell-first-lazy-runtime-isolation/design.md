## Context

当前性能问题已经经过两轮局部优化：realtime event backpressure、canvas lane scheduling、Composer/Topbar memo guard、Messages virtualization placeholder clamp。它们降低了部分压力，但用户实测仍然感觉 realtime 对话期间新建会话、按钮点击、Composer 打字不达标。

旧版 `feature/v0.3.11` 的代码考古显示，旧版并没有真正把 Shell 和 Canvas 放到不同线程；它体感更稳的原因是边界更窄：`messagesNode` 用 `useMemo` 包住，heartbeat 用 ref 避免每 tick 重建，DesktopLayout 只接收已组装好的 nodes，Messages 功能也更少。当前版本功能更多，但 `useLayoutNodes` 与 AppShell 仍汇集大量 active/background/full-surface props，导致 canvas stream 会让 Shell 交互区一起失效。

## Goals / Non-Goals

**Goals:**

- Shell control plane 只订阅 narrow summary：active ids、running counts、selected labels、lightweight pressure flags。
- Conversation canvas content plane 独立订阅 active items、timeline projection、hydration、task runs、approvals 等 heavy data。
- Hidden/inactive heavy surfaces 不做 dataset/projection/render-weight 计算，激活时再 hydrate。
- 保留现有用户可见功能和已完成的 realtime correctness contracts。
- 用 tests 固化：canvas-only churn 不应让 shell nodes 和 unopened panels 重算。

**Non-Goals:**

- 不一次性把整个 `AppShell` 大文件拆完。
- 不切换到 Redux/Zustand/Jotai 等新依赖。
- 不改 Rust/Tauri app-server event protocol。
- 不删除 low-frequency surfaces，只改变其 activation/compute 策略。

## Decisions

### Decision 1: 用 Shell summary boundary 先切断高频大对象

采用 `ShellRuntimeSummary`/`ShellInteractionSummary` 这类窄对象，把 sidebar/topbar/right toolbar/Composer control 需要的信息从 canvas full state 中剥离。Shell 不再直接消费 `activeItems`、完整 `threadItemsByThread`、full `taskRuns`、full hidden panel datasets。

Alternatives:
- 继续靠 `memo`：风险低，但失效源太多，不能防止调用方传入新对象。
- 全局 external store selector：边界更强，但迁移成本高；作为后续选项保留。

### Decision 2: Canvas host 拥有 heavy conversation props

新增或调整 `ConversationCanvasHost`/equivalent boundary，使 active conversation 的 `items`、`conversationState`、timeline render weight、hydration、visible rows、task run surfaces 都在 canvas plane 内部处理。Layout 只接收 `canvasNode`，不让这些大对象继续穿过 shell props。

Alternatives:
- 继续在 `useLayoutNodes` 构造所有节点：最少改动，但 Shell 与 Canvas 仍共享失效域。
- 把 Messages 放 Web Worker：React rendering 不能直接进 Worker，短期不可落地。

### Decision 3: Lazy compute > lazy import

已有 ProjectMap/IntentCanvas lazy import 只解决 bundle，不保证隐藏时不计算。本变更增加 activation gates：未激活或不可见 surface 的 hook/dataset/projection 只保留 snapshot 或 minimal summary，不做 heavy work。

Alternatives:
- 只加 `React.lazy`：无法解决已有 hook 在父层执行的问题。
- unmount 所有 hidden surface：最省 CPU，但会丢 UI 状态；本轮优先 pause compute + snapshot。

### Decision 4: 测试先守住边界，不伪造绝对 FPS

JS unit tests 不适合保证真实设备 FPS，但可以精确保证依赖边界：unchanged shell row 不重渲染、hidden surface dataset function 不调用、canvas-only prop churn 不重建 shell nodes。真实体感仍由用户手测确认。

## Risks / Trade-offs

- [Risk] Shell summary 不完整导致 UI 漏状态 → Mitigation: 保留 focused tests，逐个迁移 sidebar/topbar/composer/right toolbar 所需字段。
- [Risk] Hidden surface activation 首次打开有轻微 hydrate 延迟 → Mitigation: 只暂停 heavy compute，保留 lightweight snapshot 和 loading state。
- [Risk] 过度拆分导致大量 adapter 代码 → Mitigation: 优先在现有 hook 内创建 typed boundaries，不引入新依赖。
- [Risk] Realtime correctness 回归 → Mitigation: 必跑 realtime boundary/replay/reducer/message focused suites 和 heavy-test-noise。

## Migration Plan

1. 建立 Shell summary 类型和 pure projection helpers。
2. 在 `useLayoutNodes` 中把 Shell node 和 Canvas node 的数据依赖分开。
3. 给 ProjectMap/IntentCanvas/BrowserDock/File/Git/Task 等未激活路径增加 lazy compute gates。
4. 给 Composer、Topbar、Sidebar、PanelTabs 增加 canvas-only churn guard tests。
5. 跑 focused suites，再跑完整 gate。

Rollback:
- 保留现有 `useLayoutNodes` public output shape；如回滚，仅恢复 boundary 内部调用，不改变外部布局 API。
- Lazy compute gates 使用 explicit active flags，可逐个 surface 回退。

## Open Questions

- 是否需要下一阶段把 active canvas state 迁移到 `useSyncExternalStore` selector store？本轮先不做，除非现有 hook 边界仍无法达标。
- 是否要加入浏览器长任务 API 的自动性能测试？本轮先保留 diagnostics，不引入新端到端工具。
