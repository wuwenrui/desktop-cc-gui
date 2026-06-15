# Design: Windows Offline Installer 2026-06

OpenSpec change: `windows-offline-installer-2026-06`

## Context

`desktop-cc-gui` issue #680 报"Windows 安装包无法离线安装，安装时提示 failed to install Webview2"。根因是 Tauri 2 的 NSIS / WiX 安装器默认走 WebView2 Evergreen Bootstrapper 在线下载链：bootstrapper 是个小 exe，安装时再拉 `MicrosoftEdgeWebview2Setup.exe` 完整安装包。任何一步失败（包括离线、`go.microsoft.com` 被防火墙拦、证书链异常、TLS 抖动），bootstrapper 就报错退出，整个 app 安装流程中断。

当前 `mossx`（product = `ccgui`）的 Windows 构建路径 `package.json:73` `tauri:build:win` 与 `.github/workflows/release.yml:296` 都直接 `tauri build --bundles nsis`，没覆盖 Tauri 的 `webviewInstallMode`，所以与 #680 完全相同的风险面存在。

### Tauri 2 `webviewInstallMode` 行为依据

`tauri-bundler` 2.5.x 在 `crates/tauri-bundler/src/bundle/windows/util.rs` 显式导出：

```rust
pub const WEBVIEW2_OFFLINE_INSTALLER_X64_URL: &str =
  "https://go.microsoft.com/fwlink/?linkid=2124701";
pub const WEBVIEW2_OFFLINE_INSTALLER_X86_URL: &str =
  "https://go.microsoft.com/fwlink/?linkid=2099617";

pub fn download_webview2_offline_installer(base_path: &Path, arch: &str) -> crate::Result<PathBuf> {
  let url = if arch == "x64" {
    WEBVIEW2_OFFLINE_INSTALLER_X64_URL
  } else {
    WEBVIEW2_OFFLINE_INSTALLER_X86_URL
  };
  // ... head request -> 拿到 guid/filename -> 拉二进制 -> 嵌入 bundle ...
}
```

`tauri-bundler` 2.5.3 对应 Tauri CLI 2.9.x（`package.json` 中 `@tauri-apps/cli` = `2.9.6`，匹配）。

`https://schema.tauri.app/config/2` 的 `definitions.WebviewInstallMode` schema 枚举 5 个 `type`：`skip` / `downloadBootstrapper` / `embedBootstrapper` / `offlineInstaller` / `fixedRuntime`。其中：

- `offlineInstaller` 只需 `{ type: "offlineInstaller", silent?: bool }`，**无 `path` 字段**——Tauri 自己处理 Evergreen Standalone Installer 的下载 + 嵌入。
- `fixedRuntime` 需要 `{ type: "fixedRuntime", path: "..." }`——这是把 WebView2 Fixed Runtime 完整目录嵌入 app。

Tauri 官方文档 `https://v2.tauri.app/distribute/windows-installer/#webview2-installation-options` 对 `offlineInstaller` 的描述：

> "set the `webviewInstallMode` to `offlineInstaller`. This increases the installer size by around 127MB, but allows your application to be installed even if an internet connection is not available."

> "To embed the WebView2 Bootstrapper, set the `webviewInstallMode` to `offlineInstaller`."（官方文档前后段存在表述不一致，但 schema 与 `tauri-bundler` 源码是 ground truth：offlineInstaller 嵌入的是 Standalone Installer 不是 Bootstrapper。）

## Implementation Principles

- **配置层切换，不动运行时加载逻辑**：`webviewInstallMode` 是 Tauri 公开 API，fall-through 行为由 Tauri 自己保证，我们不重新发明 webview 加载链。
- **平台隔离干净**：所有改动都在 `bundle.windows` 节点内，macOS / Linux 不读这个字段，不会有副作用。
- **零 CI 改动**：Tauri build 时自动从 Microsoft 官方 URL 拉取 Evergreen Standalone Installer；不需要 release.yml 改 step。
- **零仓库卫生负担**：Tauri build 产物落到 `target/release/bundle/nsis/`，该路径已在 `.gitignore`，不需要 `vendor/webview2/` 占位、不需要改 `.gitignore`。
- **零产品代码改动**：仅一行 config。

## File-Level Plan

### `src-tauri/tauri.windows.conf.json`

新增 `bundle.windows.webviewInstallMode` 节点：

```json
{
  "app": {
    "windows": []
  },
  "bundle": {
    "createUpdaterArtifacts": true,
    "windows": {
      "webviewInstallMode": {
        "type": "offlineInstaller"
      }
    }
  }
}
```

**字段位置修正记录**：原 proposal / design 初稿错误地把 `webviewInstallMode` 写在 `bundle.windows.nsis.webviewInstallMode`。经 `https://schema.tauri.app/config/2` 的 `definitions.WindowsConfig` schema 校对，字段是 `WindowsConfig` 的属性（`definitions.WindowsConfig.properties.webviewInstallMode`），不是 `NsisConfig` 的属性（`definitions.NsisConfig` 完全不包含该字段）。最终路径是 `bundle.windows.webviewInstallMode`。

放在 `tauri.windows.conf.json` 而不是 `tauri.conf.json`：主 config 是平台无关的，windows-only 配置单独走 windows-specific config 跟 `tauri:build:win` 脚本语义一致（`package.json:73` 已经用 `--config src-tauri/tauri.windows.conf.json` 覆盖）。macOS / Linux 路径完全看不到这个字段。

## Capability Matrix

| Capability | Before | After |
|---|---|---|
| `bundle.windows.webviewInstallMode` | 不存在，Tauri 走默认 `downloadBootstrapper` | `{ type: "offlineInstaller" }`（无 path 字段） |
| 联网 + Win 11/10 已装 WebView2 | 直接复用 | 直接复用（fall-through 1，行为不变） |
| 联网 + 全新机器 | 走 go.microsoft.com 拉 bootstrapper | 跑内置离线安装器（fall-through 2，更稳更快） |
| 离线 + 全新机器（#680 场景） | 失败：failed to install Webview2 | 跑内置离线安装器（fall-through 2，#680 解决） |
| 安装器体积 | baseline | baseline + ~127MB（Evergreen Standalone Installer） |
| CI build 时长（首次） | baseline | baseline + ~30s-1min（Tauri 从 go.microsoft.com 拉 ~127MB） |
| CI build 时长（命中 Tauri 内部 cache） | n/a | 几乎为 0 |
| 仓库 vendor 目录 | 无 | 无（Tauri 自己处理） |
| macOS DMG / Linux AppImage | 不受影响 | 不受影响（配置不读） |
| release.yml | 不变 | 不变（零 CI 改动） |
| `.gitignore` | 不变 | 不变（零仓库卫生改动） |

## Risk & Rollback

- **风险 1：`go.microsoft.com` 不可达**。Tauri build 首次会从 `https://go.microsoft.com/fwlink/?linkid=2124701` 拉 ~127MB 二进制。若 Microsoft 端 fwlink 抽风，build 失败。低概率，与原 bootstrapper 行为风险等价。微软 fwlink 是 2019 年至今的永久 URL，变动概率极低。
- **风险 2：安装器体积膨胀 ~127MB**。release artifact 体积明显变大，但符合 issue #680 的真实需求。
- **回滚路径**：删除 `tauri.windows.conf.json` 里 `bundle.windows.webviewInstallMode` 节点（3 行）。整体可逆，零业务逻辑牵连。

## Verification Strategy

- **沙盒内**：
  - `rg "offlineInstaller" src-tauri/tauri.windows.conf.json` 命中（配置层）
  - `python3 -c "import json; json.load(open('src-tauri/tauri.windows.conf.json'))"` 退出 0（JSON 合法）
  - `openspec validate windows-offline-installer-2026-06 --strict --no-interactive` 退出 0（治理层）
- **Windows runner**（release CI 实际产物）：
  - `tauri build --bundles nsis` 成功，最终 `src-tauri/target/release/bundle/nsis/*.exe` 体积相对 baseline +~127MB。
  - 人工 smoke：在断网虚拟机 / 国内受限网络环境跑 `*-setup.exe`，能完成安装并启动 app。
