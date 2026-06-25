# integrate-wechat-bridge-product-control Design

## Context

现有 `wx_bridge` 已能提供 OpenAI-compatible `/v1/chat/completions` endpoint，并转发到 cc_gui daemon。现有设置页已有 Web Service/daemon 控制模式，适合承载微信连接的状态面板。

## Decisions

### Decision 1: 入口放在 `运行环境 -> 微信连接`

微信连接依赖本机 daemon、bridge process 和 WeClaw process，语义属于本地运行环境。新增 tab 比新增左侧一级入口更轻，不打断主对话工作流。

### Decision 2: Rust 管生命周期，React 只消费状态

新增 `src-tauri/src/wechat_bridge_control.rs` 作为 domain module。它负责：

- discover packaged `wx_bridge` 和 managed WeClaw binaries；
- ensure daemon 可用；
- write/update WeClaw HTTP agent config；
- spawn/stop/check child processes；
- parse QR output；
- return typed status DTO。

React 只调用 Tauri commands，不直接拼命令、不读本地 config、不处理 pid。

### Decision 3: 状态模型以产品状态为主，不暴露端口细节

UI 使用 `phase` 表达用户能理解的状态：

- `not_ready`：缺组件或配置不可用；
- `stopped`：未启动；
- `starting`：正在启动；
- `waiting_scan`：已拿到 QR，等待扫码；
- `running`：bridge health check 可用；
- `error`：最近一次操作失败。

组件级状态保留在折叠/小字区域，用于诊断，不作为主叙事。

### Decision 4: WeClaw 配置由 app 托管，但不覆盖用户无关配置

启动时读取 `~/.weclaw/config.json`，只更新 LawyerCopilot 所需 agent/server 字段，保留其他字段。写入失败返回可读错误，不用默认空配置吞掉错误。

### Decision 5: QR 从 WeClaw stdout/stderr 解析并缓存在状态文件

WeClaw v0.7.1 以终端输出二维码/登录 URL。控制模块把 child output 写入 app data 下的 bounded log，并解析最近 QR 文本或 URL。UI 展示可复制文本/二维码容器，避免要求用户看 tmux。

### Decision 6: WeClaw 随产品包托管

发布包内置 fastclaw-ai/weclaw v0.7.1 sidecar。`beforeDevCommand` / `beforeBuildCommand` 在构建前下载对应平台 release asset，并用官方 `checksums.txt` 校验。运行时优先使用包内 WeClaw；若异常缺失，UI 显示“需要安装微信连接组件”，提供安装说明和刷新。

### Decision 7: 不放宽 daemon auth

微信连接必须复用已持久化的 daemon token。任何启动失败都返回错误，不通过 `--insecure-no-auth` 绕过。

### Decision 8: 诊断结果留在设置页

面板提供“连接自检”，由 Rust 命令检查组件、daemon、bridge chat probe、WeClaw 和扫码状态。UI 只呈现每项“正常/需处理”和必要路径/错误摘要，不要求用户打开 tmux、复制端口命令或理解子进程日志。

## Risks / Trade-offs

- 项目托管 patched WeClaw 会动态传递微信会话身份；多微信号仍需灰度观察，避免账号或会话串扰。
- 项目托管 patched WeClaw 已支持图片/文件/引用消息进入 HTTP rich payload；真微信图片和引用仍需用户本人微信号完成灰度验收。
- QR 输出格式依赖 WeClaw 版本，解析器必须保守：识别 URL、base64/data-url 或 terminal QR 片段，不识别时仍保留“查看最近输出”错误提示。
- 子进程管理需要处理 app 崩溃后的 stale pid：status 以实际进程/health check 为准，pid 文件仅作 hint。
