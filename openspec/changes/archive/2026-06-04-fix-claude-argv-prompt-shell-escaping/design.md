## Context

当前 Claude runtime 在 `src-tauri/src/engine/claude.rs` 中根据输入形态选择输入协议：图片和包含换行的文本走 `--input-format stream-json` + stdin；普通单行文本走 `claude -p <prompt>` argv。issue 线索显示失败诊断为 `input_format=argv`，且用户反馈“使用技能、发送字母或特殊符号都会失败”。

该失败形态与 Windows `.cmd/.bat` wrapper 风险高度吻合：本仓库对 `.cmd/.bat` 通过 `cmd.exe /c <bin>` 启动，后续参数即使由 Rust `Command` 逐项传入，也仍处于 Windows command processor 与 wrapper 的组合边界中。用户 prompt 作为 argv 会暴露给 shell metachar、wrapper parser、Claude argv parser 和 hook 触发链路。相反，stdin 是 Claude CLI 已支持且本仓库已经用于多行/图片输入的成熟路径。

## Goals / Non-Goals

**Goals:**

- Claude prompt 内容不再进入 CLI argv。
- 单行、多行、图片输入共用 stream-json stdin 路径。
- 保持 CLI flags 的显式性：permission、model、effort、session、add-dir、hook events 仍通过 argv。
- 保持现有 stream parser、stderr capture、timeout、turn error、retry 语义。
- 通过测试在非 Windows 环境锁定“prompt 不出现在 argv”的关键兼容边界。

**Non-Goals:**

- 不实现 Windows shell escaping。
- 不重构 `build_command_for_binary`。
- 不改变 custom args 的解析方式。
- 不改变 frontend message shape。
- 不处理 Claude CLI 极旧版本升级策略。

## Decisions

### Decision 1: Always use stream-json stdin for Claude prompt input

选择：让 `should_use_stream_json_input` 对 Claude message send 默认返回 `true`，并保留现有 `build_message_content` 写 stdin 逻辑。

原因：

- 用户 prompt 是不可信数据，不应作为 shell argv 参与 wrapper 解析。
- 现有代码已经能构造 stream-json content，并在多行/图片路径使用。
- 统一路径减少跨平台和跨输入类型分支。

替代方案：

- Windows-only stdin：会让 macOS/Linux 与 Windows 走不同路径，测试和诊断更复杂。
- 特殊字符触发 stdin：字符集合不完备，且用户反馈不只特殊符号失败。

### Decision 2: Keep runtime flags in argv

选择：只把 prompt 内容从 argv 移走；`--permission-mode`、`--dangerously-skip-permissions`、`--model`、`--resume`、`--session-id`、`--add-dir`、`--include-hook-events` 等 runtime flags 继续通过 argv。

原因：

- 这些是产品控制面参数，不是用户自由文本。
- Claude CLI flag contract 本身是 argv API。
- 避免为了本次 bug 扩大到 CLI launch 架构重写。

### Decision 3: Do not add a new escaping utility

选择：不新增 shell escaping helper。

原因：

- shell escaping 是高风险跨平台兼容问题，容易形成假安全。
- stdin 已经从协议层绕开问题。
- 新 helper 会引入额外维护面，违背 YAGNI。

### Decision 4: Test the contract, not Windows environment behavior

选择：用 Rust command-construction tests 断言普通单行和特殊字符 prompt 不出现在 argv，并断言 `--input-format stream-json` 存在。

原因：

- 当前环境无法稳定复现 Windows `.cmd`。
- 真正需要锁定的是“prompt 不进 argv”的跨平台 contract。
- 该测试能在 macOS/Linux CI 提前阻止回退到 argv。

## Risks / Trade-offs

- [Risk] 极旧 Claude CLI 不支持 `--input-format stream-json`。
  → Mitigation：本仓库已依赖该 flag 支持多行/图片输入；若用户 CLI 太旧，应通过 doctor/version 升级路径处理，不在 runtime 中保留不安全 argv fallback。

- [Risk] 单行文本路径从 argv 改 stdin 可能改变 Claude CLI 对 prompt trimming 的细微行为。
  → Mitigation：继续使用既有 `build_message_content`，它已经在 stream-json 路径中 trim 非空文本；测试覆盖文本路径构造。

- [Risk] custom args 中用户自行加入冲突 input-format。
  → Mitigation：本次不改变 custom args 语义；custom args 属于高级配置，若冲突仍按现有规则由配置方负责。

- [Risk] silent `exit 1` 仍可能由 hook/auth/config 引发。
  → Mitigation：本次消除 argv/shell 输入风险；若仍失败，诊断会显示 `input_format=stream-json`，可与 hook/auth/config 问题区分。

## Migration Plan

1. 更新 OpenSpec delta，记录 Claude prompt stdin contract。
2. 修改 Claude runtime input selection，让 message send 默认使用 stream-json stdin。
3. 更新现有 command-construction tests。
4. 新增特殊字符 prompt 不进入 argv 的 regression test。
5. 运行 focused Rust tests 与 OpenSpec strict validation。

Rollback：

- 恢复 `should_use_stream_json_input` 为仅图片/换行返回 true。
- 恢复单行文本 argv 测试断言。

## Open Questions

- 是否需要后续在 diagnostics bundle 中记录 sanitized argv flags 和 Claude CLI version？本次修复不需要，但对后续 issue triage 有价值。
- 是否需要对 custom args 做 conflict detection，例如禁止自定义 `--input-format text`？本次暂不扩大范围。
