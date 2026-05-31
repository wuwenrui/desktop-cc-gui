# Classify Auto Session Visibility

## Goal

继续实现 OpenSpec change `classify-auto-session-visibility`，将自动创建的 helper / traceable execution session 从普通用户 workspace root 会话中分离。

## Requirements

- 自动 helper session 记录 `visibility=hidden` metadata，并从正常 catalog / sidebar / session management active 列表排除。
- 可追溯自动执行 session 记录 `visibility=system-auto` metadata，并进入保留系统分组而不是 workspace root。
- 普通用户创建或继续的 session 保持默认可见。
- metadata overlay 必须 additive，不能破坏已有 engine 历史文件。
- frontend 与 Rust command payload 保持 camelCase / serde contract 一致。

## Acceptance Criteria

- [ ] `openspec validate classify-auto-session-visibility --strict --no-interactive` 通过。
- [ ] Rust focused session management tests 覆盖 hidden / system-auto projection。
- [ ] TypeScript typecheck 不因新增 `autoSession` payload 失败。
- [ ] `openspec/changes/classify-auto-session-visibility/tasks.md` 与实现状态同步。

## Technical Notes

- OpenSpec 是本任务的 plan/source of truth。
- `system-auto` 是 reserved grouping，不允许用户创建同名普通 folder。
- remote/daemon 兼容路径必须容忍旧 payload，并在本地能记录 overlay 时记录。
