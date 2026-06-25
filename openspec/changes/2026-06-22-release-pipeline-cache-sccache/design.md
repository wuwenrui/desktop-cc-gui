## Context

`desktop-cc-gui` 使用 Tauri 2.9.6 + Rust 1.96 (GHA stable) 作为后端,React 19 + Vite 7 作为前端。`.github/workflows/release.yml` 在 `workflow_dispatch` 事件上启动 Release pipeline,matrix 为:

- `macos-latest` (aarch64)
- `macos-15-intel` (x86_64)
- `windows-latest` (x64)
- `ubuntu-latest` (linux x64)

每个 platform job 的核心 Rust 编译 step 是 `swatinem/rust-cache@v2`,`workspaces: './src-tauri -> target'`,`cache-bin: false`。`tauri build` 内部依次执行 `npm run build` (Vite) → `cargo build --release` → codesign → notarize → 打包。

2026-06-21 run 27905632604 的真实数据显示:

- x86_64 job 因为 cache slot 此前未填充(可能因为上一次失败 run / GHA 7 天 TTL 滚动),从 451 个 crate 从零开始编译,整 job 跑了 42m 54s。
- aarch64 job 命中 cache(`Cache hit for: v0-rust-build_macos-Darwin-arm64-5d48e741-a3b7d002`),只编 3 个 crate,整 job 11m 03s。
- 6/17 x86_64 run 也命中 cache,整 job 24m 49s,`cargo build` 14m 40s。

这条 pipeline 没有任何 `RUSTC_WRAPPER=sccache` 配置,也没有 `cache-on-failure: true`。失败 run 会消耗 cache slot 但不写回,导致 cache 命中率不稳定。

## Goals / Non-Goals

**Goals:**

- 把 x86_64 release job 的稳态 wall-clock 作为本轮 SLO 目标压到 ≤ 18 min(冷启) / ≤ 12 min(热缓存),最终以真实 `workflow_dispatch` run 数据验收。
- 通过 `swatinem/rust-cache` 的 `shared-key` 稳住 cache slot,跨 `workflow_dispatch` 复用。
- 通过 sccache 兜底冷启场景,实测 `cargo build` 阶段缩短。
- 失败 run 也写 cache,避免 cache slot 被吞。
- 行为契约 OpenSpec 化,后续可被 `openspec validate --strict` 校验。

**Non-Goals:**

- 不优化架构差(Apple Silicon vs Intel)。
- 不替换 `swatinem/rust-cache`,只在其上叠加 sccache。
- 不改产物、签名、notarization 链路。
- 不做 cargo-chef 预热 / 自托管 runner / cross-compile(后续 change 再评估)。

## Decisions

### Decision 1: `swatinem/rust-cache` 加 `shared-key` + `cache-on-failure: true`

`shared-key` 显式命名 cache slot 为 `macos-arm64-rust` / `macos-x64-rust` / `linux-x64-rust` / `win-x64-rust`,按 runner label 隔离,跨 run 复用同一 slot。`cache-on-failure: true` 让失败 run 也写 cache。

原因:

- 当前 cache key 由 `swatinem/rust-cache` 默认生成(`v0-rust-build_<label>-<hash>`),hash 包含 `Rust Versions + CARGO_HOME + CARGO_INCREMENTAL + CARGO_TERM_COLOR + lockfile`。当 CI 环境变量顺序变化或 lockfile 微调,hash 漂移,导致 cache miss。
- 显式 `shared-key` 让同 label 的 cache slot 稳定,只有 lockfile 或 Rust 工具链变更时才会重置。
- `cache-on-failure: true` 避免失败 run 吞掉 cache slot,显著提高冷启恢复速度。

备选方案:

- 不设 `shared-key`,保留默认 key:被 GHA 7 天 TTL 滚动 + job 间 hash 漂移反复触发冷启,被 reject。
- 设 `add-job-id-key: false`(默认值已经是 false):不够,默认 key 仍可能因其他变量漂移。

### Decision 2: 引入 sccache 兜底冷启

在 4 个 Rust cache step 之后,所有 platform job 加 `Configure sccache environment` + `Setup sccache` step,使用 `mozilla-actions/sccache-action@v0.0.10`。环境变量写入 `$GITHUB_ENV`,确保真正执行 `tauri build` 的后续 step 继承:

- `RUSTC_WRAPPER=sccache`
- `SCCACHE_GHA_ENABLED=true`(让 sccache 把 cache 写进 GHA Cache,跨 run 复用)
- `SCCACHE_DIR=$HOME/.cache/sccache`
- Windows runner:`SCCACHE_DIR=$env:LOCALAPPDATA\sccache`

原因:

- sccache 在 rustc 调用层缓存,key 是 `(crate hash, compiler version, env flags)`,对 `cargo` 重新跑 `cargo build` 时的 mtime 检查免疫,命中率比 `swatinem/rust-cache` 的 `target/` 缓存更高。
- aarch64 / x86_64 各自一份 sccache cache,key 含 `target` 字段,不会跨架构串。
- GHA Cache 单 cache 上限 10 GB,sccache 增量约 1 GB / run,安全。
- `mozilla-actions/sccache-action` 是 Mozilla 官方维护,Mac/Linux/Windows 都支持。Windows hosted runner 通常使用 MSVC host toolchain,需通过真实 release run 验证 sccache 兼容性。

备选方案:

- 不用 action,手写 `cargo install sccache`:首次安装要编译 sccache 自身,需要 2-3 min,不划算。
- 用 `bobthecow/sccache-action` 或社区 action:已不维护,被 reject。
- 改用 `cargo-chef` 预热:需要新加一个 job 上下传 `target/` artifact(1-3 GB),GHA artifact 上限 5 GB 接近临界,改动大,不在本次范围。

### Decision 3: 不动 `[profile.release]`

`src-tauri/Cargo.toml` 当前没有自定义 `[profile.release]`,走 cargo 默认(`opt-level=3`, `codegen-units=16`, `lto=false`)。本次不动 profile,避免:

- 产物体积变化(经验值 ±5%)需要 release note 说明。
- Tauri 2 + wry + webkit 的 LTO 行为需要本地 build 验证,不在 CI 改动范围。
- 启动时间 ±20ms 属于用户感知行为,本次不引入。

后续如需优化链接阶段,单独 change 走 profile 调优(参考上一轮报告的方案 B)。

### Decision 4: 不动 release matrix / job 顺序

matrix 4 个 platform 仍并行,`needs: build_macos && build_windows && build_linux` 不变。`build_macos` 内部两个 arch 并行。不引入新 job、不拆分。

原因:本次目标是 cache 命中 + sccache 兜底,不需要 job 拓扑变化。

### Decision 5: 行为契约 OpenSpec 化,新增 `release-pipeline-ci-cache-perf` capability

新增 `openspec/specs/release-pipeline-ci-cache-perf/spec.md`,记录:

- cache slot 必须按 runner label 显式命名
- 失败 run 也写 cache
- sccache 必须在所有 4 个 platform job 启用
- sccache cache 后端使用 GHA Cache
- 不动产物契约

archive 时由本 change 的 spec delta 同步到 main spec。

## Risks / Trade-offs

- [Risk] sccache 首次 install 慢。
  -> Mitigation: 用 `mozilla-actions/sccache-action`,action 内置 sccache binary,无需 `cargo install`。
- [Risk] sccache 在 Windows + MSVC 工具链下兼容问题。
  -> Mitigation: Windows hosted runner 通常使用 MSVC host toolchain,必须以真实 `workflow_dispatch` run 验证;若运行时报错,仅对 Windows job 关闭 `RUSTC_WRAPPER`。
- [Risk] `SCCACHE_GHA_ENABLED=true` 在 macOS runner 上写入 GHA Cache 超 10 GB 上限。
  -> Mitigation: sccache 单次 run 增量 ≤ 1 GB;若超限可降级到 `SCCACHE_DIR=$RUNNER_TEMP/sccache`(仅当次 run 有效)。
- [Risk] `shared-key` 与 GHA 现有 cache 命名冲突,导致命中旧 cache 内容。
  -> Mitigation: 命名加 `v1-` 前缀(`v1-macos-x64-rust`),避免与现有 `v0-rust-build_*-*` 冲突;旧 cache 仍可读但不会被新 key 命中。
- [Risk] 本次只跑一次 `workflow_dispatch` 触发,可能因为 GHA runner 排队导致 wall-clock 比预期高。
  -> Mitigation: 在 PR 描述中记录实际值,若未达 ≤ 18 min SLO,记录 residual risk 并开 follow-up issue 评估 cargo-chef 预热。

## Migration Plan

1. 修改 `.github/workflows/release.yml`,在 4 个 Rust cache step 中加 `shared-key` + `cache-on-failure: true`。
2. 在 4 个 Rust cache step 之后加 `Configure sccache environment` + `Setup sccache` step,使用 `mozilla-actions/sccache-action@v0.0.10`,通过 `$GITHUB_ENV` 设置 `RUSTC_WRAPPER=sccache` 和 `SCCACHE_GHA_ENABLED=true`,确保后续 `tauri build` 继承。
3. 跑 `openspec validate 2026-06-22-release-pipeline-cache-sccache --strict --no-interactive` 校验 change。
4. 跑 `npm run typecheck` 确认本次未改 TS,无回归。
5. 触发一次 `workflow_dispatch` 验证 wall-clock、cache hit、sccache 计数。
6. 验收通过后 `openspec archive 2026-06-22-release-pipeline-cache-sccache` 同步到 main spec。

Rollback:

- `git revert` 即可,无 migration,无数据迁移。
- 若 sccache 兼容性出问题,临时把 `Setup sccache` step 改为 `if: false` 关闭,只保留 `swatinem/rust-cache` 优化。

## Open Questions

- sccache 在 macOS Intel runner 的实测节省需要第一次 release run 后量化。
- 是否需要在 `npm run typecheck` 之外加 `cargo check` 验证?本次未动 Rust 源码,理论不需要,但若需 stronger confidence 可加。
- aarch64 既然已经 ≤ 12 min,是否需要把 aarch64 单独提级为 fast-track tag,只让 x86_64 / windows / linux 走完整 release?暂不实施,等本次验证后再评估。
