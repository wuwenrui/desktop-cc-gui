# Change: 2026-06-24-infer-thread-rename-from-claude-codex-jsonl

## Why

用户经常在 Claude Code / Codex CLI 内通过 `/rename` 给会话取一个有意义的标题,但回到 ccgui 侧栏时看到的还是 JSONL 第一条 user message 的截断文本(或 `<command-name>/rename</command-name>` 的残片),找会话不方便。ccgui 已经维护自己的一套 custom name / mappedTitle 持久化,但它与 CLI 的事实源(jsonl)是隔离的——CLI rename 后 ccgui 不知道。

修复这个问题最直接的做法是:ccgui 在解析 Claude / Codex 的 jsonl summary 时,把 `/rename` 命令的 args 作为次级 title 源,在没有 GUI 自定义名 / mappedTitle / autoName 的情况下显示出来。Rust 端解析一次 jsonl 就够,不引入额外 IO、不破坏现有 first_message 路径。

不引入这条逻辑的代价是:CLI 改名对用户来说在 ccgui 里"看不见"——他们得在 GUI 里再 rename 一次,或者靠 first_message 预览去找会话。

## What Changes

- 在 Claude / Codex 的 Rust 解析路径增加 `cli_rename_alias: Option<String>` 字段,从 jsonl 内最近一条 `/rename` 命令的 args 提取(最后一条胜出)。
- 把 `cli_rename_alias` 作为**与 `title` 平行的独立字段**透传到 `WorkspaceSessionCatalogEntry`(serde skip_if_none,向后兼容)。
- 在 frontend `useThreadActions.ts` 的 Claude / Codex thread 合并链中,把 `cliRenameAlias` 作为新的 fallback 源插入到 `customName || mappedTitle || preview` 链中。OpenCode 路径**不引入 alias**,保持现状。
- 不回写 jsonl、不回写到 ccgui 的 `thread_titles_core`、不动 GUI 内 rename 契约。
- 不覆盖 OpenCode / Gemini 的对应能力(OpenCode 暂未发现 jsonl 内的 `/rename` 形态,Gemini 的 summary 来源另有契约)。

## 目标与边界

让 ccgui 在 sidebar / Session Management 列表中复用 Claude Code / Codex CLI 在原 jsonl 里通过 `/rename` 留下的"自定义会话名"。

具体来说:

- 当用户**没有在 ccgui 内**对某个 Claude / Codex 会话做过 rename(`thread_titles_core` 与 in-memory `customNames` 都没有命中)时,系统 MUST 回看该会话对应 jsonl 的最后一条 `/rename` 命令,把 args 里带的字符串作为可见的会话名来源。
- 在有 GUI 自定义名时仍以 GUI 自定义名为准,jsonl 推导出的 rename alias 是**次级**来源,位置介于 first-message preview 之上、custom/mapped title 之下。
- 任何一端后续又出现更强的 title 源(用户在 GUI 内 rename、ccgui mapped title 写入、`autoName` AI 自动命名)时,rename alias 不得回弹覆盖。

本次变更只覆盖 Claude Code / Codex CLI 两条路径;OpenCode / Gemini 暂不在范围内。

## 非目标

- 不会**回写** jsonl:ccgui 不主动把自身的 title 改写进 CLI 的原 jsonl,避免破坏 CLI 自有事实源。
- 不会**自动同步**到 ccgui 自己的 `thread_titles_core` 表:rename alias 是次级 source、只参与 sidebar 渲染,不会让 ccgui 的"自定义名"在重启后继续生效(用户没在 GUI 内确认过)。这一点留给后续 change。
- 不会改动 `autoName` / `setThreadTitle` / `renameThreadTitleKey` 等 GUI 侧 rename 行为契约。
- 不覆盖 OpenCode / Gemini 的对应能力。
- 不动 OpenCode 路径现有的 precedence(`mappedTitle || customName`),即使它与 Claude / Codex 不一致——统一 OpenCode 的 precedence 属于另一个 follow-up scope。

## 当前问题

`claude-session-sidebar-state-parity` 与 `codex-session-sidebar-state-parity` 已经在 spec 级别定义:

- Claude sidebar title 的 precedence 必须稳定("stronger title source may upgrade weaker title source"、"settings and sidebar agree on title")。
- Codex sidebar title 同样有 stable precedence("stronger title source may upgrade weaker title source")。

但当前 Rust 解析路径在拿到 jsonl 时**只**从首条真实 user message 截取 `first_message` / `summary`:

- Claude:`src-tauri/src/engine/claude_history.rs:745-820` 的 `scan_session_source_file` 把第一条非 meta、非 `internal-record` 的 user message 当成 `first_real_user_message`,并被 `to_summary` 落到 `ClaudeSessionSummary.first_message`(`claude_history.rs:183-201`)。frontend `claudeHistoryLoader.ts:467` 把含 `<command-name>` 的 message 标记为 `internal-record` 跳过,但这是 transcript 渲染层的分类,**不影响** Rust 端 `first_real_user_message` 的提取。
- Codex:`src-tauri/src/local_usage.rs:853-1190` 的 `parse_codex_session_summary` 从 `response_item -> payload -> message` 的第一条 `role=user` 截取 `summary`,不会单独检查 `/rename` 命令。

`/rename` 命令的实际 jsonl 形态:

- Claude(`~/.claude/projects/.../*.jsonl`):`{"type":"user","message":{"role":"user","content":"<command-name>/rename</command-name>\n            <command-message>rename</command-message>\n            <command-args>foo</command-args>"}}`。
- Codex(`~/.codex/sessions/.../rollout-*.jsonl`):`{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"/rename foo"}]}}` 或相同结构的 `<command-name>/rename</command-name>` 变体(取决于 CLI 版本)。

### 当前的隐式行为(与本次 change 相关)

- Rust 端 `scan_session_source_file` **不**分类 `internal-record`,会把 `<command-name>/rename</command-name>` 这条 user message **截断到 45 字符后**当成 `first_real_user_message` 写入 `ClaudeSessionSummary.first_message`。
- 也就是说现状下,CLI rename 之后用户的 sidebar 看到的第一条 user message 可能是 `<command-name>/rename</command-name>\n       ` 这种截断文本,而不是对话摘要也不是 rename 后的名字。
- 引入 alias 后,alias 在 precedence 中位于 `first_message` 之上,**副作用上是修复**这个隐式行为(rename 后 sidebar 显示 args 文本,截断的 `first_message` 被 alias 覆盖)。
- 不需要专门为 `first_message` 增加 internal-record 过滤——保持本次 scope 最小化。

不论哪种情况,sidebar 都拿不到 CLI 端的 rename 结果。

## 提议方案对比

### 选项 A:在 Rust 解析层增加 `cli_rename_alias` 字段

在 `ClaudeSessionSummary` 与 `LocalUsageSessionSummary`(或一个共享的 `*NativeSessionAlias`)上新增一个**可选**字段 `cli_rename_alias: Option<String>`,由 `scan_session_source_file` 与 `parse_codex_session_summary` 在同一次 jsonl 扫描里识别最后一条 `/rename` 命令并填入。

#### 优点

- 与现有 title precedence 天然契合:Rust 解析一次 jsonl,不再回读。
- 性能:rename alias 与 first_message / message_count / updated_at 在同一次 scan 内拿齐,**不增加 IO**。
- Claude 端缓存友好:现有 `scan_session_source_file_with_cache` 自动透传(`claude_history.rs:617`),rename alias 自动复用缓存路径。
- 失败安全:识别失败 / 不存在时 `cli_rename_alias = None`,原有 first_message 路径完全不变。
- spec 契合度高:正好对应"stronger title source may upgrade weaker title source"的次级 source 概念。

#### 缺点

- 改动面比选项 B 大:跨 Rust + Tauri command + 前端 precedence 三层。
- 新增字段会写进 `WorkspaceSessionCatalogEntry`,需要保持向后兼容(serde skip + Option)。

### 选项 B:在前端 thread 合并阶段按需回读 jsonl

让 `useThreadActions.ts` 的 thread 合并阶段在拿到 `mappedTitle` / `customName` 都为空时,调用一个 `get_thread_cli_rename_alias(workspaceId, threadId)` 的 Tauri command 拉一次 jsonl 尾段。

#### 优点

- 前端改动集中,Rust 端不动。
- 不污染 `WorkspaceSessionCatalogEntry` 这种大结构。

#### 缺点

- 重复读 jsonl:已经做过一次的 `scan_session_source_file` 解析结果没法直接复用。
- 增加 IPC 抖动:thread 列表刷新会触发 N 次额外 IPC。
- 缓存策略不一致:后端有 mtime 缓存(Claude 端),前端二次 IPC 不会命中。
- 失败模式更复杂:rename alias 与 first_message 来自两个不同时点,必须解决 stale / race。

### 选项 C:要求 ccgui 在打开 session 时把 CLI 的 rename 状态"上拉"到 `thread_titles_core`

不读 jsonl,而是监控 jsonl 的 mtime / `last-prompt` line,发现 `/rename` 后**回写** ccgui 自家 `thread_titles_core`。

#### 优点

- GUI 内重启后自定义名不丢。

#### 缺点

- 与"非目标:不会自动同步到 thread_titles_core"冲突。
- 需要 fs watch / 重新打开 session 时 reconcile 行为,scope 远超本次需求。
- 风险面大:可能误把 CLI rename 当作 GUI 用户意图写进 persistent storage。

### 取舍

选**选项 A**。原因:

- 选项 A 完全满足"读到 jsonl 里的 rename 就显示出来"的最小诉求。
- 选项 B 在性能与一致性上都更差,且与现有 mtime 缓存策略冲突。
- 选项 C 越界,并被用户明确划入非目标。

## 影响面

- `src-tauri/src/engine/claude_history.rs`:新增 `cli_rename_alias: Option<String>` 到 `ClaudeSessionSourceFact` / `ClaudeSessionSummary`,`scan_session_source_file` 在解析时识别 `<command-name>/rename</command-name>` + `<command-args>...` 并取最后一条。mtime cache 自动透传。
- `src-tauri/src/local_usage.rs`:`parse_codex_session_summary` 维护 `cli_rename_alias: Option<String>`,识别 `/rename` user message 形态。`LocalUsageSessionSummary` 同步新增字段。Codex 端**没有**显式 mtime cache 层,alias 跟随 `parse_codex_session_summary` 单次解析,不引入额外 IO。
- `src-tauri/src/session_management_types.rs` / `session_management_catalog_projection.rs` / `session_management.rs`:把 `cli_rename_alias` 作为**与 `title` 平行的独立字段**透传到 `WorkspaceSessionCatalogEntry`(可选字段,serde skip if none),保持现有 dedupe / 投影 / title 口径不变。
- `src/features/threads/hooks/useThreadActions.ts`:在三个引擎的 thread 合并路径上把 `cliRenameAlias` 作为新的 fallback 源插入到 `customName || mappedTitle || preview` 链中。位置:`customName || mappedTitle || cliRenameAlias || preview`。OpenCode 路径**不引入 alias**,保持现状。
- `src/features/threads/loaders/claudeHistoryLoader.ts` / `codexHistoryLoader.ts`:**不**在 transcript 渲染层引入新分支。rename alias 只在 catalog 投影层用,不参与逐条 transcript 渲染。

## 验收标准

- Claude:给一个 jsonl,其中包含 `<command-name>/rename</command-name><command-args>foo</command-args>` user message;ccgui sidebar 在该会话上**未在 GUI 内 rename** 时显示 `foo`;在 GUI 内 rename 后则显示 GUI 自定义名而不是 `foo`。
- Codex:给一个 rollout jsonl,其中包含 role=user 的 `/rename foo` input_text;行为同上。
- 同一 jsonl 多次 rename:以**最后一条**为准。
- 跨刷新稳定性:在 GUI 内不主动 rename 的情况下,rename alias 在 sidebar 多次刷新后保持稳定。
- 在 GUI 内 rename 后,rename alias 仍可在 catalog JSON 中读到,但 sidebar 永远以 GUI 自定义名为准,alias 不参与排序 / 不写入 thread_titles_core。
- `autoName` AI 自动命名后:autoName 写进 `thread_titles_core`,通过 `mappedTitle` 链路读出,alias 不参与显示。
- 性能:单次 `scan_session_source_file` / `parse_codex_session_summary` 增加的开销在 P95 < 5ms 之内(同一文件、不增加额外 IO)。
- 兼容:旧 jsonl(无 rename 命令)行为完全不变,`cli_rename_alias = None`,sidebar 走 first_message preview。
- OpenCode 路径:alias 不参与,即使 catalog payload 携带 `cli_rename_alias` 也忽略。
- 副作用:CLI rename 之后,sidebar 显示 args 文本(不再显示 `<command-name>/rename</command-name>` 的截断残片)。
- 测试:新增 Vitest 覆盖 thread 合并层 precedence;新增 cargo unit test 覆盖 Claude 与 Codex 的 rename alias 提取(包括最后一条胜出、不存在时为 None、与 meta 命令混合)。
