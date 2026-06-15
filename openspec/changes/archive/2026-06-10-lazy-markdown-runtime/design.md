# Design / 设计

## Renderer Modes / 渲染模式

| Mode | Trigger | Dependencies |
|---|---|---|
| `live-lightweight` | streaming plain text / simple code / syntax-incomplete chunks | no full remark/rehype stack |
| `readable-fallback` | full renderer loading or syntax unstable | plain readable text with safe escaping |
| `full-markdown` | completed message or complex Markdown | `react-markdown`, remark/rehype, math/sanitize plugins |

## Complexity Trigger / 复杂度触发

Full renderer should load when content is final or contains complex markers such as tables, math delimiters, raw HTML, rich fenced blocks, Mermaid, or other features requiring the full pipeline.

## Safety Rule / 安全规则

Raw HTML or potentially unsafe Markdown MUST NOT bypass sanitization. If full renderer has not loaded, render safe text fallback until sanitization-capable renderer is ready.

## Convergence / 收敛

Completed live messages and history restore must converge to equivalent final Markdown semantics. The transition from lightweight to full renderer must not append the same cumulative body twice.

## Evidence / 证据

Evidence should include startup import graph / bundle output showing full Markdown stack is not in startup path, plus regression tests for simple live streaming and complex completed messages.
