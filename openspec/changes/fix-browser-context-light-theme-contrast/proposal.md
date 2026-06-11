# fix-browser-context-light-theme-contrast

## Summary

修复浏览器上下文快照卡在 Windows 浅色主题下文字与状态 badge 对比度不足的问题，确保 `expired/degraded/unsupported` 等非 fresh 状态在 Composer 附件卡和消息摘要卡中保持可读、可区分。

## Problem

浏览器上下文卡片原先将所有非 `available` 状态都渲染成 `stale` 样式，并大量使用 `color-mix(... transparent)` 与浅蓝透明背景。在 Windows WebView2 + 浅色主题/显式 light theme 下，expired 快照卡会被洗淡，标题、计数 chip、操作按钮和状态 badge 难以辨认。

此外，消息摘要卡的 props 未保留 `observation`，历史消息中即使存在 expired observation，也可能退化为 stale/available 展示。

## Goals

- Composer 浏览器上下文预览卡在 Windows system-light 和显式 `data-theme="light"` 下保持足够对比度。
- `expired/degraded/unsupported` 状态 MUST 拥有独立 class 与高对比状态色，不得全部复用 stale 样式。
- 用户可见状态文案 MUST 走 i18n，中文环境显示中文状态。
- 消息摘要卡 MUST 保留 browser observation state，用于历史消息中的真实状态展示。
- 用 focused tests 锁定 expired 状态 class，防止回归。

## Non-Goals

- 不改变 Browser Agent 的采集、刷新、TTL、诊断或 prompt 注入逻辑。
- 不重做 Composer 整体视觉系统。
- 不新增后端 command、Tauri capability 或数据迁移。
- 不引入截图/视觉回归测试框架。

## Approach

1. 在 `BrowserContextPreview` 中添加 browser observation state 到 CSS class 和 i18n label 的显式映射。
2. 在 `BrowserContextSummaryCard` 中保留 `observation` 字段，并使用同类状态 class/label 映射。
3. 为 composer/browser summary 卡片定义状态色 CSS variables，替换过淡的透明混合文字色。
4. 为 Windows system-light 与显式 light theme 添加更实的白底和更高对比 muted/chip 文本。
5. 补齐 en/zh locale 与 Vitest i18n stub。
6. 增加 focused component tests，断言 expired badge 和宿主 card 都带 `is-expired`。

## Risks

- 橙红状态色在不同 light theme 背景上可能显得更醒目；这是有意提高 expired/degraded 可见性的取舍。
- 当前验证环境不是 Windows；仍建议在 Windows WebView2 浅色主题下做一次人工视觉确认。

## Validation

Focused validation:

```bash
npx vitest run src/features/browser-agent/components/BrowserContextPreview.test.tsx src/features/browser-agent/components/BrowserContextSummaryCard.test.tsx
```

Broader validation:

```bash
npm run typecheck
npm run lint
npm run check:large-files
openspec validate fix-browser-context-light-theme-contrast --strict --no-interactive
```
