## Why

Claude Code 会话在单行 prompt、skill 触发词、字母或特殊符号输入下出现 `input_format=argv` 的静默 `exit 1`。当前实现只有多行文本或图片才走 stdin，单行文本作为 CLI argv 传入；在 Windows `.cmd/.bat` wrapper 经 `cmd.exe /c` 启动时，shell metachar 可能被解释，导致用户输入不再是原始 prompt。

本次变更需要把 Claude prompt 输入契约从“按内容形态选择 argv/stdin”收敛为“默认通过 stream-json stdin 传输用户输入”，降低平台 wrapper、shell quoting、skill/slash 文本和特殊字符造成的启动失败。

## 目标与边界

- 目标：
  - 让 Claude Code runtime 对普通文本、特殊字符、slash/skill 触发词、多行文本和图片使用一致的 stdin 输入路径。
  - 避免用户 prompt 内容出现在 Claude CLI argv 中，降低 Windows wrapper 和 shell quoting 风险。
  - 保留现有 access mode、model、reasoning effort、session resume/fork、external spec root 与 custom args 的 CLI flag 映射。
  - 让失败诊断继续明确记录实际 input format，便于追踪是否仍有 argv 路径残留。
  - 用 Rust focused tests 锁定单行 prompt、特殊字符 prompt 和多行 prompt 的命令构造。
- 边界：
  - 仅修改 Claude Code runtime launch/input path。
  - 不改变 frontend `engine_send_message` payload schema。
  - 不改变 Claude access mode UI 或权限语义。
  - 不新增依赖，不引入 shell escaping 自研实现。

## 非目标

- 不修复或重构所有 Windows `.cmd/.bat` wrapper 调用。
- 不修改 Codex / Gemini / OpenCode 的输入协议。
- 不改变 Claude CLI 的 auth、settings、doctor 或 binary resolution 策略。
- 不尝试在本次变更中复现全部 Windows 环境；通过平台无关的 argv contract tests 约束风险路径。
- 不移除 existing custom args；但 custom args 仍由配置方负责提供有效 CLI flags，不用于承载用户 prompt。

## What Changes

- Claude Code message runtime 默认使用 `--input-format stream-json` 并把 prompt 内容写入 stdin。
- 单行文本不再作为 `claude -p <prompt>` 的 argv 参数传入。
- 图片和多行文本继续使用既有 stream-json content builder，不改变内容结构。
- 错误诊断中的 `input_format` 会反映新的默认路径，预期从 `argv` 变为 `stream-json`。
- Rust tests 会覆盖：
  - 单行 prompt 使用 stream-json。
  - 特殊字符 prompt 不出现在 argv。
  - 多行 prompt 继续使用 stream-json。
  - 现有 permission/access mode flag 映射不回退。

## 技术方案对比

### 方案 A：对 argv prompt 做 Windows shell escaping

- 优点：
  - 改动局部，保留当前单行 argv 快路径。
- 缺点：
  - `cmd.exe` escaping 规则复杂，且 `.cmd` wrapper、PowerShell、direct `.exe` 语义不同。
  - prompt 是非受信任用户输入，做 escaping 等于维护一套高风险 shell quoting 实现。
  - skill/slash/custom hook 触发链路仍可能被 argv parser 或 wrapper 影响。
- 结论：
  - 不采用。用户输入不应走 shell argv 是更稳的 first principle。

### 方案 B：仅检测特殊字符时切换 stdin

- 优点：
  - 对普通单行文本保持旧行为，理论上改动面更小。
- 缺点：
  - 特殊字符集合不完备，Windows `%VAR%`、`!VAR!`、Unicode、slash command、skill 名称等边界容易漏判。
  - issue 新线索提到“字母或特殊符号”都可能失败，按字符白名单无法解释全部 case。
  - 长期会形成两套输入路径，后续诊断和兼容成本更高。
- 结论：
  - 不采用。条件分流会制造新的隐性边界。

### 方案 C：Claude prompt 全量走 stream-json stdin（采用）

- 优点：
  - 用户 prompt 不进入 argv，直接消除 shell metachar 和 wrapper quoting 风险。
  - 与图片、多行输入路径一致，减少 runtime 分支。
  - Claude CLI 已支持 `--input-format stream-json`，本仓库也已有该路径和测试基础。
  - 不需要改 frontend payload，不影响 access mode / session / model flags。
- 缺点：
  - 依赖 Claude CLI 对 stream-json input 的稳定支持；旧版 Claude CLI 若不支持该 flag，会更早暴露为明确兼容问题。
  - 单行文本失去 argv 快路径，但性能影响可忽略。
- 结论：
  - 采用。该方案最符合输入安全和跨平台兼容原则。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `claude-code-realtime-stream-visibility`: 增加 Claude Code runtime launch 输入契约，要求用户 prompt 默认通过 stream-json stdin 进入 CLI，避免 argv/shell wrapper 破坏输入。

## Impact

- Affected backend:
  - `src-tauri/src/engine/claude.rs`
  - `src-tauri/src/engine/claude/tests_stream.rs`
- Affected specs:
  - `openspec/changes/fix-claude-argv-prompt-shell-escaping/specs/claude-code-realtime-stream-visibility/spec.md`
- Affected runtime behavior:
  - Claude Code 普通单行 prompt 从 argv input 切换为 stream-json stdin input。
  - CLI permission、session、model、external spec root、hook events flags 继续走 argv flags。
- Compatibility:
  - frontend/backend IPC payload 不变。
  - 旧会话历史读取不变。
  - custom args 保留现状。
  - 对不支持 `--input-format stream-json` 的极旧 Claude CLI，失败会以 CLI flag 兼容问题暴露；当前产品已长期依赖该 flag 支持图片/多行输入。

## 验收标准

- 单行 Claude prompt MUST 使用 `--input-format stream-json` 并通过 stdin 发送。
- 用户 prompt 原文 MUST NOT 出现在 Claude CLI argv 中，包括包含 `& | < > ^ % ! ( )` 等特殊字符的文本。
- 多行文本与图片输入 MUST 保持既有 stream-json stdin 行为。
- Access mode 映射 MUST 保持稳定：`full-access` 仍映射 `--dangerously-skip-permissions`，`read-only` 仍映射 `--permission-mode plan`，`default` 仍映射 `--permission-mode default`。
- Session resume/fork/session-id、model、effort、external spec root 和 hook events flags MUST 不因输入路径修改而丢失。
- 聚焦 Rust 测试 MUST 覆盖命令构造和特殊字符 prompt 不进 argv。
- `openspec validate fix-claude-argv-prompt-shell-escaping --strict --no-interactive` MUST 通过。
