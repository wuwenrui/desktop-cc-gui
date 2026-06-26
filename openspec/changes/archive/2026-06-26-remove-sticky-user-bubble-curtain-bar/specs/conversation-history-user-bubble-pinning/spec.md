## REMOVED Requirements

### Requirement: History Browsing SHALL Pin The Current Ordinary User Question As A Section Header
**Reason**: 用户已要求删除“用户气泡吸顶条”相关代码，completed history 不再需要顶部 sticky user question header。
**Migration**: 普通用户消息继续保留在正常消息流中；长对话定位继续依赖消息锚点、滚动位置和原始消息行。

### Requirement: Sticky Handoff SHALL Follow Physical Scroll Position Only
**Reason**: sticky user question header 被移除后，不再存在需要 handoff 的 pinned header ownership。
**Migration**: 保留普通滚动行为；不再计算 sticky handoff candidate。

### Requirement: History Sticky Pinning SHALL Exclude Non-Ordinary User Rows
**Reason**: sticky pinning 入口删除后，非普通用户行不再参与 sticky candidate 计算。
**Migration**: 非普通用户行继续按既有 timeline presentation rules 渲染或过滤。

### Requirement: History Sticky Pinning SHALL Remain Presentation-Only And Respect Realtime Priority
**Reason**: history sticky header 删除后，不再需要该 presentation-only pinning priority contract。
**Migration**: 普通消息渲染和 realtime/history data contracts 保持不变。

### Requirement: History Sticky Header MUST Not Obscure Lightweight Mode Chrome
**Reason**: sticky header DOM 与 CSS 被删除后，不再存在遮挡 lightweight mode chrome 的风险面。
**Migration**: Lightweight mode chrome 继续按自身布局规则显示。
