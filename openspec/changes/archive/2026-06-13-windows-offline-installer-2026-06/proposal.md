# Proposal: Windows Offline Installer 2026-06

OpenSpec change: `windows-offline-installer-2026-06`

## 目标与边界

### Why

`desktop-cc-gui` issue #680（Windows 安装包无法离线安装，安装时提示 `failed to install Webview2`）复现了 Tauri 2 在 Windows 上 NSIS / WiX 安装器走 WebView2 Evergreen Bootstrapper 在线下载链时的固有问题：用户机器离线 / 国内网络访问 `go.microsoft.com` 受限时，bootstrapper 拉不到 `MicrosoftEdgeWebview2Setup.exe`，安装器直接中断并报 `failed to install Webview2`，整个 app 装不进去。

当前 `mossx`（product = `ccgui`）的 Windows 安装包构建路径在 `package.json:73` `tauri:build:win` 与 `.github/workflows/release.yml:296` 都直接走 `tauri build --bundles nsis`，没有覆盖 Tauri 默认的 `webviewInstallMode`。这是与 #680 完全相同的风险面。

`tauri-bundler` 2.5.x 公开了 `tauri.conf.json#bundle.windows.webviewInstallMode` 配置项。本 change 在 `tauri.windows.conf.json` 中把 WebView2 安装策略从默认 `downloadBootstrapper` 切换为 `offlineInstaller`，让 Tauri 在 build 时**自动**下载 Evergreen Standalone Installer（来自 `https://go.microsoft.com/fwlink/?linkid=2124701`，x64 架构）并嵌入 NSIS 安装器，从而把 #680 闭环。

### Goals

- Windows NSIS 安装器在没有公网 / 受限网络下也能完成 WebView2 引导，最终 app 启动成功。
- 已装有兼容 Evergreen WebView2 的机器（Win 11 默认、Win 10 多数已带）继续走快速路径，体积与启动开销不显著退化。
- 把"Windows 安装包 WebView2 策略"在 spec 里钉死，防止后续 contributor 改回默认 bootstrapper。
- 不影响 macOS（DMG/.app）与 Linux（AppImage/.deb）的任何 bundle 行为；这两条路径在本 change 内零代码改动。
- 不增加 release CI 复杂度、不需要维护 vendor 二进制目录。

### Non-Goals

- 不打包 WebView2 Fixed Runtime（"内嵌二进制 + 自带 webview"方案，~+120MB；且每个架构单独分发）。该方案本 change 不做。
- 不修复 WebView2 / Chromium native `STATUS_ACCESS_VIOLATION`（issue #663 范围），那是 `archive/2026-06-06-harden-client-renderer-stability-under-pressure/` 链路。
- 不在沙盒跑 `tauri build --bundles nsis` 验证最终安装器二进制（沙盒非 Windows runner），由 release CI 实际打产物并人工 smoke；本 change 在沙盒内只验证配置 / 文档 / 治理层面正确性。
- 不改 `tauri.conf.json` 的 `bundle.targets: "all"` 与 `bundle.windows` 之外的字段（如 macOS DMG、Linux deb）。
- 不引入 WiX bundle 切换；保持 NSIS 单产物，避免额外安装器分支。
- 不在仓库内自建 `vendor/webview2/` 占位目录：Tauri build 时自动从 `https://go.microsoft.com/fwlink/?linkid=2124701` 拉取并嵌入，build 产物 `target/release/bundle/nsis/` 自然包含，二进制不进 git。

## 技术方案与取舍

候选至少 2 个，对比后选定方案：

### Option A（不选）：完全沿用 Tauri 默认行为

- 做法：什么都不改，让 `tauri build --bundles nsis` 走默认 `downloadBootstrapper`。
- 优点：零改动、零文档。
- 缺点：#680 完全没解决；国内网络偶发 `go.microsoft.com` 抽风会重现失败；install 体验靠"用户机器已装 WebView2"碰运气。

### Option B（不选）：完全内嵌 WebView2 Fixed Runtime

- 做法：手动下载 WebView2 Fixed Runtime 完整目录（~120MB），用 `webviewInstallMode: { type: "fixedRuntime", path: "..." }` 把二进制塞进 app 资源，app 自带 webview。
- 优点：彻底离线、用户机器零依赖。
- 缺点：体积 +~120MB；每个架构（x64 / arm64）要单独 bundle；CI 时间与带宽开销大；后续 WebView2 安全更新要重新出包；要在仓库内维护 vendor 二进制目录（gitignore + CI 注入 + 卫生 contract）。

### Option C（采纳）：`offlineInstaller` 一行配置 + Tauri 自动嵌入

- 做法：在 `src-tauri/tauri.windows.conf.json` 的 `bundle.windows.webviewInstallMode` 节点切到 `offlineInstaller`。
- 依据：`tauri-bundler` 2.5.x `crates/tauri-bundler/src/bundle/windows/util.rs` 显式提供 `download_webview2_offline_installer(base_path, arch)`，从 `https://go.microsoft.com/fwlink/?linkid=2124701`（x64）/ `linkid=2099617`（x86）拉 Evergreen Standalone Installer 嵌入 bundle。
- 优点：
  - **fall-through 兜底**：Tauri NSIS 模板在安装时先扫本机 Evergreen WebView2 版本号，已装且 ≥ 最低版本直接复用；没装就跑内置离线安装器，不走 `go.microsoft.com`。
  - **联网场景正向影响**：用本地 exe 装 WebView2 比走 bootstrapper 在线下载更快，国内网络下尤其明显。
  - **零代码逻辑改动**：只动一行 config，不动 Rust / React / 任何产品代码 / CI 步骤，回归风险极小。
  - **平台隔离干净**：配置在 `bundle.windows` 节点下，macOS / Linux bundle 不读这个字段。
  - **零仓库卫生负担**：Tauri 自动下载 + 嵌入，build 产物 `target/release/bundle/nsis/` 是 gitignored 的，二进制不进仓库、不需要 vendor 占位、不需要 `.gitignore` 调整。
- 缺点：
  - 安装器体积 +~127MB（Evergreen Standalone Installer 大小，Tauri 官方文档明示）。
  - 首次 build 时 Tauri 会从 `go.microsoft.com` 拉一次 ~127MB 二进制，build 内部 cache（`target/release/bundle/nsis/`）跨本机 build 复用；CI 每次 windows runner build 重新拉（`actions/cache` 缓存 `target/` 不现实，因为有大量 Rust 缓存会冲突；可接受，~30s-1min 取决于网络）。

### 兼容性矩阵（capability matrix）

| 场景 | WebView2 已装且兼容 | Tauri 默认 `downloadBootstrapper` | 本 change `offlineInstaller` |
|---|---|---|---|
| 联网 + Win 11 / Win 10 已有 | 是 | 直接复用 | 直接复用（fall-through 1，行为不变） |
| 联网 + 全新机器 | 否 | 走 `go.microsoft.com` 下载 bootstrapper + 完整包 | 跑内置离线安装器（fall-through 2，更稳更快） |
| 离线 + Win 11 / 已有 | 是 | 直接复用 | 直接复用（fall-through 1） |
| **离线 + 全新机器** | **否** | **失败：#680 报错** | **跑内置离线安装器（fall-through 2，#680 闭环）** |
| macOS DMG | n/a | 不受影响 | 不受影响（`bundle.windows` 节点不读） |
| Linux AppImage / deb | n/a | 不受影响 | 不受影响（`bundle.windows` 节点不读） |

### 验收标准

- 配置生效：合并 `tauri.windows.conf.json` 后，`tauri build --bundles nsis --config src-tauri/tauri.windows.conf.json` 在 Windows runner 上生成的 `*-setup.exe` 包含 `MicrosoftEdgeWebview2Setup.exe`（人工 smoke，由 release CI 产物体积间接验证，相对 baseline 应 +~127MB）。
- 沙盒内可验证：
  - `rg "offlineInstaller" src-tauri/tauri.windows.conf.json` 命中。
  - `python3 -c "import json; json.load(open('src-tauri/tauri.windows.conf.json'))"` 退出 0（JSON 合法）。
  - `openspec validate windows-offline-installer-2026-06 --strict --no-interactive` 退出 0。
  - `openspec list --json` 出现该 change。
- spec delta 落地：新增 `windows-offline-installer` capability，spec.md 含 `WebView2 Offline Install Strategy` ADDED Requirement，覆盖 fall-through 语义与禁止回退到 `downloadBootstrapper`。
- README 不动 `README.md` / `README.zh-CN.md` 的 WebView2 章节措辞（避免给用户造成"装包前还要先装 WebView2"的误解）。

## What Changes

- 改 `src-tauri/tauri.windows.conf.json`：在 `bundle` 下加 `windows.webviewInstallMode: { type: "offlineInstaller" }`。
- 新增 `openspec/changes/windows-offline-installer-2026-06/specs/windows-offline-installer/spec.md`：change-local ADDED Requirements。

## Capabilities

### New Capabilities

- `windows-offline-installer`：定义 Windows NSIS 安装器 WebView2 离线安装策略 contract，钉死 `offlineInstaller` 模式与禁止回退到 bootstrapper。

## Impact

- 产物变化：release 产出的 `windows-x64` artifact `*-setup.exe` 体积 +~127MB。
- CI 变化：windows-latest runner build 步骤首次多 ~30s-1min（Tauri 从 `go.microsoft.com` 拉 Evergreen Standalone Installer）；后续 build 受 Tauri 内部 cache 命中加速。无需新增任何 CI step。
- 平台影响：macOS / Linux 完全无影响。
- 文档影响：`openspec/specs/windows-offline-installer/spec.md` 同步到主线（archive 后）。
- 代码影响：零产品代码改动。
- 仓库卫生影响：零。Tauri build 产物落到 `target/release/bundle/nsis/`，该路径已 gitignore。
- 回归风险：低。`webviewInstallMode` 是 Tauri 公开 API，fall-through 行为由 Tauri 自身保证；本 change 只在配置层做切换。
