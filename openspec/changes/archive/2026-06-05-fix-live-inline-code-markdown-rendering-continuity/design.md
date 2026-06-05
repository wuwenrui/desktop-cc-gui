## Design

### Existing Contract

主 spec 已要求 live assistant Markdown 在 partial inline code syntax 下保持边界稳定：unmatched opening backtick 不得把相邻正文错误归入 code span，normalization/segmentation 必须把 inline code 视为 protected region。

### Regression Source

`parseToolCallBlocks(...)` 是 Markdown renderer 内的 shared segmentation path。它会在普通 Markdown 文本中查找 residual `<function_calls>` / `<invoke>` XML 并替换为 fallback card。该 parser 已经标记 fenced code block 和 closed inline code span，但对 unclosed inline code delimiter 选择 `continue`，导致 streaming 片段中的 literal XML 仍可被后续 opening-tag scan 命中。

### Chosen Fix

当 inline code closing run 未找到时，parser 将 `[openingBacktick, text.length)` 标记为 protected region，并终止 inline scan。这样符合 streaming 语义：当前片段尚未闭合时，后续内容都属于“语法未稳定区域”，fallback detector 不应做结构化提升。

### Safety

该改动只影响 trigger XML 出现在 unclosed inline code delimiter 之后的场景。正常 closed XML block、bare invoke、antml variants、streaming incomplete tool-call block仍保持原行为。

### Rollback

若该保护过宽，可回滚到 parser-level closed-span-only 行为；但需要保留 renderer regression test 作为失败证据，避免误判为普通 tool-call fallback 回归。
