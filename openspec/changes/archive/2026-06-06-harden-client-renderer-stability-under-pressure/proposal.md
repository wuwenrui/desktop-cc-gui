## Why

用户反馈两类稳定性问题正在汇合成同一个客户端风险面：Windows issue #663 显示 WebView2/Chromium renderer 错误页 `STATUS_ACCESS_VIOLATION`，而 mac 长时间高强度、多 engine 实时对话后会出现整体白屏和顿挫卡顿。现有归档优化已覆盖部分交互 jank 和图片内存压力，但还缺少面向“renderer 长跑压力”的可观测、降压、恢复和后台任务边界哨兵。

## 目标与边界

- 建立 renderer stability under pressure 的独立修复边界，覆盖 Windows WebView2 renderer crash 证据、mac WebContent/WebView 长跑白屏证据、多 engine streaming 压力、后台 polling 噪音和 runtime/helper acquire 回归哨兵。
- 先把不可见的白屏/renderer crash 转成可诊断事件，再做可回滚的降压与恢复；不把“自动 reload 后看起来恢复”当成根因修复。
- 明确区分确定性证据与推断：`STATUS_ACCESS_VIOLATION` 是 Windows renderer crash 证据；mac 白屏目前是 renderer pressure / memory growth / event storm / process lifecycle 的候选模型；`git/branches/list error` 是诊断噪音与压力放大器，不单独构成 crash 根因。
- 延续历史 runtime lifecycle 契约：passive selection、helper read、session visibility 不得无界启动 node/codex/claude runtime 或造成后台进程膨胀。

## 非目标

- 不承诺一次性修复 WebView2 native `STATUS_ACCESS_VIOLATION` 的浏览器内核级根因。
- 不重写 AppShell、全局状态管理、engine runtime protocol 或 provider streaming transport。
- 不重复 `fix-client-runtime-interaction-jank` 已覆盖的 broad hot-path 性能优化；本 change 只补“长跑稳定性、renderer pressure evidence、multi-engine coalescing 和后台噪音/进程哨兵”。
- 不删除用户本地历史、Codex JSONL、runtime cache 或 error log。
- 不用无限自动刷新掩盖问题；任何恢复动作必须有 backoff、证据记录和用户可理解状态。

## What Changes

- Add privacy-safe renderer stability diagnostics:
  - frontend renderer heartbeat;
  - backend watchdog for missed heartbeat / unresponsive renderer evidence;
  - platform-supported native renderer process failure evidence where available;
  - bounded pressure snapshot including platform, app version, active engine count, streaming turn count, background process count, memory/long-task support status, and timestamps.
- Add bounded recovery behavior for renderer pressure/crash cases:
  - classify recoverable renderer failure vs unsupported platform evidence;
  - allow reload/rebuild only behind backoff and user-visible diagnostic state;
  - preserve unsent Composer draft and do not silently discard active user input.
- Add multi-engine streaming pressure control:
  - coalesce high-frequency realtime deltas at a shared boundary;
  - keep active assistant row visibly live;
  - keep Composer input, IME, selection, Stop, toolbar and message controls on immediate paths.
- Harden git branch polling noise:
  - validate a workspace path is a Git repository before branch polling;
  - treat default `.ccgui/workspace` non-repository state as neutral/degraded branch state;
  - dedupe or throttle identical branch polling failures so logs do not hide renderer evidence.
- Add runtime/helper acquire regression guardrails:
  - audit passive selection, model list, rate limit, thread list and session visibility paths;
  - record bounded diagnostics for helper/runtime process starts;
  - prove passive/helper reads do not independently create recovery storms or background node/codex/claude process growth.

## 技术方案

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A. 只修 `git/branches/list error` | 在默认 workspace 非 Git repo 时静默或降级 branch polling | 快速降噪，但无法解释或观测 `STATUS_ACCESS_VIOLATION` 与 mac 长跑白屏 | Rejected as insufficient |
| B. 只加 WebView crash reload | renderer crash 后尝试刷新页面 | 用户短期可能恢复，但会掩盖根因、丢诊断，且 mac 白屏/streaming 压力仍存在 | Rejected as unsafe alone |
| C. Renderer pressure control loop | 组合 heartbeat/watchdog、platform crash evidence、streaming coalescing、git polling 降噪、runtime acquire 哨兵和 bounded recovery | 范围更完整，但仍保持分层、可测试、可回滚 | Chosen |
| D. 大规模性能/架构重构 | 重写 AppShell 或消息渲染架构 | 可能长期有效，但风险大，且与已归档 jank change 重叠 | Rejected for this change |

## Capabilities

### New Capabilities

- `client-renderer-stability-under-pressure`: renderer heartbeat、process failure/unresponsive evidence、pressure snapshot、bounded recovery、privacy-safe diagnostic contract.
- `git-workspace-branch-polling`: workspace branch polling must distinguish Git repository paths from neutral non-repository workspace paths and avoid repeated noisy errors.

### Modified Capabilities

- `conversation-realtime-client-performance`: multi-engine realtime output must be coalesced without delaying active row visibility or critical controls.
- `runtime-lifecycle-recovery-guard`: passive/helper reads must remain bounded and observable, and must not create independent runtime recovery storms or background process growth.
- `client-global-error-log`: renderer stability and polling diagnostics must be bounded, redacted and classified so renderer crash evidence is not hidden by repeated low-value errors.
- `runtime-performance-evidence-gates`: evidence reports must classify renderer stability evidence as measured, proxy, manual-only or unsupported across Windows/macOS/Linux.

## Impact

- Frontend:
  - renderer heartbeat and pressure diagnostics service;
  - streaming event ingestion/coalescing path for Claude, Codex, Gemini, OpenCode and custom provider surfaces;
  - Composer/Messages immediate control path regression tests;
  - git branch hook/state surface for degraded non-repository workspaces.
- Backend / Tauri:
  - heartbeat receiver and watchdog;
  - optional platform-supported native WebView process failure bridge;
  - runtime/helper process diagnostic counters;
  - Git repository validation before branch list requests.
- Diagnostics:
  - client error log labels for renderer heartbeat missed, process failure/unresponsive, streaming pressure, git branch polling degraded, runtime helper acquisition boundary.
- Dependencies:
  - No new third-party dependency expected. Platform APIs must be feature-detected and classified as unsupported when unavailable.

## 验收标准

- Windows renderer crash / error-page cases produce renderer-specific evidence such as process failure, heartbeat miss, unresponsive classification or unsupported native-hook status, instead of only showing `git/branches/list error`.
- mac long-run white-screen investigation can correlate at least one bounded pressure signal: heartbeat gap, long task support/evidence, memory pressure support/evidence, active engine count, streaming turn count or background process count.
- Multi-engine streaming deltas are coalesced through a shared boundary while active assistant output remains visibly live.
- Composer draft text, IME composition, selection, attachments, Stop, message toolbar, copy/fork/rewind and scroll controls remain immediate and are not blocked by coalesced diagnostics or streaming batches.
- `.ccgui/workspace` or any configured workspace path that is not a Git repository no longer produces repeated `git/branches/list error` entries; it surfaces a neutral/degraded branch state instead.
- Passive session selection, model list, rate limit, thread list and session visibility reads do not independently trigger unbounded runtime acquisition or background node/codex/claude process growth.
- Renderer recovery has bounded backoff and does not silently discard unsent user input.
- Evidence report separates measured, proxy, manual-only and unsupported platform evidence before archive/release claims.
