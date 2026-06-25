## 1. Release.yml Cache Key Hardening

- [x] 1.1 [P0][depends:none][I: current `swatinem/rust-cache@v2` step in 4 platform jobs][O: `shared-key: v1-<label>-rust` + `cache-on-failure: true`][V: `.github/workflows/release.yml` 中 4 个 platform cache label 均存在;第一次 release run 日志在 4.1 继续确认 `Restored from cache key` / `Cache hit`] 给 4 个 Rust cache step 显式命名 cache slot 并允许失败时写 cache。
- [x] 1.2 [P0][depends:1.1][I: 4 个 Rust cache step][O: 与默认 key 不冲突的 `v1-` 前缀][V: proposal/design 说明旧 `v0-rust-build_*-*` cache 仍存在但不会被新 key 命中] cache slot 命名加 `v1-` 前缀,避免与 GHA 已有 cache 冲突。

## 2. Sccache Cold-Start Fallback

- [x] 2.1 [P0][depends:1.1][I: 4 个 platform job][O: `mozilla-actions/sccache-action@v0.0.10` step,通过 `$GITHUB_ENV` 设置 `RUSTC_WRAPPER=sccache` + `SCCACHE_GHA_ENABLED=true`][V: action tag `v0.0.10` 存在,workflow YAML parse 通过;第一次 release run 日志在 4.1 继续确认 `sccache: compile` 计数 ≥ 0 且 sccache stats 段无 error] 在 4 个 Rust cache step 之后加 sccache 兜底。
- [x] 2.2 [P1][depends:2.1][I: sccache 默认 cache dir][O: 显式 `SCCACHE_DIR=$HOME/.cache/sccache` (macOS/Linux) / `$env:LOCALAPPDATA\sccache` (Windows)][V: `.github/workflows/release.yml` 中 macOS/Linux/Windows 均通过 `$GITHUB_ENV` 写入;第一次 release run 在 4.1 继续确认日志中不报 `cache dir not found`] 显式指定 sccache cache 目录,避免 runner 清理时丢 cache。
- [ ] 2.3 [P1][depends:2.1][I: 4 个 platform job 的 GHA cache 配额][O: 监控第一次 release run 的 sccache 写 cache 体积,若 > 5 GB 降级为 `SCCACHE_DIR=$RUNNER_TEMP/sccache`][V: 日志中无 `cache size exceeded` 错误] 监控 sccache 写 cache 体积,超过 GHA 10 GB 上限 50% 时降级。

## 3. OpenSpec Writeback

- [x] 3.1 [P0][depends:2.1][I: 新 capability `release-pipeline-ci-cache-perf`][O: `openspec/changes/2026-06-22-release-pipeline-cache-sccache/proposal.md` + `design.md` + `tasks.md` + `specs/release-pipeline-ci-cache-perf/spec.md`][V: 文件存在且内容完整] 写 OpenSpec change 三件套(proposal / design / tasks)和 spec delta。
- [x] 3.2 [P0][depends:3.1][I: change artifacts][O: `openspec validate 2026-06-22-release-pipeline-cache-sccache --strict --no-interactive` 退出码 0][V: 命令输出无 error] 跑 OpenSpec 严格校验。
- [x] 3.3 [P0][depends:2.1][I: 本次未改 TS / Rust 源码][O: `npm run typecheck` 退出码 0][V: 命令退出码为 0] 跑仓库级 typecheck 硬门禁,确认本次未引入 TS 回归。

## 4. Live Verification And Rollback Safety

- [ ] 4.1 [P0][depends:2.1][I: 一次 `workflow_dispatch` 触发的 release run][O: 记录 x86_64 整 job wall-clock 是否达到 ≤ 18 min(冷启 SLO)/ ≤ 12 min(热缓存 SLO),aarch64 / windows / linux 不退化][V: 实际 run 的 job wall-clock 数据] 触发一次真实 release run 验证 wall-clock 指标。
- [ ] 4.2 [P0][depends:4.1][I: 4 个 platform job 的 artifact][O: 所有 `*.app.tar.gz` / `.msi` / `.deb` / `.AppImage` 等 artifact 成功上传,体积偏差 < 5%][V: release page artifact 列表 + artifact 大小对比上一次的 run] 验证产物契约未变,artifact 全部成功上传。
- [ ] 4.3 [P1][depends:4.1][I: 若 4.1 验收未达 18 min 上限][O: 在 PR 描述中记录 residual risk,并开 follow-up issue 评估 cargo-chef 预热 / 自托管 runner / cross-compile][V: issue 链接 / PR 描述段落] 如未达目标,记录 residual risk 并开 follow-up。
- [ ] 4.4 [P1][depends:2.1][I: sccache 兼容性 fallback][O: PR 描述包含一段 `if sccache fails on a runner, set the step `if: false` to disable it`][V: PR 描述段落存在] PR 描述中写明 sccache 兼容性 fallback 操作步骤。

## 5. Archive Gate

- [ ] 5.1 [P0][depends:3.2, 3.3, 4.1, 4.2][I: 全部 task 完成 + OpenSpec 校验通过 + live run 验证通过][O: `openspec archive 2026-06-22-release-pipeline-cache-sccache` 同步 spec delta 到 main spec][V: `openspec/specs/release-pipeline-ci-cache-perf/spec.md` 内容已同步] 跑 archive 命令,把 spec delta 落到 main spec。
