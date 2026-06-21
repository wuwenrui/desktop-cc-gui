# Codex Process Model Audit (Phase 1.6)

## Audit conclusion

Codex 引擎**有意不**纳入本 change 的 child-process parity 路径。理由如下:

1. **独立 runtime model**:Codex 在 `src-tauri/src/engine/codex_adapter.rs` / `codex_prompt_service.rs` 中通过 `codex app-server` JSON-RPC wrapper 维持 session 生命周期,与 Claude/OpenCode/Gemini 的 `Child` 进程模型(直接 fork CLI)不同。
2. **没有等价 `active_processes: Mutex<HashMap<String, Child>>` 字段**:codex wrapper 通过 `app-server` 的 task 调度管理进程边界,本 change 强行把 codex 塞入 `Child` 地图会污染其独立 runtime model。
3. **Codex 已有 `codex_app_server_wrapper_launch` capability 与独立 session 边界**,这些是 Codex 专属 module,行为已经稳定,不应在此 residual 治理 change 里搅动。

## 后续 follow-up(本 change 不实现)

- 如需在后续 `codex-runtime-residuals` change 里给 Codex 加 Drop parity,需要先重新审视 `codex_adapter.rs` / `codex_prompt_service.rs` 的 wrapper session 边界,并定义"child process"在 app-server wrapper 模型下的等价物(可能是 wrapper task 句柄)。

## 显式不在本 change 范围内

- `codex-cli-computer-use-broker` / `codex-collaboration-mode-runtime-enforcement` 等 Codex 专属 capability 都不被本 change 触动。
- `codex_app_server_wrapper_launch` 的 `child process` 概念不与本 change 的 `Child` 地图对齐。
