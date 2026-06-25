## Why

近期 messages outline floater 接入 live assistant Markdown 后，流式对话出现“输出有顿挫、渲染不丝滑”的体感风险。现有实现功能正确，但 outline callback identity、outline state 写入与 throttled outline extraction 仍会把辅助导航状态带回 streaming render hot path。

目标是在不改变 engine realtime batching、不关闭 outline 功能的前提下，把 outline 变成低频、幂等、可跳过的旁路派生，恢复 live assistant row 的稳定渲染节奏。

## 目标与边界

- 精准修复 messages outline floater 对 live assistant streaming render 的额外渲染压力。
- 保留当前 outline 功能：live message 继续更新目录，最终内容完成后 outline 继续收敛。
- 保留 `Messages` 的 stable snapshot + live row override contract。
- 不改 Codex/Claude/Gemini engine event emission、backend `app-server-event-batch` cadence、turn settlement lifecycle。

## 非目标

- 不重写 Markdown renderer，不把 messages live path 切到 file-preview fast HTML renderer。
- 不删除 outline floater，不做 UI 重新设计。
- 不调整 realtime batching 数字或 backend event sink。
- 不处理非 messages surface 的 file preview outline performance。

## What Changes

- Make live outline callback identity stable across parent renders so `MessageRow` / `Markdown` memo boundaries are not invalidated by function churn.
- Add idempotent outline snapshot updates in `MessagesTimeline`; semantically identical outline payloads must return the previous state reference.
- Cache Markdown outline extraction by visible throttled source identity so same content does not rescan the full message body.
- Add focused regression tests for streaming outline throttling, same-outline idempotency, and final convergence.

技术方案对比：

| 选项 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 关闭 live outline | streaming 期间不传 `onOutlineReady`，完成后再生成 | 最简单，热路径最轻 | 功能退化，违背已归档 `messages-outline-floater` 契约 | 放弃 |
| B. 保留功能但稳定 callback/state/cache | callback 单实例、state 幂等、同源缓存 | 精准解决 render churn，保留功能 | 需要少量 helper 与测试 | 采用 |
| C. 改 realtime batching cadence | 调小/关闭 event batch | 可能改善体感 | 触及 engine/runtime 全局，风险大且不对应本次根因 | 放弃 |

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `messages-outline-floater`: 增加 streaming hot path 约束，要求 outline callback/state 更新保持稳定且幂等。
- `message-markdown-streaming-compatibility`: 收紧 live outline extraction 的 bounded/cache 规则，禁止同一可见源重复扫描。

## Impact

- Frontend code:
  - `src/features/messages/components/MessagesTimeline.tsx`
  - `src/features/messages/components/Markdown.tsx`
  - focused tests under `src/features/messages/components/`
- OpenSpec:
  - delta specs for `messages-outline-floater`
  - delta specs for `message-markdown-streaming-compatibility`
- Dependencies: no new dependencies.
- API compatibility: no public API or backend command changes.

## 验收标准

- Live assistant streaming 时，相同 outline payload 不重复提交 `currentOutline` state。
- Parent rerender 不因 `onOutlineReady` function identity 变化触发额外 outline extraction。
- 同一 throttled Markdown source 重复 effect 时复用 cached outline。
- Final assistant content 的 outline 仍收敛到完整 Markdown headings。
- Focused Vitest suites 与 `openspec validate fix-message-outline-streaming-jank --strict --no-interactive` 通过。
