# Change: harden-codex-disk-session-start-readiness

## Why

默认 Codex 磁盘配置（`__disk__`）创建会话时仍走 legacy workspace runtime key。连接池引入后，创建链路会先经历 runtime acquire / health probe / app-server spawn / `thread/start`，而前端在拿到 thread id 后会立即把会话标记为 loaded。若 app-server 刚重启、旧 runtime 被判 stale、或 `thread/start` 返回后 `thread/resume` 还不可用，用户会看到“第一次创建像连上了但实际虚连”，随后必须二次重连或多次重试。

Managed provider 创建路径目前稳定，不能因为修默认磁盘供应商而改变其 provider-scoped runtime 行为。

## What Changes

- 默认 disk Codex 创建失败遇到 runtime recovering / ready confirmation failure 时，前端自动执行一次 `ensureRuntimeReady(workspaceId)` 并重试创建，失败后才显示手动恢复 toast。
- Managed provider 创建仍保持原路径：不新增 disk auto-recovery，不额外调用 default `ensureRuntimeReady`。
- Backend 只对 disk provider 的 `thread/start` 成功响应做短超时 `thread/resume` ready confirmation；managed provider 不执行该确认。
- Codex app-server `--help` probe 增加成功态 TTL cache，减少重复 spawn/app-server probe 成本；失败不缓存，避免用户修复 CLI 后被负缓存挡住。
- Runtime reconnect UI 区分 blocking connectivity drift 与 transient managed-runtime cleanup：`broken pipe` / `workspace not connected` / `thread not found` 仍显示恢复操作；`stale_reuse_cleanup` / `internal_replacement` 等自动切换态降级为轻量提示，用户继续输入后不再把旧 transient diagnostic 挂成断联卡。

## Non-Goals

- 不改变 managed provider 的 `codex::<workspaceId>::<providerProfileId>` runtime key。
- 不改变 managed provider `CODEX_HOME` materialization / config override / auth 写入逻辑。
- 不把 managed provider fallback 到 disk。
- 不引入新的公开 Tauri command。
- 不改变已有 thread provider binding metadata contract。

## Risks

- Disk ready confirmation 会让首次创建多一次短 `thread/resume` RPC。该 RPC 只在 disk provider 上执行，超时短，目的是用可诊断失败替代虚连成功。
- Probe cache 若 key 过粗可能串 provider 或 wrapper。实现必须包含 resolved binary、PATH env、codex args、launch options；只缓存成功结果。
- Runtime reconnect 文案与恢复按钮必须避免过度承诺：transient cleanup 不是用户可手动修复的真实断联，不能继续给“重新连接 / 重发上一条提示词”的重操作；blocking diagnostic 仍必须保留恢复入口，避免隐藏真实失败。
