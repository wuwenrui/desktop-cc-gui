## Why

前序 change `harden-conversation-rendering-for-large-history`(Issue #721)已实现 lightweight streaming markdown、heavy-island、hydration budget 等机制,但流式轻量渲染通过 `presentationProfile.useCodexStagedMarkdownThrottle` **只对 codex 引擎启用**。应用主引擎 **Claude** 因此在流式期间恒走 full react-markdown 全量重解析(mdast → remark → rehype → rehypeRaw → rehypeSanitize → rehypeKatex → createElement,无跨渲染缓存):每个节流窗对整段回答 O(n) 重跑,随流式线性增长累计 O(n²)。几万字符单次解析约 100–190ms > 一帧预算,主线程被占满 → 对话页持续 4–6 FPS、单帧 ~190ms,react-scan 标记为 "JavaScript 占大头"。这是 Issue #721 一类症状里**主引擎实际未吃到硬化收益**的遗留缺口。

同时,现有监控(react-scan + renderer diagnostics)在打包版(WKWebView)拿不到 per-render 计时,也没有 rAF 掉帧检测、掉帧上下文快照与一键导出,用户能看到掉帧却无法定位与反馈。

## What Changes

- 把"流式轻量 markdown 渲染"的启用判定与 `activeEngine === 'codex'` 解耦:新增单点 helper `shouldUseStagedStreamingMarkdown`,对 codex 与 claude 启用,opencode 及其它引擎保持不变(除非 presentationProfile 显式开启)。Claude 流式达到 medium / structured-heavy 复杂度即走 lightweight + progressiveReveal,定稿(isStreaming=false)切回 full;并连带启用 staged streaming throttle 对长内容降频。
- 稳定 `handleAssistantVisibleTextRender` 的跨 token 引用(新增 renderSourceItemsRef),避免 live 行诊断回调每 token 换新引用。
- 新增运行时性能诊断采集(默认关,与 react-scan overlay 开关平级):rAF 掉帧监视器、longtask 观测(带 WebKit 降级)、最近交互 / 流式状态上下文桥;均基于无 build-time 门控的 `appendRendererDiagnostic`,打包版可用。
- 设置页新增「性能诊断采集」开关与「复制卡顿现场」导出按钮(clipboard,失败降级下载);react-scan overlay 增加 showFPS。

## 目标与边界

- 目标:让主引擎 Claude 的流式 markdown 渲染成本 bounded,消除每节流窗对整段文本的 O(n) 全量重解析。
- 目标:让掉帧在打包版可被记录、附带上下文、一键导出,便于用户反馈与 P0 前后回归对比。
- 边界:复用现有 lightweight streaming / streaming-complexity / renderer-diagnostics 基础设施,不重写 message renderer。
- 边界:不触碰 timeline 流式虚拟化开关(`TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED` 保持 false)与 bottom-follow 滚动逻辑。

## 非目标

- 不改 conversation reducer state shape / message identity / history ordering。
- 不引入强制的全局 lightweight;只在流式期按复杂度切换,定稿恢复 full 保真。
- 不承诺 WebKit 一定支持 longtask PerformanceObserver;不支持时静默降级到 rAF。
- 不在本 change 内修复 HEAD 已存在的 conversation 折叠 / lightweight-mode 相关测试回归(属前序重构遗留,另行处理)。
