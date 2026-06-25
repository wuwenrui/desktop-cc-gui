# 微信连接产品化集成计划

## 目标

把当前 terminal/tmux 测试链路收口到 LawyerCopilot app 内：设置页启动、扫码、状态、停止、错误恢复闭环。

## 实施顺序

1. OpenSpec：`openspec/changes/integrate-wechat-bridge-product-control/` 固定行为、边界和验收。
2. Rust：新增 `wechat_bridge_control` domain module，封装 status/start/stop、WeClaw config、pid/log、QR 解析。
3. Tauri：注册 commands，`src/services/tauri.ts` 暴露 typed API。
4. React：在 `运行环境` 下新增 `微信连接` tab 和设置面板。
5. 打包：Tauri `externalBin` 内置 `cc_gui_daemon`、`wx_bridge` 和 WeClaw；dev/build 前自动生成或下载校验 sidecar。
6. 验证：Rust focused tests、Vitest、typecheck、bundle inspection、本机 app 内 smoke、真微信扫码。

## 验证点

- 不打开终端也能启动微信连接。
- 安装包自带桥接与 WeClaw 二进制，不要求用户本机有 Rust/Cargo 或提前安装 WeClaw。
- WeClaw 异常缺失时 UI 给出可恢复状态，不启动半套进程。
- 启动后 UI 能显示等待扫码或 running。
- 停止可重复点击且状态收敛。
- 错误和日志不泄漏 token/key/JWT/完整消息正文。

## 已知边界

WeClaw HTTP agent 当前缺少 sender/message id 元数据，第一版按单账号测试闭环；多律师/多微信号精确映射需要后续协议增强。
