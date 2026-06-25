# integrate-wechat-bridge-product-control Proposal

## Why

微信桥接已经有 Rust bridge、daemon 鉴权补强和真实 daemon smoke，但当前体验仍停留在测试形态：需要手动开终端、attach tmux、看 WeClaw QR 输出、再人工判断 bridge 是否 ready。律师用户不应理解这些进程和端口。

本变更把微信连接做进 LawyerCopilot 设置页，让用户在 app 内完成启动、扫码、运行状态查看、停止和错误恢复。

## 目标与边界

- Goal：在 `运行环境` 下新增 `微信连接` tab，提供“启动微信连接 / 停止 / 刷新状态”。
- Goal：app 自动协调 daemon、`wx_bridge` 和 managed WeClaw，不要求用户打开终端、tmux 或预装 WeClaw。
- Goal：UI 展示二维码、连接状态、组件状态、最近错误和最小操作提示。
- Goal：默认启用 bridge redaction，错误和日志不展示 token、key、JWT 或完整消息正文。
- Goal：发布包内置 WeClaw；异常缺失时给出可恢复的安装/定位状态，不静默失败。
- Goal：单账号测试路径闭环：用户扫码后，微信消息经 WeClaw → bridge → daemon → active workspace AI 回复。
- Boundary：本 change 不承诺多微信号/多律师精确身份映射；WeClaw 当前 HTTP agent 缺少 sender/message id 元数据时，bridge 只能按单账号默认身份处理。
- Boundary：本 change 不改 WeClaw 上游源码；若要精确映射，需要后续 fork/patch WeClaw agent payload。
- Boundary：项目内托管 patched WeClaw 已把图片/文件/引用消息纳入 HTTP rich payload；真微信图片与引用仍需要用户本人微信号做灰度验收。
- Boundary：本 change 不把微信连接放到聊天首页；先收口在运行环境，降低主工作区干扰。

## What Changes

- 新增 Rust domain module 管理微信连接生命周期：status/start/stop、binary discovery、WeClaw config 写入、子进程 pid 管理、QR 输出解析、health check。
- 注册 Tauri commands，并在 `src/services/tauri.ts` 暴露 typed service API。
- 新增 `WeChatBridgeSettings` React section，接入设置页 `运行环境 -> 微信连接` tab。
- 新增 sidecar 准备脚本，把 `cc_gui_daemon`、`wx_bridge` 和校验过 checksum 的 WeClaw 打入 Tauri 包。
- 新增 i18n 文案、组件状态样式和 focused tests。
- 保留既有 `wx_bridge` 二进制能力与 daemon token hardening，不回退安全语义。

## Capabilities

### New Capabilities

- `wechat-bridge-product-control`：LawyerCopilot 内置微信连接控制面板，用户可在 app 内启动、扫码、查看状态并停止微信桥接。

### Modified Capabilities

- `settings-navigation-consolidation`：`运行环境` tab 集合增加 `微信连接`。
