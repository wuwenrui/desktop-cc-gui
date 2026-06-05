## MODIFIED Requirements

### Requirement: Live Assistant Markdown MUST Preserve Inline Code Boundaries During Partial Streaming

在 assistant 实时输出尚未完成时，系统 MUST 保持 inline code span 的 backtick 边界稳定；对于 closing backtick 尚未到达的 partial syntax，系统 MUST NOT 把相邻正文错误并入 code span。

#### Scenario: unmatched opening backtick does not swallow adjacent prose

- **WHEN** assistant live message 已收到 opening backtick，但 closing backtick 仍未到达
- **THEN** 系统 MUST NOT 因 fragmented merge、paragraph normalization 或即时 markdown reparse 把后续相邻正文错误归入 inline code span
- **AND** 当前可见内容 MUST 以 raw/stable fallback 或等价保护方式展示，而不是产生错误的 code-span 归属

#### Scenario: delayed closing backtick converges to the intended inline code

- **WHEN** assistant live message 在后续 delta 中补齐 closing backtick
- **THEN** 系统 MUST 收敛到预期的 inline code span 结构
- **AND** code span 外的前后正文 MUST 保持为普通正文，而不是遗留先前的错位解析结果

#### Scenario: tool-call XML after unmatched opening backtick stays protected

- **WHEN** assistant live markdown contains an unmatched opening inline-code backtick followed by literal `<function_calls>` or `<invoke>` XML text
- **THEN** tool-call fallback segmentation MUST treat the text from that opening backtick through the current streaming fragment end as a protected region
- **AND** that literal XML MUST remain Markdown text instead of rendering as a tool-call fallback card
