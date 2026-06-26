## MODIFIED Requirements

### Requirement: Codex Local Session Replay Preserves Tool Card Semantics

`Codex` 历史恢复若使用本地 session replay，MUST 继续保持 `commandExecution` 与 `fileChange` 工具卡片的实时语义。

#### Scenario: shell-backed file mutations survive codex local replay

- **WHEN** `Codex` 本地 session 历史包含成功的 `exec_command` 调用
- **AND** command text itself contains a recognized file mutation signal such as shell redirection write, append redirection, narrow create token, or delete command
- **THEN** 历史恢复后的工具卡片 MUST be reconstructed as `fileChange`
- **AND** the reconstructed file-change facts MUST include the target file paths inferred from the command text
- **AND** output-only status text, test logs, or `git status` output MUST NOT by itself promote a read-only command to `fileChange`
- **AND** temporary patch artifact writes such as `.diff` / `.patch` files MUST NOT be treated as source file changes unless the corresponding patch is actually applied.
