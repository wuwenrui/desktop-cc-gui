# windows-offline-installer delta

## ADDED Requirements

### Requirement: WebView2 Offline Install Strategy MUST Use Bundled Evergreen Standalone Installer

Windows NSIS 安装器 MUST 通过 `bundle.windows.webviewInstallMode` 把 WebView2 安装策略切换为 `offlineInstaller`，使 #680（`failed to install Webview2`）类离线 / 受限网络场景下安装器仍能完成 WebView2 引导。系统 MUST NOT 回退到 Tauri 默认的 `downloadBootstrapper` 模式。

`offlineInstaller` 模式下，Tauri `tauri-bundler` MUST 自动从 Microsoft 官方 Evergreen Standalone Installer URL 拉取 ~127MB 二进制（x64: `https://go.microsoft.com/fwlink/?linkid=2124701`，x86: `https://go.microsoft.com/fwlink/?linkid=2099617`）并嵌入 NSIS 安装器产物。配置 MUST 仅声明 `{ type: "offlineInstaller", silent?: bool }`，**不得**声明 `path` 字段（schema `definitions.WindowsConfig.properties.webviewInstallMode` 与 `tauri-bundler` 2.5.x 行为依据：路径由 Tauri 内部管理）。

#### Scenario: webviewInstallMode is offlineInstaller in windows config

- **WHEN** `src-tauri/tauri.windows.conf.json` 被 `tauri build --bundles nsis --config src-tauri/tauri.windows.conf.json` 加载
- **THEN** `bundle.windows.webviewInstallMode.type` MUST 等于 `offlineInstaller`
- **AND** `bundle.windows.webviewInstallMode` MUST NOT 包含 `path` 字段
- **AND** JSON MUST 仍合法（`python3 -c "import json; json.load(open('src-tauri/tauri.windows.conf.json'))"` 退出 0）

#### Scenario: macOS / Linux bundle config is untouched

- **WHEN** macOS 或 Linux 路径走 `tauri build` 默认 config（`src-tauri/tauri.conf.json`）
- **THEN** `bundle.windows` 字段 MUST NOT 出现在主 config 内
- **AND** macOS DMG / Linux AppImage / Linux deb 的产物 MUST NOT 因本 change 而变化

#### Scenario: fall-through 1 — system already has compatible WebView2

- **WHEN** 用户机器已装 Evergreen WebView2 且 ≥ Tauri 2 要求的最低版本
- **THEN** 安装器 MUST 直接复用本机 WebView2，不再下载或运行离线安装器
- **AND** 安装时长 MUST 不显著退化（与原 `downloadBootstrapper` 行为等价）

#### Scenario: fall-through 2 — system has no WebView2, install offline

- **WHEN** 用户机器未装 WebView2 或版本低于最低要求
- **THEN** 安装器 MUST 跑内置 Evergreen Standalone Installer 装 WebView2
- **AND** MUST NOT 走 `go.microsoft.com` 在线下载
- **AND** 离线 / 国内受限网络场景 MUST 仍能完成 WebView2 引导（#680 闭环）

#### Scenario: no regression to downloadBootstrapper

- **WHEN** 后续 contributor 修改 `tauri.windows.conf.json` 把 `webviewInstallMode.type` 改回 `downloadBootstrapper` 或删除该节点
- **THEN** 该变更 MUST 在 review 阶段被识别为破坏 `windows-offline-installer` capability
- **AND** spec delta MUST 显式说明回退原因，否则不应合入

#### Scenario: install bundle is self-contained, no online dependency at install time

- **WHEN** 安装器在用户机器上运行
- **THEN** WebView2 引导阶段 MUST NOT 触发任何 HTTP / HTTPS 请求到 `go.microsoft.com` 或 Microsoft CDN
- **AND** 整个 install → launch 流程 MUST 在断网 / 受限网络（防火墙、证书异常）下完成

## Purpose

Defines the windows-offline-installer behavior contract, covering Windows NSIS installer WebView2 offline install strategy (`offlineInstaller` mode, Tauri auto-bundled Evergreen Standalone Installer), platform isolation (no impact on macOS / Linux), fall-through semantics, and prohibition on regression to `downloadBootstrapper`.
