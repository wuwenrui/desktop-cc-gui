## Why

`workflow_dispatch` Release pipeline 在 2026-06-21 run 27905632604 上 `macos (x86_64)` job 跑了 **42m 54s**,其中 `Build app bundle` 36m 35s;同期 `macos (aarch64)` 仅 11m 03s。逐项分析三份 job 日志(本次 x86_64 = 冷启,本次 aarch64 = 命中,6/17 x86_64 = 命中)得到:

- 同样命中 cache 的情况下,x86_64 release build 14m 40s vs aarch64 6m 26s(2.28×,属架构差,可接受)。
- 本次 x86_64 冷启多花的 ~18m 25s 来自 451 个 crate 全部从零编译,cache slot 之前从未被有效填充。
- `swatinem/rust-cache@v2` 只能缓存 `target/` 目录,在 `cargo` 重新跑 `cargo build` 时仍需重走 mtime 指纹检查,首次冷启无任何命中。

需要把 cache 命中率稳态拉到 ≥ 80%,并对剩余的冷启场景提供 sccache 兜底,降低 x86_64 Release pipeline wall-clock。

参考数据(均来自真实 job 日志):

| Job | cache | `Compiling` 行 | `cargo build` 时长 | 整 job wall-clock |
|---|---|---|---|---|
| x86_64 本次 | No cache found | 451 | 33m 05s | 42m 54s |
| x86_64 6/17 | Cache hit | 3 | 14m 40s | 24m 49s |
| aarch64 本次 | Cache hit | 3 | 6m 26s | 11m 03s |

## 目标与边界

### 目标

- 在 `.github/workflows/release.yml` 的 4 个 platform job(macos aarch64、macos x86_64、windows x64、linux x64)中**稳定**保留 Rust cache 命中率,并为冷启场景提供 sccache 兜底。
- 失败时也写 cache,避免 cache slot 因失败 run 被吞掉。
- 在不修改产物体积、签名、notarization 链路的前提下,把 x86_64 整 job wall-clock 作为本轮 SLO 目标压到 **≤ 18 min**(冷启) / **≤ 12 min**(热缓存),最终以真实 `workflow_dispatch` run 数据验收。
- 把这次 CI 行为变更以 OpenSpec change 的形式落档,后续可通过 `openspec validate` 严格校验。

### 边界

- 只修改 `.github/workflows/release.yml` 一个文件,不改 `src-tauri/Cargo.toml`、不引入新的 Cargo profile、不动产物的 codesign / notarization / Tauri signing 链路。
- 不替换 `swatinem/rust-cache@v2`,仍以其为 Rust 中间产物 cache;新增的 sccache 负责 rustc 编译结果 cache,两者分层。
- 不重排 release matrix 顺序,不拆分 job,不引入自托管 runner,不引入 cargo-chef 预热。
- 不动 npm / pnpm / tauri CLI 等前端步骤,本次只针对 Rust 编译链路。

## 非目标

- 不优化 Apple Silicon vs Intel 的架构差距(2.28× 是物理事实,通过换 runner / 交叉编译可以解决,但属于后续单独 change)。
- 不实现 `release.yml` 拆分、matrix 重组、cross-compile、self-hosted runner、cargo-chef 预热(已记入下次评估)。
- 不变更 release artifact 的体积、启动时间、bundles 列表、updater 行为。
- 不修改 OpenSpec 主 spec 中现有的 capability(新增 capability:`release-pipeline-ci-cache-perf`)。

## What Changes

- `.github/workflows/release.yml` 的 4 个 Rust cache step 全部增加:
  - `shared-key`:按 runner label 命名(`macos-arm64-rust` / `macos-x64-rust` / `linux-x64-rust` / `win-x64-rust`),跨 run 共享同一 cache slot,避免 `swatinem/rust-cache` 默认 key 在不同 job 间漂移。
  - `cache-on-failure: true`:失败时也写 cache,避免 cache slot 被失败 run 吃掉,导致下次冷启。
- 在 4 个 Rust cache step 之后增加 `Configure sccache environment` + `Setup sccache` step,使用官方 `mozilla-actions/sccache-action@v0.0.10`(fallback 使用本地 `cargo install sccache` 不行,runner 网络受限),通过 `$GITHUB_ENV` 设置并传播到后续 `tauri build` step:
  - `RUSTC_WRAPPER=sccache`
  - `SCCACHE_GHA_ENABLED=true`(把 sccache 的 cache 也写到 GHA Cache,跨 run 复用)
  - `SCCACHE_DIR=$HOME/.cache/sccache`(macOS/Linux) / `%LOCALAPPDATA%\sccache`(Windows)
  - 兼容 macOS / Windows / Linux runner。
- 不修改 `tauri build` 命令、codesign 步骤、notarytool 步骤、artifact 上传步骤。

## 技术方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 仅调 `swatinem/rust-cache` 关键 key + `cache-on-failure` | 改动最小,几乎无风险 | 仍受限于 `target/` mtime 指纹,冷启仍是 451 个 crate 重新 codegen | 部分采用 |
| B. 替换为 `cargo-chef` 预热 job | 冷启可降到 8-12m | 多一个 job、artifact 上传 / 下载 1-3 min,改动大 | 暂不采用,留作下次 |
| C. 仅加 sccache,不动 `swatinem/rust-cache` | rustc 调用层缓存,命中率比 `target/` 高 | Windows hosted runner 通常是 MSVC host toolchain,需真实 release run 验证兼容性 | 部分采用 |
| D. A + C 一起做 | 综合:key 稳定 + 冷启有兜底,改动可控在 release.yml 一个文件 | 需要验证 sccache 在 GHA macOS Intel runner 的稳定性 | **Adopt** |
| E. 改 `[profile.release]` 降低 LTO / codegen-units | 链接阶段可砍 3-5 min | 改产物体积,需本地 build 验证契约,不在本次范围 | 暂不采用 |
| F. 在 aarch64 上 cross-compile x86_64 | 整 job 可压到 12-15m | Tauri + macOS private API + objc2 交叉编译有 entitlements 风险 | 暂不采用 |

## Capabilities

### New Capabilities

- `release-pipeline-ci-cache-perf`:release pipeline 的 Rust 编译 cache 行为契约,覆盖 key 稳定性、失败时写 cache、rustc 调用层 sccache 兜底。

### Modified Capabilities

- None.

## Impact

- CI / Workflow:
  - `.github/workflows/release.yml`(3 个 platform job 共 4 处 Rust cache step + 4 处新增 Configure/Setup sccache step)
- Build / Cargo:
  - 不修改 `src-tauri/Cargo.toml`、不修改 `package.json`、不改 `tauri build` 命令。
- 产物 / 签名 / 发行:
  - 产物体积、codesign identity、notarytool credentials、Tauri updater signature 链路全部不变。
- Specs:
  - 新增 `openspec/specs/release-pipeline-ci-cache-perf/spec.md`(在 archive 时由本 change 的 spec delta 同步)。
- 用户感知:
  - 不可见,纯 CI 提速。
- 回滚:
  - `git revert` 即可,无 migration。

## 验收标准

- 验收走真实 GitHub Actions run,不在本地模拟。
- 本次 commit 触发 1 次 release run 之后:
  - `macos (x86_64)` 整 job wall-clock 目标 **≤ 18 min**(冷启 SLO) / **≤ 12 min**(热缓存 SLO);若未达成,记录 residual risk 并进入 follow-up。
  - `macos (aarch64)` 整 job wall-clock **≤ 12 min**;windows / linux 不退化。
  - sccache 在所有 4 个 platform job 的 `Build app bundle` step 日志里出现 `sccache: compile` 计数 ≥ 0,且 `sccache: server` / `sccache stats` 段未报错。
  - 4 个 job 的 artifact(`*.app.tar.gz`、`.msi`、`.deb`/`.AppImage` 等)均成功上传,体积与基线偏差 **< 5%**。
- OpenSpec 严格校验通过:
  - `openspec validate 2026-06-22-release-pipeline-cache-sccache --strict --no-interactive` 退出码 0。
- 仓库级硬门禁:
  - `npm run typecheck` 退出码 0(本次未改 TS,理论上无需重跑但需确认)。
  - `npm run lint` 不引入新 violation(本次未改 TS,理论上无需重跑)。
  - 不动 Rust 源码,`cargo test --manifest-path src-tauri/Cargo.toml` 不强制要求重跑,但需在 PR 描述中说明本次未触动后端。

## Risk

- [Risk] sccache 在 macOS Intel runner 上冷启时下载可能慢,导致 5-10s 额外开销。
  -> Mitigation: 用 `mozilla-actions/sccache-action`,action 自带 binary/cache,避免在 runner 上 `cargo install sccache`。
- [Risk] sccache 在 Windows + MSVC 工具链下偶发 hash miss。
  -> Mitigation: Windows hosted runner 通常使用 MSVC host toolchain,必须以真实 `workflow_dispatch` run 验证;如运行时报 sccache 失败,可仅在 Windows job 关闭 `RUSTC_WRAPPER`。
- [Risk] `swatinem/rust-cache` 的 `shared-key` 在某些 runner image 下与默认 key 冲突,导致命中异常。
  -> Mitigation: 在第一次 release run 后检查 `Restored from cache` / `No cache found` 日志;若异常,删除 `shared-key` 回退默认。
- [Risk] 用户重复触发 `workflow_dispatch` 时,sccache GHA cache 写入超 10 GB 上限被 GHA 拒绝。
  -> Mitigation: sccache 默认会按 crate + toolchain 维度去重,单次 run 增量 ≤ 1 GB;若超限可改 `SCCACHE_CACHE_SIZE` 上限或切换 S3 backend(暂不必要)。

## Migration

无需 migration。`git revert` 即可回退。

## Open Questions

- sccache 实际能省多少时间需要第一次 release run 后实测。如实测 x86_64 仍 > 18 min,再评估 B 方案(cargo-chef 预热)。
