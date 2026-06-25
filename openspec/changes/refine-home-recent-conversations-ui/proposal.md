## Why

首页最近会话当前以 flat chips 或 grouped surface 形式展示时，都会在首屏和主 Composer 抢焦点，且现阶段 project grouping 的体验仍不成熟。现在先从首页删除该入口，只保留创建会话的主路径；最近会话能力后续再用更完整的信息架构重做。

## 目标与边界

- 目标：删除首页最近会话展示区，降低首屏视觉噪音。
- 边界：仅调整 `HomeChat` 页面 UI、样式、文案与 focused tests。
- 非目标：不修改 Sidebar、Session Management、workspace session catalog backend、thread list membership 或任何会话数据源。

## What Changes

- 从首页 `HomeChat` 删除最近会话 section。
- 删除本页面 recent conversations 的 CSS surface。
- 保留父层 props contract，避免把删除展示层扩散为上游重构。
- 更新 focused tests，断言即使传入 recent conversations，首页也不渲染该入口。

## 技术方案取舍

| Option | Decision | Reason |
|---|---|---|
| 直接删除首页最近会话 | Accepted | 当前 UI 无法接受，删除能立刻恢复首屏干净度，且不影响其他会话入口。 |
| 重构为 project-grouped inline surface | Rejected | 仍会占据 Composer 下方视觉焦点，当前体验未达标。 |
| 接入完整 workspace session catalog | Deferred | 更符合长期 membership truth，但超出“只调整这个页面”的范围，且会引入跨层风险。 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-home-shadcn-ux`: 首页不再展示最近会话入口；Recent 能力后续需要重新设计后再回归。

## Impact

- Frontend only:
  - `src/features/home/components/HomeChat.tsx`
  - `src/styles/home-chat.css`
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`
  - `src/features/home/components/HomeChat.test.tsx`
- No new dependency.
- No backend/API/storage contract change.

## 验收标准

- 即使 `HomeChat` 收到 `latestAgentRuns`，首页也不渲染最近会话区。
- 首页不存在 recent conversation loading surface。
- 主 Composer 区域保持原有布局。
- Focused Vitest 与 TypeScript check 通过。
