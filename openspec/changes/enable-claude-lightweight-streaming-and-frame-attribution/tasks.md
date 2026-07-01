## 1. P0 / P1b 启用 Claude 轻量流式渲染

- [x] 1.1 新增单点 helper `shouldUseStagedStreamingMarkdown(activeEngine, presentationProfile)`,对 codex/claude 启用,opencode 及其它保持不变(除非 profile 显式开启)。文件:`messagesStreamingComplexity.ts`。
- [x] 1.2 三处门控改用 helper:`shouldUseLightweightStreamingMarkdown`、组件 `streamingMarkdownComplexity` useMemo 门控、`resolveAssistantMessageStreamingThrottleMs`(后者顺带实现 Claude 长内容 staged 降频)。文件:`MessagesRows.tsx`、`messagesStreamingComplexity.ts`。
- [x] 1.3 不改 `presentationProfile` 布尔值,保 `presentationProfile.test.ts` 绿。

## 2. P1a 诊断回调引用稳定

- [x] 2.1 新增 `renderSourceItemsRef`,稳定 `handleAssistantVisibleTextRender` 跨 token 引用;从 useCallback 依赖移除 `renderSourceItems`,回调体内改读 `ref.current`(不复用 `latestItemsRef`)。文件:`Messages.tsx`。

## 3. 掉帧归因监控

- [x] 3.1 `perfContextBridge`:流式态 / 可见行数 / 最近交互上下文单例 + 交互跟踪(passive+capture)。
- [x] 3.2 `frameDropMonitor`:rAF 掉帧监视器(warn/severe + 节流)+ longtask 观测(WebKit 降级)。
- [x] 3.3 `perfDiagnosticsController`:运行时开关 `ccgui.perf.diagnostics`(默认关)编排启停。
- [x] 3.4 `diagnosticsReport.buildDiagnosticsReportText`:汇总可粘贴文本(仅性能标签,无对话内容)。
- [x] 3.5 `rendererDiagnostics`:导出 `exportRendererDiagnostics` + install 接线;`reactScanController` `showFPS`。
- [x] 3.6 `Messages.tsx` 写 `perfContextBridge`;`OtherSection` 加采集开关 + 复制按钮 + i18n(zh/en)。
- [x] 3.7 MON-3:`reactScanController` 接 react-scan `onRender` → `reactScanRenderLog` 记录每次 commit 的组件渲染;掉帧诊断附带 `topRenders`(掉帧前最多重渲染的组件),回答"谁在重渲染"。
- [x] 3.8 MON-5:web-vitals(INP)门控从 build-time 放开到运行时开关(`perfDiagnosticsFlag` 单一来源,避免与 controller 循环依赖),打包版开启采集时可上报。

## 4. 验证

- [x] 4.1 `npm run typecheck` 通过。
- [x] 4.2 监控单测 `perfMonitoring.test.ts` 9/9 通过。
- [x] 4.3 P0/P1 对 messages 测试组零新增回归(stash 对照:7 个失败为 HEAD pre-existing,与本 change 无关)。
- [ ] 4.4 [人类] 打包版 / dev 开启「性能诊断采集」+ react-scan showFPS,复现长 Claude 流式,导出卡顿现场,对比 P0 前后 FPS(目标 6 → 30–50+)。
- [ ] 4.5 [人类] 目视确认 Claude 流式 lightweight 呈现保真、定稿切 full 无损。
- [ ] 4.6 [人类验收后] `openspec validate --strict` 通过并归档,同步 main specs。
