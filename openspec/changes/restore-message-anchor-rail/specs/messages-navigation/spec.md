## ADDED Requirements

### Requirement: Messages view MUST provide a left-edge anchor rail for user turns

系统 MUST 在会话消息区左缘提供锚点导航条：收起态为按用户消息逐条排布的刻度尺，悬浮展开为可点击的大纲面板，点击 MUST 平滑滚动定位到对应用户消息，当前视口内的锚点 MUST 高亮。

#### Scenario: rail renders user-only anchors

- **GIVEN** 会话含 2 条及以上用户消息
- **WHEN** 消息区渲染完成
- **THEN** 左缘 MUST 出现锚点刻度尺，刻度数等于用户消息数（助手消息不产生锚点）
- **AND** 会话仅有 0-1 条用户消息时 MUST NOT 显示导航条

#### Scenario: hover expands outline and click jumps

- **GIVEN** 锚点导航条已渲染
- **WHEN** 用户悬浮导航条
- **THEN** MUST 展开大纲面板并显示各用户消息的首行摘要
- **AND** 点击某行 MUST 平滑滚动到该消息并收起面板
