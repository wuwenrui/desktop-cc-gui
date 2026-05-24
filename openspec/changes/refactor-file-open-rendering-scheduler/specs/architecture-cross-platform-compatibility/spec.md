## MODIFIED Requirements

### Requirement: Platform Compatibility Evidence MUST Accompany High-Risk Batches

触及 Win/Mac 高风险路径的批次 MUST 提供显式兼容性证据，而不是只依赖单平台通过；文件打开渲染调度重构若触及 path、filesystem watch/polling、scroll measurement、drag/drop 或 keyboard modifiers，也属于高风险路径。

#### Scenario: win and mac evidence is recorded for high-risk extraction
- **WHEN** 批次触及 shell、process、path、terminal、runtime launch、filesystem 或 wrapper fallback
- **THEN** 变更记录 MUST 包含 Windows 与 macOS 的 smoke evidence 或等价验证结果
- **AND** 若当前环境无法覆盖其中一端，记录 MUST 明确缺口、残余风险与待补路径

#### Scenario: platform-specific deviation remains explicit and bounded
- **WHEN** 某个行为因平台差异必须保留分支
- **THEN** 该差异 MUST 在 capability 或 design 中被显式说明
- **AND** 差异 MUST 保持 bounded，不得扩散为 unrelated feature branch

#### Scenario: file render scheduling preserves platform path identity
- **WHEN** 文件打开渲染调度重构新增或改写 path normalization、tab identity、document snapshot key、render cache key 或 external sync comparison
- **THEN** Windows-style separators、case variants、macOS absolute/restored paths and workspace-relative paths MUST resolve to the same logical file identity where the current platform rules require it
- **AND** implementation MUST NOT rely on hardcoded separators, case-sensitive-only identity, or single-platform newline assumptions

#### Scenario: snapshot line indexes preserve platform newline behavior
- **WHEN** document snapshots build line counts, line offsets, or bounded line access for Windows/macOS files
- **THEN** CRLF, LF, and mixed newline content MUST preserve correct visible line numbers and navigation targets
- **AND** newline normalization MUST NOT change saved content, dirty comparison, or external conflict behavior

#### Scenario: virtualized file surfaces preserve Win/Mac input semantics
- **WHEN** code preview or file tree rendering becomes virtualized
- **THEN** scroll, pointer, context menu, drag/drop, macOS `Meta` multi-select, and Windows `Ctrl` multi-select behavior MUST remain equivalent to the pre-refactor behavior
- **AND** any platform-specific exception MUST be documented with a bounded fallback and validation note

#### Scenario: external monitor scheduling preserves platform error classification
- **WHEN** external watcher or polling refresh is gated by stable snapshot or render-pressure scheduling
- **THEN** Windows missing-path, sharing-violation, and macOS watcher/polling events MUST keep their existing missing/transient/error classification semantics
- **AND** scheduling MUST NOT convert a platform filesystem condition into a silent data-loss path
