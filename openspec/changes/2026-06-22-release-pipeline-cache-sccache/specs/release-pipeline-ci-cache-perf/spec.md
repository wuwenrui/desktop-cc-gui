## ADDED Requirements

### Requirement: Release Pipeline Rust Cache Slot MUST Be Stable Across Runs

Release pipeline 的 `swatinem/rust-cache` step MUST 显式命名 cache slot,跨 `workflow_dispatch` run 复用同一 slot,避免默认 key 因 CI 环境变量顺序漂移导致 cache miss。

#### Scenario: cache slot 显式按 runner label 命名

- **WHEN** release pipeline 在 macOS aarch64 / macOS x86_64 / windows x64 / linux x64 任意一个 platform job 运行
- **THEN** Rust cache step MUST 显式传 `shared-key: v1-<label>-rust`,其中 `<label>` 取值为 `macos-arm64`、`macos-x64`、`win-x64`、`linux-x64`
- **AND** cache slot key MUST 加 `v1-` 前缀,与 GHA 已有 `v0-rust-build_*-*` cache 命名空间隔离

#### Scenario: 失败 run 也写 cache

- **WHEN** release pipeline 的某个 platform job 在 `Build app bundle` step 失败或被 cancel
- **THEN** Rust cache step MUST 显式传 `cache-on-failure: true`,让失败 run 也写 cache
- **AND** 下次同 label 的 release run MUST 能命中本次失败 run 写出的 cache

### Requirement: Release Pipeline MUST Use Sccache As Cold-Start Fallback

Release pipeline 在 4 个 platform job MUST 启用 sccache 作为 rustc 调用层 cache 兜底,降低冷启场景下 451 个 crate 从零编译的时间开销。

#### Scenario: 所有 platform job 启用 sccache

- **WHEN** release pipeline 在任意一个 platform job 运行
- **THEN** 该 job MUST 在 Rust cache step 之后包含 `Configure sccache environment` step,并把 `RUSTC_WRAPPER=sccache` 写入 `$GITHUB_ENV`,让后续 `tauri build` step 调用 sccache 作为 rustc wrapper
- **AND** 该 job MUST 把 `SCCACHE_GHA_ENABLED=true` 写入 `$GITHUB_ENV`,让 sccache 把 cache 写进 GHA Cache 跨 run 复用
- **AND** 该 job MUST 包含一个 `Setup sccache` step,使用 `mozilla-actions/sccache-action@v0.0.10`

#### Scenario: sccache cache dir 显式指定

- **WHEN** release pipeline 在 macOS 或 Linux runner 启用 sccache
- **THEN** `SCCACHE_DIR` MUST 显式设为 `$HOME/.cache/sccache`
- **WHEN** release pipeline 在 Windows runner 启用 sccache
- **THEN** `SCCACHE_DIR` MUST 显式设为 `$env:LOCALAPPDATA\sccache`

#### Scenario: sccache 写 cache 体积监控

- **WHEN** 单次 release run 的 sccache 写 cache 体积超过 5 GB
- **THEN** PR 描述 MUST 记录实际体积,作为评估 GHA 10 GB 单 cache 上限风险的依据
- **AND** 若超过 8 GB,follow-up issue MUST 评估降级为 `SCCACHE_DIR=$RUNNER_TEMP/sccache` 或切换 S3 backend

### Requirement: Release Pipeline MUST NOT Change Product Artifacts

Release pipeline 的 cache / sccache 改动 MUST NOT 改变 release 产物的体积、codesign identity、notarytool 凭证、Tauri updater signature 链路。

#### Scenario: 产物体积偏差

- **WHEN** release pipeline 完成一次 `workflow_dispatch` run
- **THEN** 4 个 platform job 的 release artifact 体积(`.app.tar.gz` / `.msi` / `.deb` / `.AppImage` 等)与基线 run 对比 MUST 偏差 < 5%
- **AND** artifact 列表 MUST 与基线 run 一致(没有新增或缺失 artifact)

#### Scenario: codesign / notarization / updater signature 链路不变

- **WHEN** release pipeline 完成一次 `workflow_dispatch` run
- **THEN** codesign identity MUST 仍是仓库 `vars.CODESIGN_IDENTITY` 注入的 Developer ID
- **AND** notarytool credentials MUST 仍使用仓库 `secrets.APPLE_API_KEY_*`
- **AND** Tauri updater signature MUST 仍由 `TAURI_SIGNING_PRIVATE_KEY_B64` + `scripts/macos-fix-openssl.sh` 链路产出

### Requirement: Release Pipeline Wall-Clock MUST Be Measured Against Performance Target

Release pipeline 在引入 cache + sccache 优化后,x86_64 整 job wall-clock MUST 被真实 `workflow_dispatch` run 量化,并对照本轮性能 SLO 记录验收结果。

#### Scenario: x86_64 冷启 SLO

- **WHEN** release pipeline 的 `macos (x86_64)` job 处于冷启状态(Rust cache miss、sccache 空)
- **THEN** 验收报告 MUST 记录整 job wall-clock 是否达到 ≤ 18 min 的 SLO
- **AND** 验收报告 MUST 记录 `Build app bundle` step 是否达到 ≤ 14 min 的 SLO
- **AND** 若未达成 SLO,PR 描述 MUST 记录 residual risk 并链接 follow-up

#### Scenario: x86_64 热缓存 SLO

- **WHEN** release pipeline 的 `macos (x86_64)` job 处于热缓存状态(Rust cache hit、sccache 命中)
- **THEN** 验收报告 MUST 记录整 job wall-clock 是否达到 ≤ 12 min 的 SLO
- **AND** 验收报告 MUST 记录 `Build app bundle` step 是否达到 ≤ 10 min 的 SLO
- **AND** 若未达成 SLO,PR 描述 MUST 记录 residual risk 并链接 follow-up

#### Scenario: 其他 platform job 不退化

- **WHEN** release pipeline 的 aarch64 / windows / linux job 完成
- **THEN** 整 job wall-clock MUST NOT 比基线 run 退化 ≥ 10%

### Requirement: Release Pipeline Changes MUST Be OpenSpec Validated

Release pipeline 的 cache / sccache 改动 MUST 通过 OpenSpec 严格校验。

#### Scenario: change 校验通过

- **WHEN** `openspec validate 2026-06-22-release-pipeline-cache-sccache --strict --no-interactive` 执行
- **THEN** 命令 MUST 退出码 0 且无 error
- **AND** 校验覆盖 proposal.md / design.md / tasks.md / specs/release-pipeline-ci-cache-perf/spec.md 四件套

#### Scenario: 仓库级硬门禁

- **WHEN** release pipeline change 提交 PR
- **THEN** `npm run typecheck` MUST 退出码 0(本次未改 TS,确认无回归)
- **AND** OpenSpec `validate --strict` MUST 退出码 0
- **AND** 若改动触及 Rust 源码,`cargo check --manifest-path src-tauri/Cargo.toml` MUST 退出码 0(本次未触 Rust 源码,故可跳过,需在 PR 描述说明)
