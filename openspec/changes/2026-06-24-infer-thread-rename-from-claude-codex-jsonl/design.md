# Design: 2026-06-24-infer-thread-rename-from-claude-codex-jsonl

## 1. Scope / Trigger

- Trigger：修改 `src-tauri/src/engine/claude_history.rs`、`src-tauri/src/local_usage.rs`、`src-tauri/src/session_management*.rs`、`src/features/threads/hooks/useThreadActions.ts`，让 Claude / Codex sidebar 在不增加额外 IO 的前提下复用 jsonl 内 `/rename` 命令的 args 作为次级 title source。
- 目标：在不破坏现有 first_message 路径、不改写 jsonl、不动 GUI 内 rename 契约的情况下，让"CLI 端 rename 过的会话"在 ccgui 侧栏里直接显示用户当时取的名字。
- 范围：只覆盖 Claude Code / Codex CLI。OpenCode / Gemini 不在本次 change 范围内，OpenCode 现状保留。

## 2. Signatures

### Rust 新增

```rust
// src-tauri/src/engine/claude_history.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSessionSourceFact {
    // 现有字段保持不变 ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_rename_alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSessionSummary {
    // 现有字段保持不变 ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_rename_alias: Option<String>,
}
```

```rust
// src-tauri/src/local_usage.rs (LocalUsageSessionSummary)
pub struct LocalUsageSessionSummary {
    // 现有字段保持不变 ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_rename_alias: Option<String>,
}
```

```rust
// src-tauri/src/session_management_types.rs
pub(crate) struct WorkspaceSessionCatalogEntry {
    // 现有字段保持不变 ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) cli_rename_alias: Option<String>,
}
```

### 新增解析函数（Rust）

```rust
// Claude：解析一行 jsonl 的 message content，识别 /rename 命令并返回 args 文本
fn extract_claude_rename_alias_from_message(message: &Value) -> Option<String>;

// Codex：识别 payload 内 role=user 的 input_text
fn extract_codex_rename_alias_from_payload(payload: &Value) -> Option<String>;
```

判定规则：

- Claude：识别 `content` 中 `<command-name>/rename</command-name>` 紧跟的 `<command-args>...</command-args>`，trim 后非空才返回。content 是 string 或 array（text block）形态都要覆盖。
- Codex：识别 `payload.role == "user"` 且 `content[]` 中 `type == "input_text"` 的 `text`：
  - 形态 A：`/rename <args>`（纯文本）
  - 形态 B：`<command-name>/rename</command-name>...<command-args>foo</command-args>`

  两种形态都解析出 args，trim 后非空才返回。
- alias 字符串**不截断**（用户取的名字可能较长）。前端如有需要可自行 truncate。

## 3. Contracts

### Claude

- `scan_session_source_file` 在循环中维护一个 `latest_rename_alias: Option<String>`，每次命中 `extract_claude_rename_alias_from_message` 时**覆盖**（最后一条胜出），循环结束后把 `latest_rename_alias` 写入 fact 的 `cli_rename_alias`。
- `to_summary` 把 fact.`cli_rename_alias` 透传到 `ClaudeSessionSummary.cli_rename_alias`。
- `scan_subagent_session_file` / `scan_subagent_source_file` 保持现状：subagent 路径有自己 `description` 覆盖 first_message 的行为，alias **不**额外引入，避免覆盖 description 的事实。
- mtime 缓存：`scan_session_source_file_with_cache` 自动透传 alias（已确认该函数包了 `scan_session_source_file`，cache 序列化整个 outcome）。

### Codex

- `parse_codex_session_summary` 维护 `latest_rename_alias`，在 `entry_type == "response_item"` + `payload_type == "message"` + `role == "user"` 分支里调用 `extract_codex_rename_alias_from_payload`。
- 在最终构造 `LocalUsageSessionSummary` 时把 `latest_rename_alias` 写入新字段。
- 与现有 `response_item_user_summary` 互补：rename alias 独立计算，不影响 first-message preview。
- mtime 缓存：Codex 侧**没有**显式 mtime cache 层（与 Claude 端对称的 `scan_session_source_file_with_cache` 不存在）。alias 跟随 `parse_codex_session_summary` 单次解析，不引入额外 IO；性能与 first_message 同阶。

### Catalog 投影

- `WorkspaceSessionCatalogEntry` 新增可选字段 `cli_rename_alias: Option<String>`（serde skip_if_none）。这是与 `title`（即 `preview`）**平行**的独立字段，不替换 `title`、不影响 catalog 的 title precedence。
- `session_management.rs` 构造 catalog entry 时：
  - Claude：直接传 `session.cli_rename_alias.clone()`。
  - Codex：直接传 `summary.cli_rename_alias.clone()`。
  - Gemini / OpenCode：始终 `None`（本次不变更）。
- dedupe / 排序 / 投影口径保持不变。
- frontend 消费 `WorkspaceSessionCatalogEntry` 时直接读 `cliRenameAlias` 字段；不要把它误填进 `title` / `preview`。

### Frontend

`useThreadActions.ts` 中三个 thread 合并点：

- **Claude 路径**（`useThreadActions.ts:794` 附近）：
  `customTitle || mappedTitle || cliRenameAlias || previewThreadName(session.firstMessage, "Claude Session")`
  - `session.firstMessage` 来自 `ClaudeSessionSummary.first_message`（已由 Rust 端截断到 45 字符）。
- **Codex 路径**（`useThreadActions.ts:671` 附近）：
  `getCustomName(...) || mappedTitle || cliRenameAlias || previewThreadName(preview, fallbackName)`
  - `preview` 来自 `WorkspaceSessionCatalogEntry.title`（即 `LocalUsageSessionSummary.summary`，已由 Rust 端截断到 100 字符）。
  - 注意 Codex 现状是 `getCustomName(...) || mappedTitle`，不是 `customName || mappedTitle`，保持现状字面量。
- **OpenCode 路径**（`useThreadActions.ts:884` 附近）：**不引入 alias**，保持现状 `mappedTitles[id] || getCustomName(...) || previewThreadName(...)`。OpenCode 侧 jsonl 没有 `/rename` 形态（本次未识别），且其 precedence 写法（mappedTitle 优先于 customName）与 Claude / Codex 不同，统一它属于另一个 follow-up scope。

`ThreadSummary` 类型不新增字段（`cliRenameAlias` 是 catalog 的瞬时数据，不写入 store）。

## 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| jsonl 内无 `/rename` | `cli_rename_alias = None`，sidebar 走 first_message preview | 把 `first_message` 误填到 `cli_rename_alias` |
| jsonl 内多次 `/rename` | 取最后一条 args 文本 | 取首条 |
| `/rename` 后 args 为空 / 仅空白 | `cli_rename_alias = None` | 把空字符串当 alias |
| `/rename` 出现在 `isMeta=true` 的 system 记录 | 不计入 alias | 污染用户主对话 |
| `/rename` 出现在 `isMeta=true` 但 `role=user` 的 `local-command-caveat` 之前 | 不计入 alias（与现有 first_message 行为对齐） | 计入 |
| 用户在 GUI 内 rename | sidebar 显示 GUI 自定义名，alias 仅作为 catalog payload 存在 | 把 alias 写回 `thread_titles_core` |
| Claude loader `internal-record` 分类 | transcript 渲染仍然跳过 rename message，alias 仅在 catalog 投影层用 | 在 transcript 中渲染 rename 命令 |
| Gemini / OpenCode 入口 | `cli_rename_alias = None` | 复用 Codex/Claude 的 alias 逻辑 |
| subagent session（Claude） | 现有 `description` 覆盖 first_message 行为保持不变，alias 不参与 | alias 覆盖 description |
| Claude mtime cache 命中 | alias 走 cache 路径 | 重新解析 jsonl |
| Codex 端 mtime cache | Codex 无显式 cache 层，alias 跟随 `parse_codex_session_summary` 单次解析，不引入额外 IO | 给 Codex 引入新的 cache |
| jsonl 文件被截断 / 损坏 | alias 取最后一条能解析到的；其他字段按现有 malformed 处理 | 把空字符串当 alias |
| `autoName` AI 自动命名 | 自动命名写进 `thread_titles_core` 后通过 `mappedTitle` 链路读出，alias 不参与 | alias 覆盖 autoName |

### 隐式副作用（重要）

- Rust 端 `scan_session_source_file` **不**分类 `internal-record`，会把 `<command-name>/rename</command-name>` 这条 user message 截断后作为 `first_real_user_message` 写入 `ClaudeSessionSummary.first_message`。
- 引入 alias 后，alias 在 precedence 中位于 `first_message` 之上，**副作用上是修复**了这个隐式行为（rename 之后 `first_message` 仍可能含 `<command-name>...` 截断文本，但 alias 会优先显示）。
- 不需要专门为 `first_message` 增加 internal-record 过滤——保持本次 scope 最小化。

## 5. Good / Base / Bad Cases

### Good

- jsonl 含 `<command-name>/rename</command-name><command-args>Weekly retro</command-args>` + 一段对话；`scan_session_source_file` 拿到 `latest_rename_alias = Some("Weekly retro")`，写入 fact / summary。sidebar 在用户没在 GUI 内 rename 时显示 "Weekly retro"。
- jsonl 多次 rename：`<command-args>Foo</command-args>` ... `<command-args>Bar</command-args>`。alias 取 "Bar"。
- 旧 jsonl：完全没有 `/rename`。alias = None，行为完全不变。
- Codex rollout 含 `response_item` + `payload.type=message` + `role=user` + `content[0].type=input_text` + `text="/rename weekly retro"`。alias = Some("weekly retro")。
- 用户在 GUI 内 rename 后，alias 仍可在 catalog JSON 中读到，但 sidebar 永远以 GUI 自定义名为准。

### Base

- jsonl 内 `/rename` 的 args 含前后空白 / 换行：trim 后保留非空内容。
- Codex jsonl 内 `/rename` 出现在若干 tool call 之后才到 user message，alias 仍取到最后一条。
- alias 字符串较长（> 45 字符）：Rust 端不截断，前端按现有 `previewThreadName` 行为处理（如果有截断）。

### Bad

- 把 `first_message` 误填到 `cli_rename_alias`（与"最后一条胜出"语义冲突）。
- 在 transcript 渲染层把 rename message 当成"对话条目"显示。
- 在 `thread_titles_core` 里写 alias，导致用户在 GUI 内没主动 rename 但被"上拉"为持久 custom name。
- 让 Gemini / OpenCode 复用同一 alias 提取逻辑（本变更边界外）。
- 把 `cli_rename_alias` 写进 `WorkspaceSessionCatalogEntry.title`（污染现有 title precedence）。

## 6. Tests Required

### Rust（cargo unit test）

- `claude_history_inline_tests.rs` 或新增 `claude_history_rename_alias_tests.rs`：
  - 命中：`<command-name>/rename</command-name><command-args>foo</command-args>` 出现在 user message，`cli_rename_alias = Some("foo")`。
  - 命中：content 是 array of text blocks 形态（与 string 形态区分）。
  - 不存在：jsonl 中无 rename，`cli_rename_alias = None`。
  - 最后一条胜出：两条 rename，取最后一条。
  - 边界：args 为空 / 空白字符串 / 多行 args（取 trim 后非空部分）。
  - 边界：rename 出现在 `isMeta=true` 的 system message，不计入。
  - 边界：rename 出现在 `isMeta=true` 但 `role=user` 的 `local-command-caveat` 之前，不计入。
  - subagent：alias 不参与，`description` 仍覆盖 `first_real_user_message`。
- `local_usage.rs`（新增 `local_usage_codex_rename_alias_tests.rs`，与现有 `local_usage_inline_tests.rs` 风格一致）：
  - 命中：`response_item` + `payload.type=message` + `role=user` + `content[0].type=input_text` + `text` 以 `/rename` 开头。
  - 命中：input_text 是 `<command-name>/rename</command-name>...<command-args>foo</command-args>` 形态。
  - 不存在：jsonl 中无 user `/rename`，`cli_rename_alias = None`。
  - 最后一条胜出。
  - 边界：args 为空。

### Frontend（Vitest）

- `useThreadActions.*.test.tsx`：mock `listThreadTitles` 返回空、`getCustomName` 返回空、catalog 携带 `cliRenameAlias`：
  - Claude 路径返回的 `name` 等于 alias。
  - Codex 路径返回的 `name` 等于 alias。
  - `customName` / `customTitle` 存在时 alias 不参与。
  - `mappedTitle` 存在时 alias 不参与。
  - `autoName` 通过 `mappedTitle` 链路覆盖 alias（验证：mock `listThreadTitles` 返回 `autoName`，验证 alias 不显示）。
- `useThreadActions.helpers.test.tsx` 或同级：OpenCode 路径**不**消费 `cliRenameAlias`（即便 catalog 携带也忽略）。

### Validation

- `openspec validate --all --strict --no-interactive`
- `npm run typecheck`
- `npm run test -- src/features/threads`
- `cargo test --manifest-path src-tauri/Cargo.toml`

## 7. Wrong vs Correct

#### Wrong

```rust
// 误用首条
fn scan_session_source_file(...) {
    let mut first_rename = None;
    // ...
    if first_rename.is_none() {
        first_rename = extract_claude_rename_alias_from_message(&entry);
    }
}
```

#### Correct

```rust
// 最后一条胜出
fn scan_session_source_file(...) {
    let mut latest_rename: Option<String> = None;
    // ...
    if let Some(alias) = extract_claude_rename_alias_from_message(&entry) {
        latest_rename = Some(alias);
    }
    // 循环结束后
    fact.cli_rename_alias = latest_rename;
}
```

#### Wrong

```ts
// 把 alias 写进 store
const next: ThreadSummary = {
  id,
  name: cliRenameAlias ?? previewThreadName(...),
  customName: cliRenameAlias, // 反向注入
};
```

#### Correct

```ts
const next: ThreadSummary = {
  id,
  name:
    customTitle ||
    mappedTitle ||
    cliRenameAlias ||
    previewThreadName(session.firstMessage, "Claude Session"),
};
```

#### Wrong

```rust
// 把 alias 填进 catalog title，污染现有 title precedence
entry.title = entry.cli_rename_alias.clone().unwrap_or(entry.title);
```

#### Correct

```rust
// alias 是 catalog entry 的独立字段，不替换 title
entry.title = ...; // 保持现状
entry.cli_rename_alias = session.cli_rename_alias.clone();
```
