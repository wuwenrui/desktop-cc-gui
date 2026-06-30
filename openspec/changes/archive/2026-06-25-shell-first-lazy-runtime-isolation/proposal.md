## Why

实时对话运行时仍会拖慢新建会话、侧栏点击、顶部 tab、Composer 打字等 Shell control plane 操作。新版功能增多可以接受，但未激活 surface 和后台数据不应在 active streaming 帧里无脑参与计算。

本变更将从架构边界上重做实时性能策略：Shell first，Canvas lazy。Shell 只订阅轻量 summary，Conversation canvas 独立消费大对象与高频事件，未使用 heavy surface 暂停或懒加载其计算。

## 目标与边界

- 目标：实时对话 streaming 时，topbar、sidebar、right panel toolbar、Composer input 等交互区不再依赖完整 conversation items、task runs、approvals、workspace full projections 或 hidden panel data。
- 目标：未打开或不可见的 heavy surfaces 不执行重 projection、render weight、panel dataset、timeline hydration、task surface derivation 等计算。
- 目标：保留当前用户可见功能与已完成的 lane/backpressure 改动，不回退到旧版功能集。
- 边界：本轮优先改 frontend runtime/data subscription；不改 Tauri backend session protocol，不改变 provider 创建语义。

## 非目标

- 不删除 Project Map、Intent Canvas、SpecHub、Git、File、Task Center 等功能。
- 不重写整个 `AppShell` 或一次性完成全部大文件物理拆分。
- 不引入新外部状态管理依赖，除非实现中证明现有 React hook/selector 不能满足。
- 不以牺牲 active conversation 正确性、terminal settlement、history parity 为代价换取体感流畅。

## What Changes

- 新增 Shell-first lazy runtime contract：Shell control plane MUST consume narrow summary slices rather than canvas content objects.
- 修改 AppShell/layout node composition，使 sidebar/topbar/right panel/composer control paths 与 active canvas heavy props 分离。
- 引入或扩展 lazy compute gates：hidden/inactive heavy surfaces MUST pause dataset/projection work and hydrate on activation.
- Conversation canvas host 独立消费 active thread items、timeline projection、render weight、hydration、task runs 等 heavy props。
- 增加 regression tests：active streaming burst 下 unchanged shell controls 不被 canvas-only object churn 触发重计算。
- 保留 existing rollback flags 和 diagnostics，新增 evidence 区分 shell invalidation、canvas projection、hidden-surface work。

## 技术方案对比

- 方案 A：继续调 memo/overscan/scheduler。
  - 优点：改动小。
  - 缺点：只能降低局部开销，不能阻止没用到的 surface 参与计算，无法从根上保证 Shell 优先级。
- 方案 B：引入全局外部 store + selector。
  - 优点：边界最清晰。
  - 缺点：迁移面大，当前仓库未使用同类依赖，风险高。
- 方案 C：在现有 hook 结构内做 Shell-first 分层与 lazy compute gates。
  - 优点：保留现有架构和测试面，先切断最痛的高频依赖，风险可控。
  - 取舍：本变更采用方案 C；若仍不足，再用后续变更把 active canvas store 外置。

## Capabilities

### New Capabilities

- `shell-first-lazy-runtime-isolation`: Shell control plane 与 Conversation canvas content plane 的订阅、懒计算、激活边界。

### Modified Capabilities

- `app-shell-runtime-boundaries`: AppShell runtime boundary 增加 Shell-first narrow summary contract。
- `conversation-realtime-client-performance`: Realtime client performance 增加 hidden surface lazy compute 和 shell invalidation evidence。
- `bundle-chunking-performance`: Lazy boundary requirement 扩展为 lazy compute，不只 lazy import。

## Impact

- Frontend:
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/features/messages/**`
  - `src/features/app/components/**`
  - heavy optional panels and their hooks where activation gates are needed
- Tests:
  - layout node stability tests
  - app shell lazy boundary tests
  - Messages / realtime performance guard tests
  - focused component tests for shell controls
- No Rust/backend API change expected.

## 验收标准

- Streaming active conversation 时，Shell controls 的 props/test counters 不随 canvas-only object churn 重建。
- Hidden ProjectMap/IntentCanvas/BrowserDock/Git detail/File detail/Task surfaces 不执行 heavy dataset/projection work，除非 active or split-visible。
- Composer draft/IME/typing path 继续 immediate；canvas streaming props 只作为 advisory/deferred inputs。
- Existing focused realtime, message, layout, runtime contract tests pass.
- `npm run typecheck`, `npm run lint`, `npm run check:runtime-contracts`, `npm run check:large-files`, `npm run check:heavy-test-noise`, and strict OpenSpec validation pass before closeout.
