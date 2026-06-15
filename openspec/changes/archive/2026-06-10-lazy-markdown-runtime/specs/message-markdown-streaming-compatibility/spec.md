## MODIFIED Requirements

### Requirement: Live Assistant Markdown Rendering MUST Use Bounded Stabilization For Syntax-Incomplete Streams

对于 syntax-incomplete 的 assistant live markdown，系统 MUST 使用 bounded stabilization window、lightweight live renderer、readable fallback 或等价策略，避免对每个高频中间片段都立即执行 full semantic markdown pipeline。

#### Scenario: high-frequency partial deltas do not force full markdown reparsing

- **WHEN** assistant live message 高频接收仍处于 syntax-incomplete 状态的 markdown deltas
- **THEN** 渲染路径 MUST NOT synchronously load or execute the full `react-markdown` / remark / rehype parser pipeline for every intermediate fragment
- **AND** 该策略 MUST 保持 progressive reveal 的 readable surface

#### Scenario: completed assistant message flushes final stable markdown immediately

- **WHEN** assistant turn 进入 completed 或等价最终态
- **THEN** 系统 MUST load or reuse the full Markdown renderer when final content requires GFM, math, raw HTML sanitization, Mermaid, file links, or equivalent rich features
- **AND** 用户 MUST NOT 继续停留在仅用于 live partial syntax 的临时保护态

#### Scenario: raw html waits for sanitization-capable renderer

- **WHEN** live or completed Markdown contains raw HTML or content requiring sanitization
- **THEN** the system MUST render a safe fallback until the sanitization-capable full renderer is available
- **AND** it MUST NOT render unsafe HTML through the lightweight live path.
