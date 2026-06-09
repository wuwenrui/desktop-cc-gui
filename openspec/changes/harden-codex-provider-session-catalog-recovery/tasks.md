## 状态摘要 / Status Summary

**当前状态：Planning complete / Implementation not started。**

已完成的是 OpenSpec 规划层：proposal、design、tasks、spec delta 和 strict validation。下面第 2 到第 7 部分仍未实现，checkbox 保持未勾选。

**English summary:** The planning artifacts are complete. Backend implementation, catalog projection, mutation routing, regression tests, and closure validation are still pending.

## 1. Planning / Contract（规划与契约）

- [x] 1.1 Add OpenSpec proposal, design, tasks, and capability deltas for Codex provider-home session catalog recovery. / 添加 Codex provider-home session catalog recovery 的 proposal、design、tasks 和 capability delta。
- [x] 1.2 Validate change artifacts with `openspec validate harden-codex-provider-session-catalog-recovery --strict --no-interactive`. / 使用 strict OpenSpec validation 校验提案 artifact。

## 2. Backend Source Discovery（后端来源发现）

- [ ] 2.1 Add managed Codex provider home session root discovery for `codex-provider-homes/*/{sessions,archived_sessions}`. / 增加 managed Codex provider home 的 session root 枚举。
- [ ] 2.2 Dedupe provider-home roots with existing normalized Codex root keys. / 用现有 normalized Codex root key 去重 provider-home roots。
- [ ] 2.3 Preserve current disk/default and workspace override Codex home behavior. / 保持现有 disk/default 和 workspace override Codex home 行为不回退。
- [ ] 2.4 Expose degraded source diagnostics when provider-home enumeration is partial or unreadable. / provider-home 枚举部分失败或不可读时返回 degraded source diagnostics。

## 3. Catalog Projection And Metadata（目录投影与元数据）

- [ ] 3.1 Ensure Codex summaries scanned from provider homes pass the same workspace ownership filter as disk sessions. / provider-home 扫描出的 Codex summaries 必须通过和 disk session 相同的 workspace ownership filter。
- [ ] 3.2 Apply provider binding metadata to provider-home rows without using metadata alone as membership proof. / provider binding metadata 只作为 provider-home rows 的 overlay，不能单独作为 membership proof。
- [ ] 3.3 Project provider id/source/name/availability for provider-home rows after restart/no-runtime. / restart/no-runtime 后为 provider-home rows 投影 provider id/source/name/availability。
- [ ] 3.4 Preserve deleted/unavailable provider rows without rewriting them to disk. / provider 被删除或不可用时保留已有 rows，不静默改写为 disk。
- [ ] 3.5 Mark source completeness separately for disk Codex roots and managed provider-home roots. / 分别标记 disk Codex roots 和 managed provider-home roots 的 source completeness。

## 4. Live Listing And Sidebar Continuity（Live 列表与侧栏连续性）

- [ ] 4.1 Decide whether to aggregate provider-scoped live runtimes or keep live listing diagnostic with explicit partial coverage. / 决定是否聚合 provider-scoped live runtimes，或保持 live listing 为带 partial coverage 的 diagnostic。
- [ ] 4.2 Ensure sidebar refresh does not treat missing managed-provider live entries as authoritative deletion. / 确保 sidebar refresh 不把缺失的 managed-provider live entries 当作权威删除。
- [ ] 4.3 Preserve provider metadata through frontend thread list, pinned/sidebar rows, and active composer state after catalog refresh. / catalog refresh 后保留 thread list、pinned/sidebar rows、active composer state 中的 provider metadata。

## 5. Mutation Routing（变更操作路由）

- [ ] 5.1 Verify archive/delete/folder assignment target lookup for provider-home Codex rows. / 验证 archive/delete/folder assignment 能定位 provider-home Codex rows。
- [ ] 5.2 Ensure delete/archive operations do not mutate entire provider homes. / 确保 delete/archive 只作用于目标 session，不误操作整个 provider home。
- [ ] 5.3 Add provider-aware diagnostics when a mutation target cannot be resolved. / mutation target 无法安全解析时返回 provider-aware diagnostics。

## 6. Regression Tests（回归测试）

- [ ] 6.1 Add Rust test: managed provider session exists only under provider home and appears in workspace catalog after restart/no-runtime. / Rust 测试：只存在 provider home 的 managed provider session 在 restart/no-runtime 后仍进入 workspace catalog。
- [ ] 6.2 Add Rust test: disk + provider A + provider B sessions appear together for the owning workspace. / Rust 测试：disk + provider A + provider B sessions 同时出现在所属 workspace。
- [ ] 6.3 Add Rust test: provider-home session for another workspace is excluded from strict projection. / Rust 测试：其它 workspace 的 provider-home session 被 strict projection 排除。
- [ ] 6.4 Add Rust test: deleted provider still shows existing provider-bound session as unavailable. / Rust 测试：provider 删除后已有 provider-bound session 仍显示 unavailable。
- [ ] 6.5 Add mutation tests for archive/delete/folder assignment on provider-home rows. / 增加 provider-home rows 的 archive/delete/folder assignment mutation tests。
- [ ] 6.6 Add frontend test coverage for provider-backed sidebar rows restored from catalog and preserved during degraded refresh. / 增加前端测试：provider-backed sidebar rows 从 catalog 恢复，并在 degraded refresh 中保留。

## 7. Validation / Closure（验证与收口）

- [ ] 7.1 Run focused Rust catalog/session-management tests. / 运行聚焦 Rust catalog/session-management tests。
- [ ] 7.2 Run focused frontend sidebar/thread-list tests. / 运行聚焦 frontend sidebar/thread-list tests。
- [ ] 7.3 Run `npm run typecheck`. / 运行 TypeScript typecheck。
- [ ] 7.4 Update Trellis code-specs if implementation changes executable contracts for Codex provider-home scanning or catalog source status. / 如果实现改变 Codex provider-home scanning 或 catalog source status 的 executable contract，更新 Trellis code-specs。
- [ ] 7.5 Record manual verification: create managed-provider Codex session, restart app, confirm left sidebar still shows the session with provider label and archive/delete/folder actions work. / 记录手工验证：创建 managed-provider Codex session，重启 app，确认左侧栏仍显示该 session，并且 provider label、archive/delete/folder actions 可用。
