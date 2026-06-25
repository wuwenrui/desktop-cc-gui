# wechat-bridge-product-control delta

## ADDED Requirements

### Requirement: Runtime Environment exposes WeChat Connection tab

The settings Runtime Environment section SHALL include a `微信连接` tab alongside existing runtime tabs.

#### Scenario: user can open the WeChat connection panel

- WHEN the user opens Settings and selects `运行环境`
- THEN the tab row SHALL include `微信连接`
- AND activating it SHALL render the WeChat connection panel without leaving Settings.

### Requirement: WeChat connection lifecycle is controlled in-app

The panel SHALL provide start, stop, and refresh controls backed by Tauri commands that coordinate daemon, bridge, and WeClaw processes.

#### Scenario: start moves stopped connection into an actionable state

- GIVEN required components are available
- WHEN the user clicks `启动微信连接`
- THEN the app SHALL start or reuse the local daemon with token authentication
- AND it SHALL start the bridge and WeClaw processes
- AND the panel SHALL transition to `waiting_scan` with QR information or `running` when already connected.

#### Scenario: stop is idempotent

- WHEN the user clicks `停止微信连接`
- THEN the app SHALL stop managed bridge and WeClaw processes when running
- AND repeated stop actions SHALL keep the panel in `stopped` without surfacing a fatal error.

#### Scenario: refresh reflects actual health

- WHEN the user clicks refresh
- THEN the panel SHALL re-check process status and bridge health
- AND it SHALL not rely solely on stale pid files.

### Requirement: QR and scan state are visible in the app

The panel SHALL show scan-ready QR information when WeClaw emits login output.

#### Scenario: QR output is parsed

- WHEN WeClaw emits a login URL, data URL, or QR text
- THEN the panel SHALL display a scannable or copyable QR/login area
- AND the user SHALL NOT need to inspect a terminal window.
- AND the panel SHALL show a copyable WeChat test message for the final manual verification step.

#### Scenario: QR output is unavailable

- WHEN WeClaw starts but QR output cannot be parsed
- THEN the panel SHALL show a recoverable diagnostic message
- AND it SHALL keep refresh/stop controls available.

#### Scenario: manual verification boundaries are visible

- WHEN the user opens the WeChat connection panel
- THEN the panel SHALL explain that text, voice, images, files, and quoted messages are forwarded to the desktop agent
- AND it SHALL state that real WeChat image and quote handling still require manual account verification
- AND it SHALL recommend using a test account because WeChat account policy risk is external to the app.

### Requirement: WeClaw is managed by the product package

The release package SHALL include a managed WeClaw sidecar for supported platforms and verify the pinned upstream checksum before bundling it.

#### Scenario: release package provides WeClaw

- WHEN the app package is built for a supported platform
- THEN `weclaw` SHALL be bundled alongside `cc_gui_daemon` and `wx_bridge`
- AND the lifecycle command SHALL discover the bundled `weclaw` before falling back to user-installed copies.

### Requirement: Missing components are recoverable

The panel SHALL detect missing WeClaw or bridge components and explain the next action without starting partial hidden processes.

#### Scenario: WeClaw is missing

- GIVEN WeClaw cannot be discovered
- WHEN the user opens the panel or clicks start
- THEN the panel SHALL show `需要安装微信连接组件`
- AND it SHALL provide an install-guide action and refresh path
- AND start SHALL not spawn a partial bridge-only session.

### Requirement: Connection diagnostics run inside the product

The panel SHALL provide an in-app diagnostic action that checks components, local daemon, bridge route, WeClaw process, and scan state without requiring terminal commands.

#### Scenario: user runs diagnostics after starting

- WHEN the user clicks `连接自检`
- THEN the app SHALL call a Tauri command that checks the managed connection state
- AND the panel SHALL show per-check pass/action-needed results
- AND bridge route diagnostics SHALL include a chat probe when the message bridge is running.

#### Scenario: real WeChat activity is visible after a message reaches the bridge

- WHEN a WeChat message reaches `wx_bridge`
- THEN the panel SHALL show the latest body-free activity status
- AND it SHALL NOT display the raw message body, daemon token, API key, or JWT.

#### Scenario: local smoke probes do not replace real activity evidence

- WHEN local smoke probes write audit entries using `local-*-smoke` identities
- THEN the panel SHALL ignore those entries for the latest WeChat activity card
- AND the card SHALL continue to show the latest non-smoke activity or the empty state.

#### Scenario: smoke-only activity is distinguished from real WeChat activity

- WHEN only local smoke probes have reached the bridge
- THEN the panel SHALL show that the local self-check passed
- AND it SHALL still state that the app is waiting for a real WeChat message.

#### Scenario: real WeChat verification has an in-panel verdict

- WHEN the user opens the WeChat connection panel
- THEN the panel SHALL show a real WeChat verification verdict
- AND local smoke activity SHALL NOT make that verdict pass
- AND a real `allow` audit entry SHALL show that verification passed
- AND a real non-`allow` audit entry SHALL direct the user to diagnostics.

#### Scenario: real WeChat media activity is visible without leaking local paths

- WHEN WeClaw receives, saves, fails, or skips a non-text WeChat media message
- THEN the panel SHALL show the latest media status as saved, failed, skipped, or empty
- AND it SHALL NOT display the raw media content, full local media path, daemon token, API key, or JWT.

### Requirement: Sensitive data stays redacted

The WeChat connection UI and command errors SHALL NOT display daemon tokens, API keys, JWTs, or full user message bodies.

#### Scenario: command error includes secret-like text

- WHEN backend process output or errors include secret-like values
- THEN the returned UI status SHALL redact them before display.

### Requirement: Single-account bridge replies through active workspace

For the initial product scope, incoming WeChat text SHALL be routed through the existing bridge to the active workspace AI reply path.

#### Scenario: scanned account sends a test message

- GIVEN the connection is running and the user has scanned a test WeChat account
- WHEN the account receives a text message
- THEN WeClaw SHALL call the bridge chat endpoint
- AND the bridge SHALL request a reply from LawyerCopilot daemon
- AND WeClaw SHALL send the reply back through WeChat.

#### Scenario: reply bursts are rate limited per account

- WHEN the same WeChat account sends messages faster than the configured reply limit
- THEN the bridge SHALL return a short user-facing rate-limit notice
- AND it SHALL NOT call the desktop daemon for the throttled message.

## Purpose

Defines the product-grade WeChat bridge control surface inside LawyerCopilot: in-app lifecycle controls, scan state, managed WeClaw packaging, recoverable missing-component behavior, redacted errors, and the single-account reply path.
