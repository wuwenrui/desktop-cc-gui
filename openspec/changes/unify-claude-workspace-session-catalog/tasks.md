## 0. Architecture Contract Baseline

- [x] 0.1 建立 Claude session lifecycle 边界表；明确 source scanner、ownership resolver、catalog projection、metadata overlay、frontend surface 的输入/输出/禁止职责；验证 design 与 spec delta 均引用同一边界。
- [x] 0.2 定义 `WorkspaceSessionSourceCompleteness` 与 per-engine source status 映射；验证 complete、authoritative_empty、partial、degraded、uncertain_empty 的删除/保留语义。
- [x] 0.3 定义 ownership evidence code；至少覆盖 `cwd-exact`、`cwd-longest`、`project-dir-direct`、`git-root-inferred`、`ambiguous-sibling`、`cwd-project-conflict`、`source-incomplete`。
- [x] 0.4 建立 regression fixture matrix；按 owner case、source completeness、metadata state、frontend surface 四个轴列出最小测试组合。
- [x] 0.5 做调用点审计；用 `rg` 标出 `listClaudeSessions`、`listWorkspaceSessions`、`workspaceId` 二次过滤、title fallback、folder/archive key 的现有调用点并写入实现备注。
- [x] 0.6 定义 source-fact cache schema；明确 cacheable facts、禁止缓存字段、fingerprint、scannerVersion、schemaVersion 与 cache namespace。

## Phase 1: Catalog Membership Correctness

## 1. Backend Source Facts

- [x] 1.1 提炼 Claude source fact 类型；输入为 Claude transcript/path scan result，输出包含 canonical session id、display id、physical path、cwd、project dir、parent id、timestamps、first real user message、message count、source health；验证 Rust unit 覆盖正常 transcript 与 bounded summary。
- [x] 1.2 调整 Claude scanner，遇到 cwd 不匹配、cwd 缺失、malformed/oversized transcript 时返回 source diagnostic 或 unresolved candidate，而不是静默 `None`；验证 Rust unit 覆盖 successful-empty 与 uncertain-empty 分离。
- [x] 1.3 确保 Claude catalog summary 不包含完整 transcript body 或大 inline media payload；验证 large payload fixture 不进入 summary。
- [x] 1.4 将 control-plane filtering 的 title evidence 输出与 catalog summary 输出分开；验证 filtered GUI/Codex/JSON-RPC payload 不成为 first real user message。

## 2. Backend Ownership And Projection

- [x] 2.1 实现集中 ownership resolver；输入 source fact、workspace scope、git/root/project-dir evidence，输出 owner workspace id、confidence、evidence code 或 unresolved/ambiguous；验证 parent `/repo` 与 child `/repo/sub` 优先级。
- [x] 2.2 将 `session_management.rs` 的 Claude catalog entry 构建切换到 centralized resolver；验证 main project aggregate 包含 child owner row，worktree-only scope 不混入 parent/sibling。
- [x] 2.3 增加 per-engine source completeness 到 catalog response；输出至少能表达 complete、authoritative_empty、partial、degraded、uncertain_empty；验证 cap/timeout/error 不被当作 authoritative empty。
- [x] 2.4 将 archive/folder/custom-title metadata key 迁移到 engine + owner workspace + canonical session id 的 stable key 读取/写入兼容层；验证相同裸 session id 跨 workspace 不碰撞。
- [x] 2.5 保持 metadata overlay 与 disk existence 分离；验证 partial Claude scan 不触发 metadata orphan cleanup，authoritative missing 才允许 cleanup candidate。
- [x] 2.6 实现 source completeness 保守合并；验证 Claude incomplete 不会被 Codex/Gemini/OpenCode complete 覆盖。
- [x] 2.7 处理 ownership conflict；验证 cwd 与 project dir 指向不同 workspace 时不会猜 owner，metadata mutation 返回 unresolved-owner。

## 3. Tauri Service Contract

- [x] 3.1 扩展 `WorkspaceSessionCatalogEntry` / page mapping 类型，加入 stable key、owner evidence、source completeness/status 字段；验证 `src/services/tauri/sessionManagement.ts` mapping test。
- [x] 3.2 保持新增字段 additive，不破坏旧调用方；验证 TypeScript compile 与已有 service tests。
- [x] 3.3 为 `listClaudeSessions` 标注或隔离用途，使其只作为 transcript/detail/diagnostic/fallback seed，不作为 default membership API；验证调用点搜索结果收敛。
- [x] 3.4 为 unresolved / ambiguous candidates 设计 redacted diagnostic payload；验证不泄漏完整 transcript body 或大 inline media。

## 4. Frontend Projection Consumption

- [x] 4.1 修改 `useThreadActionsSessionCatalog`，移除 exact `entry.workspaceId === currentWorkspaceId` 二次 membership filter；输入为后端 projection，输出保留 child/worktree owner rows；验证 Vitest 覆盖 main aggregate child row。
- [x] 4.2 修改 `useThreadActions` Claude sidebar merge，使 default membership 以 catalog active strict projection 为准，native Claude list 只参与 transcript/detail/diagnostic/continuity seed；验证 native empty 不清空 catalog Claude row。
- [x] 4.3 将 last-good continuity 改为 source-completeness aware；输入为 partial/degraded/uncertain_empty 时保留 last-good，authoritative_empty/authoritative removal 时清除；验证 Vitest 覆盖两类 empty。
- [x] 4.4 确保 Sidebar / Workspace Home / Session Management 对 active strict projection 的 membership 口径一致；验证同一 fixture 下三处 entry keys 一致或差异有 display-window/filter 解释。
- [x] 4.5 确保 native-only row 不扩大 complete catalog membership；验证 complete strict projection 外的 native Claude row 只能进入诊断/related/global 路径。
- [x] 4.6 将 incomplete continuity 状态传到 UI；验证 preserved last-good Claude row 不被渲染成 fully fresh catalog row。

## 5. Title And Display Consistency

- [x] 5.1 提炼共享 title resolver；输入 custom title、mapped title、native title、first real user message、previous meaningful title、fallback，输出稳定显示标题；验证弱 fallback 不覆盖强标题。
- [x] 5.2 接入 Sidebar、Session Management list、Session Curtain；验证同一 Claude session 在三个 surface 中标题一致。
- [x] 5.3 保留 parent/child relationship metadata 的 continuity merge；验证 degraded refresh 不丢 parentSessionId。
- [x] 5.4 明确 title confidence 顺序与写回规则；验证低置信度 fallback 不写回覆盖 custom/mapped title metadata。

## 6. Tests And Regression Fixtures

- [x] 6.1 添加 Rust fixture：parent/child worktree、missing cwd direct project-dir fallback、ambiguous sibling、malformed transcript、large inline payload、metadata orphan；验证 `cargo test --manifest-path src-tauri/Cargo.toml session_management claude_history`。
- [x] 6.2 添加 Vitest：catalog uncertain empty 保留 Claude、authoritative empty 清除 Claude、main aggregate child row 不被 exact filter 吞、native empty 不覆盖 catalog、title resolver 一致。
- [x] 6.3 添加 service mapping tests：source completeness、stable key、owner evidence、entry-level diagnostics 字段映射。
- [x] 6.4 添加 mutation tests：project aggregate child owner archive/unarchive/delete/move/rename 均按 stable key 和真实 owner routing。
- [x] 6.5 添加 negative tests：unresolved/conflicting owner 拒绝 metadata mutation，partial scan 不提供 destructive orphan cleanup。

## Phase 2: Source-Fact Cache Acceleration

## 7. Backend Source-Fact Cache

- [x] 7.1 新增或提炼 source-fact cache 模块；支持读取、写入、删除、namespace/version 校验；验证 cache 文件不存完整 transcript、大 inline payload 或 organization overlay。
- [x] 7.2 为 Claude scanner 接入 read-through cache；cache hit 返回 bounded source facts，cache miss/stale direct scan 后 best-effort write；验证 unchanged JSONL 第二次 listing 不重复解析 summary。
- [x] 7.3 实现 fingerprint invalidation；mtime/size/schemaVersion/scannerVersion/cache namespace mismatch 必须触发 rescan；验证 stale cache 不产生 authoritative empty。
- [x] 7.4 实现 corrupt/unavailable fallback；cache entry 损坏、cache store 读写失败时 direct scan 并记录 cache degraded diagnostic；验证 listing 不因 cache 故障清空。
- [x] 7.5 确保 cache 命中后仍重新执行 ownership resolver、metadata overlay、catalog projection；验证 workspace graph 或 selected scope 变化不会复用旧 membership。
- [x] 7.6 增加 cache diagnostics；暴露 hit/miss/stale/rebuild/failure 计数或 reason，且这些 metrics 不参与 session totals。
- [x] 7.7 提供 bounded cache rebuild / clear path；验证删除 cache 后下一次 catalog refresh 能从 Claude JSONL 重建 projection。

## 8. Cache Tests And Performance Evidence

- [x] 8.1 添加 Rust cache fixture：hit、miss、stale fingerprint、schema mismatch、corrupt entry、store unavailable、cache deleted rebuild。
- [x] 8.2 添加 cache correctness tests：cache hit 不缓存 ownerWorkspaceId / archive / folder / custom title / display window。
- [x] 8.3 添加 performance-oriented test 或 benchmark evidence：大历史 fixture 下第二次 catalog summary 使用 cache hit，记录解析次数、耗时或 diagnostic counters。
- [x] 8.4 添加 fallback tests：关闭 cache 与开启 cache 生成同等 membership projection。

## Phase 3: Validation And Closeout

## 9. Validation And Closeout

- [x] 9.1 运行 `openspec validate unify-claude-workspace-session-catalog --strict --no-interactive`，输出必须通过。
- [x] 9.2 运行 focused Rust tests：`cargo test --manifest-path src-tauri/Cargo.toml session_management claude_history`；若命名过滤不匹配，记录实际执行的最小后端测试命令。
- [x] 9.3 运行 focused Vitest：`npx vitest run` 覆盖 threads hooks、settings catalog hook、sessionManagement service mapping。
- [x] 9.4 运行 cache focused tests 或 benchmark command；记录 cache hit/miss/stale/rebuild diagnostics。
- [x] 9.5 运行 `npm run typecheck` 与 `npm run check:runtime-contracts`；若存在无关失败，记录隔离证据。
- [x] 9.6 更新相关 Trellis spec 或 implementation guide 中的 session projection/ownership/cache 约定；验证没有把运行态 `.omx` 或 local-only state 作为事实源。
- [x] 9.7 记录实现证据：调用点审计结果、fixture matrix、关键测试命令、source completeness 行为、cache diagnostics、cache rebuild 证据。
- [x] 9.8 Review 后收紧 Claude control-plane filter，确保纯 `codex app-server` 命令仍被隐藏，但自然语言提到 `codex app-server` 不吞 Claude Code 会话；同步 Settings Session Management page size 到 `999` 并补回归测试。
