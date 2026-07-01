## 技术方案

### P0 / P1b:单点 helper 解耦引擎门控

历史门控公式 `presentationProfile?.useCodexStagedMarkdownThrottle ?? activeEngine === 'codex'` 在三处重复:
1. `shouldUseLightweightStreamingMarkdown`(是否走 lightweight surface)
2. 组件内 `streamingMarkdownComplexity` useMemo 门控(是否计算复杂度)
3. `resolveAssistantMessageStreamingThrottleMs`(是否用 staged 节流降频)

若只放开其一会失配(如放开 lightweight 但复杂度早退返回 EMPTY,则 `!complexity.trimmedText` 又挡回)。因此抽取单点 helper:

```ts
export function shouldUseStagedStreamingMarkdown(activeEngine, presentationProfile): boolean {
  if (presentationProfile?.useCodexStagedMarkdownThrottle === true) return true;
  return activeEngine === "codex" || activeEngine === "claude";
}
```

三处统一调用。语义:codex(profile=true 或引擎)→ true;claude(引擎)→ true;opencode / 其它(profile=false 且引擎不匹配)→ false,与旧行为一致。**不修改 presentationProfile 的布尔值**,以保持 `presentationProfile.test.ts` 的 per-engine 断言全绿。

lightweight 消费端(Markdown.tsx:`liveRenderMode === 'lightweight'` 跳过 normalize 链、改用 LightweightMarkdown + progressiveReveal)不分引擎,codex 已在生产验证,对 claude 通用。定稿 `isStreaming=false` 时 `shouldUseLightweightStreamingMarkdown` 返回 false → full 渲染,保证最终保真。

### P1a:稳定诊断回调引用

`handleAssistantVisibleTextRender` 的 useCallback 依赖含每 token 换新数组的 `renderSourceItems`,导致回调每 token 换引用。新增 `renderSourceItemsRef`(render 期同步赋值),回调体内改读 `ref.current`,并从依赖移除 `renderSourceItems`。**不复用 `latestItemsRef`(= 未 windowing 的原始 items)**,以免 codex finalizing 分支的 `targetTextLength` 语义漂移;ref 同步赋值读取不滞后一帧,诊断语义无损。

### 掉帧归因监控

- `perfContextBridge`:module 单例,存流式态 / 可见行数(Messages effect 写)+ 最近交互(passive+capture 监听),供采集器在掉帧瞬间同步读取。不 import rendererDiagnostics,避免循环依赖。
- `frameDropMonitor`:rAF 循环测帧间隔,>50ms warn / >100ms severe,节流(500ms 最短间隔 + 上限)后写 `perf.frame-drop`;longtask 用 `PerformanceObserver`(`supportedEntryTypes` 探测,不支持记一次 unsupported 并降级)。底层 `appendRendererDiagnostic` 无 build-time 门控,打包版可用。
- `perfDiagnosticsController`:运行时开关 `ccgui.perf.diagnostics`(默认关),编排启停;启动时 `installRendererLifecycleDiagnostics` 内动态 import 调用。
- `diagnosticsReport.buildDiagnosticsReportText`:汇总最近性能相关条目为可粘贴文本(仅性能标签,无对话内容)。
- 设置页开关 + 「复制卡顿现场」按钮(clipboard,失败降级 Blob 下载);react-scan `showFPS: true`。

### 风险与回归

- lightweight 保真度:codex 已用,定稿切 full 兜底;需人工目视确认。
- bottom-follow:progressiveReveal 改变内容增长节奏,但 codex 已用同路径且自动跟随正常,属已验证模式;不碰虚拟化开关与滚动逻辑。
- 测试:typecheck 通过;监控单测 9/9;P0/P1 对 messages 测试组零新增回归。HEAD 已存在 7 个 conversation 折叠 / lightweight-mode 测试失败,经 stash 对照确认与本 change 无关。
