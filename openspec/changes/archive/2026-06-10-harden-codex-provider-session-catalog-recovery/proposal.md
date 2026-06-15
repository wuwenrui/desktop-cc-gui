## 当前状态 / Current Status

**状态：Implementation mostly complete / Closure pending。**

这个 change 已经完成主要代码实现和自动化回归：Codex workspace catalog 会扫描 managed provider homes，provider-home rows 会投影 provider metadata，archive/delete/folder mutation 能定位 provider-home session，frontend sidebar continuity 已有 provider-backed row 测试覆盖。

已补齐 `WorkspaceSessionCatalogSourceStatus.sourceKind`，Codex 会分别上报 `disk` 与 `provider-home` completeness；旧的按 engine 消费逻辑会取最不完整状态，避免 provider-home degraded 被 disk complete 掩盖。真实 app 的“创建 managed-provider Codex session -> 重启 -> 左侧栏验证 provider label 和 archive/delete/folder actions”手工验证还未执行。

**English summary:** The main implementation and automated regressions are mostly complete. Codex workspace catalog scans managed provider homes, projects provider metadata, resolves provider-home mutation targets, reports separate `disk` and `provider-home` source completeness via `sourceKind`, and has frontend sidebar continuity coverage. The remaining closure item is real app manual restart verification.

## 为什么要做 / Why

Codex provider-scoped session launch 已经把 Codex 会话从单一磁盘 `CODEX_HOME` 模型，扩展成了混合模型：

- disk profile session 继续存在默认或 workspace 解析出来的 Codex home 下；
- managed provider session 存在 app-local provider home 下，例如 `codex-provider-homes/<providerId>`；
- provider binding metadata 单独保存在 catalog metadata 里，用来 overlay 到已扫描到的会话行。

当前已提交代码覆盖了“创建会话、runtime 绑定、前端即时显示 provider metadata”。但 workspace session catalog 的读取链路还没有成为完整的 provider-home reader：

- provider homes 已经会 materialize 到 app-local `codex-provider-homes/<providerId>`；
- `local_usage` 仍主要扫描 disk/default 和 workspace Codex homes；
- 还没有枚举所有 managed provider homes；
- provider binding metadata 只是 overlay，不能凭空创建 catalog membership；
- `list_threads` live aggregation 仍以 workspace-only runtime key 为主，不能可靠覆盖 managed provider-scoped runtime；
- app 重启后，如果一个 managed-provider 会话只存在 provider home 里，左侧 workspace session list 可能找不到它；
- archive/delete/folder assignment 这类 mutation 如果依赖可见 catalog entry，也可能无法定位 provider-home session。

所以这个 change 的本质是：**修复 provider-scoped session launch 后遗留的 workspace catalog 恢复缺口**。它不是旧 disk Codex reader 的普通 regression，也不是“会话列表供应商标签显示开关”。

**English summary:** Provider-scoped launch moved managed Codex sessions into provider-specific homes. The current catalog reader still scans disk/workspace homes but not all managed provider homes, so managed-provider sessions can disappear from the sidebar after refresh or restart.

## 要改什么 / What Changes

这个 change 要增强 workspace session catalog 和 sidebar 读取能力，让 Codex provider-scoped sessions 在刷新、重启、归档、删除、文件夹操作之后仍然可见且可操作。

实现需要做到：

- 把 managed Codex provider homes 纳入 Codex session source discovery；
- 扫描 `codex-provider-homes/*/sessions` 和 `codex-provider-homes/*/archived_sessions`；
- provider-home 扫描结果仍必须用 session `cwd` / ownership evidence 做 workspace scope filtering，不能因为 provider id 相同就归属到当前 workspace；
- provider binding metadata 只能作为 overlay 和 routing metadata，不能作为 membership proof；
- provider-home session 进入 catalog/sidebar 后，需要恢复 `providerProfileId`、`providerProfileSource`、`providerProfileName`、`providerAvailability`；
- live Codex listing 可以选择聚合 provider-scoped runtimes，也可以明确保持 diagnostic-only，但 disk/provider-home scan 必须成为 membership truth；
- archive/delete/folder assignment 必须能 provider-aware 地解析 provider-home session target；
- 添加 restart/no-runtime regression tests，覆盖 managed provider session 只存在 provider home 的场景。

**English summary:** Expand Codex catalog source discovery to include managed provider homes, keep workspace ownership strict, project provider metadata, and make mutations work for sessions discovered only from provider homes.

## 当前代码观察 / Current Code Observations

基于当前代码阅读，主要缺口如下：

- `src-tauri/src/codex/provider_profile.rs` 已经负责 materialize managed provider home。
- `src-tauri/src/local_usage.rs` 的 `resolve_sessions_roots` 仍只合并 default/workspace Codex home 的 `sessions` / `archived_sessions`。
- `src-tauri/src/session_management_catalog_projection.rs` 创建 Codex catalog entry 时 provider 字段先是 `None`。
- `src-tauri/src/session_management.rs` 的 `finalize_existing_catalog_entry` 会后置应用 provider binding metadata，但前提是 catalog entry 已经由 source scan 产生。
- 因此，provider binding 能补充 metadata，但不能让 provider-home-only session 进入 catalog。

**English summary:** Provider homes exist, but local usage/catalog scanning does not enumerate them yet. Provider metadata is only an overlay for already-scanned rows.

## 非目标 / Non-Goals

- 不重做 provider-scoped Codex runtime launch。
- 不改变 provider selector UX 或 supplier management 语义。
- 不迁移既有 disk Codex sessions 到 provider homes。
- 不根据 provider id 推断 workspace membership。
- 不把 unavailable/deleted provider session 静默 rebind 到 disk。
- 不在这个 change 中实现 orphaned provider homes 的 destructive cleanup。
- 不处理“会话列表供应商标签显示开关”；那个功能已由 `showSidebarProviderLabels` 独立完成。

**English summary:** This change is limited to catalog recovery for provider-home sessions. It does not redesign provider launch, UX, or cleanup.

## 影响范围 / Impact

### Backend

- `local_usage` Codex session root resolution and scan summary construction。
- Workspace session catalog projection and source status/completeness reporting。
- Codex provider binding overlay and unavailable-provider projection。
- Codex live thread listing fallback/aggregation semantics。
- Archive/delete/folder mutation target lookup for Codex sessions。

### Frontend

- Sidebar、pinned/recent Codex rows 在 refresh/restart 后应继续收到 catalog provider metadata。
- provider label 仍然必须从 thread metadata/catalog fields 派生，不能从全局 active provider 推导。
- 当 backend source completeness 是 partial/degraded 时，前端不能把 omitted provider-backed row 直接当作权威删除。

### Tests

- Rust scanner/catalog tests：managed provider home discovery。
- Rust session management tests：provider metadata overlay、mutation target resolution。
- Frontend sidebar/thread-list tests：restart restored rows、degraded refresh continuity。

**English summary:** Backend catalog scanning and mutation lookup are the primary impact. Frontend should preserve provider-backed rows when backend evidence is degraded.

## 验收标准 / Acceptance Criteria

- 一个只存在于 `codex-provider-homes/<providerId>` 下的 managed-provider Codex session，在 app restart 且无 live runtime 时，仍能出现在所属 workspace catalog 中。
- 该 catalog row 包含 `providerProfileId`、`providerProfileSource`、`providerProfileName`、`providerAvailability`。
- disk Codex sessions 继续通过现有 disk/default scan path 可见，并保持 `__disk__` 兼容行为。
- provider-home scan 必须通过 `cwd` 等 ownership evidence 做 workspace-scoped filtering；同一 provider home 中其它 workspace 的 session 不能进入当前 workspace strict projection。
- provider profile 被删除后，已有 provider-backed history 仍可见，状态为 unavailable，不能被改写成 disk provider。
- backend source status 为 partial/degraded 时，sidebar refresh/restart 不能仅凭 omission 删除 provider-backed row；只有 authoritative evidence 才能移除。
- archive、delete、folder assignment 能解析 provider-home session。
- 聚焦测试覆盖 disk + one managed provider + two managed providers 的 restart/no-runtime catalog restoration。
- 通过 `openspec validate harden-codex-provider-session-catalog-recovery --strict --no-interactive` 和相关 Rust/frontend regression tests。

**English summary:** The feature is complete only when provider-home Codex sessions survive restart in catalog/sidebar with provider metadata and mutation support.
