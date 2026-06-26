## REMOVED Requirements

### Requirement: Rendered User Sections SHALL Pin During Realtime Processing
**Reason**: 用户已要求删除“用户气泡吸顶条”相关代码，realtime processing 不再渲染 condensed sticky user header。
**Migration**: 当前 turn 的普通用户消息可以继续作为 timeline row 渲染；长输出定位依赖消息锚点和正常滚动，不再生成吸顶 header。

### Requirement: User Question Pinning SHALL Recover To Normal Scrolling Outside Realtime
**Reason**: realtime-only sticky guarantee 被移除后，不再存在 recovery/transition state。
**Migration**: Realtime 与 restored history 均使用普通 timeline scrolling。

### Requirement: User Question Pinning SHALL Be Display-Only
**Reason**: display-only sticky pinning presentation 被删除。
**Migration**: Copy、runtime、history loader contracts 保持绑定原始消息行，不新增 runtime/storage/event 字段。

### Requirement: Live User Question Pinning Regression Coverage MUST Stay Display-Only
**Reason**: sticky pinning 行为删除后，不再维护该 focused regression suite。
**Migration**: Focused tests 改为覆盖普通消息窗口裁剪、用户消息仍正常渲染，以及不再出现 sticky user header。
