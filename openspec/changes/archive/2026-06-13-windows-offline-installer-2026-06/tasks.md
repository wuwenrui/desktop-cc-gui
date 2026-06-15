# Tasks: Windows Offline Installer 2026-06

## 1. Preflight & Spec Scaffolding

- [x] 1.1 [P0][depends:none][input: `desktop-cc-gui` issue #680 描述][output: 风险面记录][validation: 复现描述里出现 `failed to install Webview2` + 离线 / 受限网络场景] Capture issue #680 repro.
- [x] 1.2 [P0][depends:none][input: `src-tauri/tauri.windows.conf.json` 当前内容][output: baseline 记录][validation: baseline 里 `bundle.windows.webviewInstallMode` 不存在，确认 Tauri 默认 `downloadBootstrapper` 路径生效] Confirm current windows config has no webviewInstallMode.
- [x] 1.3 [P0][depends:none][input: `package.json:73` + `.github/workflows/release.yml:296`][output: build 调用链记录][validation: 两条路径都直接 `tauri build --bundles nsis`，没覆盖 webviewInstallMode] Confirm build pipeline.
- [x] 1.4 [P0][depends:none][input: Tauri 2 schema + `tauri-bundler` 源码][output: 字段位置校准][validation: schema `definitions.WindowsConfig.properties.webviewInstallMode` 存在；`definitions.NsisConfig` 不含该字段；`util.rs` 导出 `download_webview2_offline_installer`] Verify field location against Tauri 2 schema.

## 2. NSIS Config Patch

- [x] 2.1 [P0][depends:1.2,1.4][input: 当前 `src-tauri/tauri.windows.conf.json`][output: 增加 `bundle.windows.webviewInstallMode: { type: "offlineInstaller" }`][validation: `rg '"offlineInstaller"' src-tauri/tauri.windows.conf.json` 命中；JSON 仍合法（`python3 -c "import json; json.load(open('src-tauri/tauri.windows.conf.json'))"` 退出 0）] Add webviewInstallMode to windows config.
- [x] 2.2 [P1][depends:2.1][input: 主 `src-tauri/tauri.conf.json`][output: 确认 `bundle.windows` 字段未出现在主 config 中][validation: `rg '"webviewInstallMode"' src-tauri/tauri.conf.json` 命中数 = 0；`rg '"windows"' src-tauri/tauri.conf.json` 命中数 = 0（`app.windows` 是另一回事，单独看），避免 macOS / Linux 平台被 windows 节点误影响] Verify main config has no windows bundle field.

## 3. Spec Deltas

- [x] 3.1 [P0][depends:2.1][input: `openspec/changes/archive/2026-06-13-windows-offline-installer-2026-06/specs/windows-offline-installer/spec.md`][output: 1 条 ADDED Requirement `WebView2 Offline Install Strategy`，钉死 `bundle.windows.webviewInstallMode.type = "offlineInstaller"` 与禁止回退到 `downloadBootstrapper`][validation: `rg "WebView2 Offline Install Strategy" openspec/changes/archive/2026-06-13-windows-offline-installer-2026-06/specs/windows-offline-installer/spec.md` 命中] Add requirement.
- [x] 3.2 [P1][depends:3.1][input: spec delta 自检][output: spec 文件内 Scenario 覆盖"已装 WebView2 → fall-through 1"、"未装 + 联网 → fall-through 2"、"未装 + 离线 → fall-through 2" 三分支][validation: `rg "fall-through" openspec/changes/archive/2026-06-13-windows-offline-installer-2026-06/specs/windows-offline-installer/spec.md` 命中 >= 3] Cover fall-through scenarios.

## 4. Verification & Closure

- [x] 4.1 [P0][depends:3.1][input: OpenSpec 校验][output: `openspec validate --specs --strict --no-interactive` 退出 0][validation: 命令退出码 0] Run strict validation.
- [x] 4.2 [P0][depends:4.1][input: archive 后 change listing][output: `openspec list --json` 不再出现 `windows-offline-installer-2026-06`; main spec `openspec/specs/windows-offline-installer/spec.md` 存在][validation: active list 不含该 change, main spec 存在] Confirm archive state.
- [x] 4.3 [P0][depends:3.1][input: cross-layer 体检][output: `git diff --stat -- 'src/**' 'src-tauri/src/**'` 是空][validation: 输出为空] Confirm no product code touched.
- [x] 4.4 [P1][depends:4.3][input: 配置层体检][output: 改动文件列表只含 `src-tauri/tauri.windows.conf.json` + archived change artifacts + `openspec/specs/windows-offline-installer/**`][validation: git status 剩余范围与该 change 一致] Confirm touched files bounded.
- [x] 4.5 [P1][depends:4.4][input: TypeScript 校验][output: `npm run typecheck` pass][validation: 退出 0] Run typecheck.
- [x] 4.6 [P1][depends:4.5][input: Lint 校验][output: `npm run lint` pass][validation: 退出 0] Run lint.
- [x] 4.7 [P1][depends:4.6][input: JSON 合法性最终复核][output: `tauri.windows.conf.json` 仍合法][validation: `python3 -c "import json; json.load(open('src-tauri/tauri.windows.conf.json'))"` 退出 0] Verify JSON legality.

## 5. Follow-up Explicitly Out of Scope

- 5.1 [follow-up][owner:windows-distribution] 在 release CI 实际打出的 `*-setup.exe` 上做"断网虚拟机 / 国内受限网络"人工 smoke，验证 issue #680 真正闭环。本 change 在沙盒内只验证配置 + 文档 + 治理层，不实际打 Windows installer 验证。
- 5.2 [follow-up][owner:windows-distribution] 监控 release artifact `windows-x64` 体积变化，若 +127MB 对分发渠道有压力，后续可考虑用 `embedBootstrapper`（+~1.8MB）代替 `offlineInstaller`（+~127MB），但 `embedBootstrapper` 仍需联网拉完整安装包，对国内网络无解，需权衡。
- 5.3 [follow-up][owner:webview2-versioning] 跟进 `tauri-bundler` 后续版本对 `offlineInstaller` URL 的稳定性 / 缓存策略变更。

## 6. Archive

- [x] 6.1 [P0][depends:4.*][input: 所有 task 完成 + spec 同步到主线][output: 走 `openspec archive windows-offline-installer-2026-06 --yes`][validation: `openspec/changes/archive/2026-06-13-windows-offline-installer-2026-06/` 出现 proposal/design/tasks/specs；`openspec list --json` 不再含该 change] Archive change.
