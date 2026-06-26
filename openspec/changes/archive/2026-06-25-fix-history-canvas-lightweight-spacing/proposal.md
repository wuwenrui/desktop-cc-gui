## Why

历史会话进入 lightweight mode 后，heavy row 内容已经被摘要化，但 virtualized row 仍可能沿用旧的 heavy measured height，导致幕布出现大段空白；同时顶部 lightweight mode banner / history sticky header / message rows 分属不同布局 contract，展开“显示之前 n 条消息”后会出现上下抖动、顶部操作卡片被裁剪、内容重叠等问题。

后续验证确认：根因不是单个 CSS 间距，而是历史展开时混用了 `scrollHeight delta` 视口恢复、absolute virtual canvas、以及 timeline root 外层顶部操作面板。需要把历史展开收敛成稳定的 document-flow 渲染策略，而不是继续叠加 offset patch。

## 目标与边界

- 修复 completed history canvas 的 lightweight mode spacing，让摘要行、virtualizer 占位高度和顶部 chrome 一致压缩。
- 修复点击 `show earlier history` / “显示之前 n 条消息”后的历史展开抖动、空白、顶部卡片裁剪和内容重叠。
- 让顶部 lightweight operation bar、history sticky header 与 timeline rows 共享同一 `messages-full` padding contract。
- 保持现有 conversation data、history loader、runtime event、backend command contract 不变。
- 保持 lightweight mode 的性能目标：不为了消除空白而 hydrate 所有 heavy rows。

## 非目标

- 不重写 message row / tool row / Markdown 具体渲染逻辑。
- 不改变 live streaming progressive render contract。
- 不调整历史会话筛选、分组、loader 或 provider 归一化逻辑。
- 不新增外部依赖。

## What Changes

- Lightweight summary row 渲染时使用 compact virtualized placeholder height，避免继承 heavy row 旧测量高度。
- Lightweight mode / detail hydration 切换时触发 bounded remeasure，使 virtualized canvas 总高度收敛。
- 将 lightweight mode banner 收敛为 compact mode bar，减少高度和垂直 margin。
- 点击 `show earlier history` 后切入稳定 expanded-history document flow，不再对手动展开执行 `scrollHeight delta` 视口恢复。
- expanded history 不再使用 absolute-positioned virtual canvas；heavy rows 在 lightweight mode 下仍可保持 summary 渲染，避免一次性 hydrate 全量重内容。
- 将 lightweight mode banner 与 history sticky header 移入 `messages-full`，删除 timeline root top inset 与 sticky `+36px` 这类补丁式 offset。
- 增加 focused regression tests 锁定 compact placeholder 与顶部 chrome 不重叠。

## 技术方案对比

### 方案 A：只调 CSS margin/padding

- 优点：改动最小。
- 缺点：无法解决 virtualizer 旧 measured height 撑出 320px 空洞的根因；不同历史会话仍会复现。
- 结论：不采用。

### 方案 B：轻量行专用 compact measurement path

- 优点：直接修复 content 与 virtualization layout contract 不一致的问题；不需要 hydrate heavy rows。
- 缺点：需要在 `MessagesTimeline` 中区分 lightweight rendered row，并补测试防止回退。
- 结论：部分采用。它解决单行高度问题，但不足以覆盖历史展开后的抖动、裁剪和重叠。

### 方案 C：expanded history 稳定 document-flow 策略

- 优点：把 `show earlier history` 后的布局从 absolute virtual canvas 切回普通文档流，移除手动展开时的 `scrollHeight delta` 恢复，并让顶部操作面板与 rows 共享同一 padding contract；一次解决抖动、空白、顶部裁剪和重叠。
- 缺点：手动展开后 viewport 会回到 revealed history head，而不是维持原视口位置；但这符合“显示之前 n 条消息”的用户意图。
- 结论：采用。jump-to-message 的隐式展开仍由 anchor scroll 接管定位。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-live-message-canvas-rendering`: message timeline virtualization 在 lightweight history rows 下必须压缩 stale measured height。
- `conversation-live-message-canvas-rendering`: expanded history 必须使用稳定 document flow，不能继续使用 absolute virtual canvas 或手动 `scrollHeight delta` 视口恢复。
- `conversation-history-user-bubble-pinning`: history sticky header 不能覆盖 lightweight mode chrome，且必须与 lightweight operation bar 共享 `messages-full` 顶部布局 contract。

## Impact

- Affected frontend code:
  - `src/features/messages/components/MessagesTimeline.tsx`
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/messagesTimelineVirtualization.ts`
  - `src/styles/messages.part1-shell.css`
  - `src/styles/messages.history-sticky.css`
  - `.trellis/spec/frontend/messages-streaming-render-contract.md`
- Affected tests:
  - Focused Vitest coverage under `src/features/messages/components/**`
- APIs / dependencies:
  - No Tauri API changes.
  - No backend changes.
  - No dependency changes.

## 验收标准

- Lightweight history summary row 不再因旧 heavy measurement 出现大段空白。
- Lightweight mode bar 与 history sticky header 同屏时不互相覆盖。
- 点击 “显示之前 n 条消息” 后不再出现上下抖动、内容重叠或顶部操作卡片被裁剪。
- expanded history 退出 absolute virtual canvas；manual reveal 回到 revealed history head，jump reveal 继续由 anchor 定位。
- Detail hydration 仍可恢复 full row rendering。
- Focused tests、typecheck 和 OpenSpec strict validation 通过。
