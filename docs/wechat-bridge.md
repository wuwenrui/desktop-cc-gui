# 微信 ClawBot 接入桌面端 — wx_bridge 实现说明

配套总计划：`icu/docs/2026-06-22-wechat-clawbot-desktop-integration-final.md`（go-with-fixes 裁决与风险登记）。

## 1. 是什么

`wx_bridge` 是一个自包含二进制（`src-tauri/src/bin/wx_bridge.rs` + `wx_bridge/`），让律师用**自己的微信**远程驱动**自己本机**的桌面端（cc_gui_daemon）。每位律师一台机器、一个微信号、一个 daemon，全部 loopback，互不串号，无中心服务器存数据。

```
微信 <-> WeClaw(微信协议/媒体/语音STT) <--HTTP(OpenAI)--> wx_bridge <--JSON-RPC :4732--> cc_gui_daemon <-> 桌面 GUI
```

`wx_bridge` 不复用 lib 的 `remote_backend`（它是 `pub(crate)` 且耦合 Tauri `AppHandle`），自带 `daemon_link` 直接讲 daemon 的行分隔 JSON-RPC 协议。

## 2. 模块

| 文件 | 职责 |
|------|------|
| `daemon_link.rs` | TCP 连 `:4732`，auth、行 JSON 收发、id 配对、断线唤醒挂起请求；`send_claude_sync` 走 `engine_send_message_sync`，`compact_claude_thread` 走 daemon `thread_compact` |
| `policy.rs` | **默认拒**白名单（覆盖 daemon 全部 ~162 方法）；高危 daemon 方法显式拒；路径逃逸检测 |
| `remote_control.rs` | 微信远程控制策略：三层权限、直接执行、`帮助`/`新开会话`/`会话压缩` 命令解析 |
| `dedup.rs` | SQLite 持久化去重（TTL，重启不忘），防重复回复/重复计费 |
| `rate_limit.rs` | 按 wxid 独立限流，默认最小回复间隔 1.5s、每分钟最多 20 条，防微信自动回复刷屏 |
| `redactor.rs` | **默认降敏开**：长回复截断 + 电脑端提示；密钥恒剥离；`--allow-full-reply` 显式 opt-out |
| `session_map.rs` | wxid → workspace/last-session 映射，按 wxid 严格隔离，支持续聊 |
| `audit.rs` | 追加审计（时间/wxid/method/workspace/决策 + body 指纹），不写正文/密钥 |
| `pipeline.rs` | 编排：去重→命令绕过限流→三层权限→按 wxid 串行入队→解析/预分配会话→**每条新建 daemon 连接**→Claude sync（15 分钟受控 deadline）→记会话→降敏→审计 |
| `server.rs` | axum OpenAI 兼容 `/v1/chat/completions`（WeClaw 入站）+ `/healthz`；支持 patched WeClaw 读取 assistant text/image content parts |

## 3. 已验证（自动化测试，80 用例全绿）

```
cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml
# 80 passed
```

覆盖：协议 framing/auth/错误对象、**mock daemon 真 socket 端到端**（对话/去重/限流/鉴权失败友好降级/daemon宕机不 panic/daemon 静默时受控超时并落 error 审计/微信 prompt 隐藏桌面内部模式/微信回复清洗/首轮稳定 sessionId/同 wxid 串行续聊/双律师隔离）、**三层权限直接执行**（只读 `read-only`、普通操作 `default`、高风险 `full-access`）、**会话命令**（新开会话、会话压缩、帮助、取消）、**HTTP 真 axum 端到端**（WeClaw→桥→daemon）、入站图片、出站图片/文件 payload、默认拒策略/路径逃逸、持久去重三发一过、默认降敏与密钥剥离、审计不泄密、会话隔离。

真实 daemon + 真实桌面数据目录冒烟：`wx_bridge` 经 `cc_gui_daemon` 在 `icu` 工作区拿到 Claude 回复 `OK`。

> 用真实 socket 的 mock daemon + 真实 axum HTTP 验证了「桥的大脑」全链路，无需真机微信/真 Claude，CI 可重复跑。

## 4. 必须人工验证（agent 环境测不了）

- 微信扫码绑定、个人号真机收发、语音转文字真实管线、封号行为 → **需你本人微信号**。
- 图片/文件/引用消息在项目内 patched WeClaw sidecar、`wx_bridge` OpenAI multimodal 入站和出站附件协议侧已支持；真微信图片/引用在每次重启后仍需本人微信号发消息做灰度验收。
- 真实 Claude 回复质量、长任务时延、24h 时效 → 已完成一轮短回复冒烟；长任务仍需灰度观察。

## 5. 怎么跑（app 内真机测试用）

1. 启动 LawyerCopilot。
2. 打开 App 菜单「启动微信连接…」；app 会打开微信连接面板、启动 daemon、`wx_bridge`，并写入 WeClaw HTTP agent 配置。
3. 点击「连接自检」；组件、本地后台、消息通路、微信登录、扫码状态会在面板内显示「正常」或「需处理」。
4. 面板显示「等待扫码」后，用微信测试号扫码；等待扫码期间面板会自动刷新到「运行中」。
5. 点「发送验证到微信」；app 会向当前扫码绑定的微信聊天发送验证消息。请在那条聊天里回复验证码，再发送一张图片，并引用验证消息追问一句，用于完成文字、图片、引用三项验收。
6. 微信给测试号发「你好」或语音→应收到当前工作区 AI 回复；面板「最近微信消息」会显示是否到达和回复；面板「最近媒体」会显示图片/文件是否到达、保存失败或被旧通道跳过。
7. 如果面板显示「微信组件在线」但「最近微信消息」一直为空，先点「发送验证到微信」确认当前绑定聊天；仍收不到再点「重新绑定微信」清理本机 WeClaw 登录态并重新扫码，避免扫错 bot 或旧账号继续轮询。
8. 面板「使用边界」会提示文字、语音、图片、文件和引用消息会转发给电脑端 agent；建议先用测试号，微信账号风控不由本应用控制。

微信内可用命令：

```text
帮助        查看命令与权限规则
新开会话    清除当前微信用户的 Claude session binding，下一条消息从新对话开始
会话压缩    对当前 Claude session 执行 daemon thread_compact
取消        查看当前是否有正在执行的微信任务
```

权限规则：

- 只读查询、当前目录、列文件、读文件、搜索、解释、图片分析：自动执行，`accessMode=read-only`。
- 修改/创建/移动文件、运行普通命令、打开应用、截图、发送本地文件：直接以 `accessMode=default` 执行。
- 删除/覆盖/安装依赖/git push 或 sync/上传/工作区外路径/全权电脑控制：直接以 `accessMode=full-access` 执行。

发布包已内置 `cc_gui_daemon`、`wx_bridge` 和项目维护的 patched WeClaw；patched WeClaw 源码在 `sidecars/weclaw`，由 `scripts/prepare-tauri-sidecars.mjs` 本地 `go build` 产出。若异常缺失，面板会显示「需要安装微信连接组件」，提供「安装微信连接组件」入口和刷新检测，不会启动半套隐藏进程。

发布包验证：

```bash
npm run tauri -- build --bundles app --no-sign
ls -lh src-tauri/target/release/bundle/macos/LawyerCopilot.app/Contents/MacOS/wx_bridge
ls -lh src-tauri/target/release/bundle/macos/LawyerCopilot.app/Contents/MacOS/weclaw
```

进程级 smoke：

```bash
node scripts/smoke-wechat-bridge.mjs
```

期望输出包含 `bridge-health: ok`、一条桥接回复、`weclaw-scan: ready`；脚本使用临时 HOME，不改用户真实 WeClaw 配置。

真实 Claude smoke（会调用本机真实 Claude 工作区配置，只在手动验收时跑）：

```bash
node scripts/smoke-wechat-bridge-real-claude.mjs --workspace-id cad1df73-fc81-4fb7-8e58-df10fb913a3a
```

期望输出包含 `real-claude-workspace: icu` 和 `real-claude-content: OK`；脚本只使用临时桥数据目录，退出后清理临时 daemon/bridge 进程。

app 内启动后的状态检查：

```bash
node scripts/check-wechat-bridge-app-state.mjs
```

在 app 内点击「启动微信连接」后，期望输出 `app-bridge-health: ok`、`app-wx_bridge-pid: running`、`app-weclaw-pid: running`；若 WeClaw 正在等待扫码，会显示 `app-scan: ready`；若本机已有绑定微信账号，会显示 `app-scan: bound` 和 `app-bound-wechat: present`。脚本只输出状态，不打印二维码、登录 URL 或微信账号标识。

真微信验收检查：

```bash
node scripts/check-wechat-bridge-app-state.mjs --require-real-activity
```

扫码并用微信小号发测试消息后，面板「真微信验收」应显示已验收；命令期望输出 `app-real-wechat-reply: replied`。如果输出 `waiting`，说明还没有真实微信消息进入；如果输出 `seen-without-reply`，说明消息到达但桌面端回复失败，需要看面板「最近微信消息」和「连接自检」。发送真微信图片后，命令还会输出 `app-real-wechat-media: saved|failed|skipped|waiting`，面板「最近媒体」同步显示图片是否已到达并保存。引用消息到达后，面板「最近引用」同步显示引用上下文是否已进入电脑端。

真实图片/引用消息严格检查：

```bash
node scripts/check-wechat-bridge-app-state.mjs --require-real-media --require-real-quote
```

该命令会同时要求 `app-real-wechat-reply: replied`、`app-real-wechat-media: saved` 和 `app-real-wechat-quote: parsed`；如果图片仍是 `waiting|failed|skipped` 或引用仍是 `waiting`，命令以非 0 退出，用于最终验收门禁。

WeClaw 传输核对：

- 官方 WeClaw v0.7.1 的 HTTP agent 原本只支持 string content，图片只保存不转发给 HTTP agent；本项目已 vendored 到 `sidecars/weclaw` 并 patch。
- patched `agent.HTTPAgent` 支持 OpenAI content parts request/response；assistant 返回的 `image_url` 会转换为 markdown URL 或本地附件路径，继续走 WeChat 发送媒体。
- patched `messaging.Handler` 会把微信图片/文件/视频保存到 `save_dir`，把图片作为 `image_url` part，把文件/视频作为本地附件上下文，把引用消息写入 `<wechat-quoted-message>`；引用字段同时兼容 `refer_msg` 和常见 camelCase 形状，如 `referMsg`、`fromUserId`、`textItem`、`itemList`、`imageItem`、`fileItem`。
- app 托管配置会写入 `save_dir=<app-data>/wechat-bridge/data/media`；patched WeClaw 会按微信会话动态写入 `x-weclaw-user` 和 OpenAI `user`；桥缺省仍回退 `local-wechat`；没有 `x-weclaw-msg-id` 时，桥用完整请求体指纹去重。
- app 状态会解析 WeClaw 媒体和引用日志，只展示「最近媒体/引用」状态，不展示图片内容、引用正文或完整本地路径。

## 6. G0 daemon 侧加固（已实现）

桥侧 G0 已做：**无 `--token` 直接拒启**（已测，exit 2）。daemon 侧已做：

- `src-tauri/src/web_service/daemon_bootstrap.rs`：本机 daemon 自启前，当 `remote_backend_token` 为空或全空白时，生成 `rb-<uuid-v4>` token 并持久化到 settings。
- `src-tauri/src/web_service/daemon_bootstrap.rs`：本机 daemon 自启只传 `--token`，不再由 GUI 自启路径传 `--insecure-no-auth`。
- `src-tauri/src/types.rs`：`remote_backend_token` 仍保持 optional 配置字段；首次生成放在 daemon 自启路径，避免 `AppSettings::default()` 产生未持久化随机值。
- 绑定页向律师**书面告知**「消息经微信/腾讯服务器传输」的保密风险（R-Privacy）。

## 7. 守护与运维

`scripts/wx_bridge.plist`（launchd LaunchAgent 模板）：KeepAlive 守护桥进程；daemon 自身由桌面端 `daemon_bootstrap` 负责。把 `__TOKEN__` / `__WORKSPACE__` 替换后放 `~/Library/LaunchAgents/` 再 `launchctl load`。

## 8. 边界与已知取舍

- 微信通道不再做二次确认；每条消息按风险分层直接执行。读目录/列文件/读文件走 `read-only`，写文件/运行命令/发本地文件/截图走 `default`，删除/安装/推送/工作区外路径等高风险走 `full-access`。
- `wx_bridge` 对 daemon 同步回复设置 15 分钟 deadline；WeClaw HTTP agent 设置 16 分钟超时，配合进度提示支撑较久的联网检索、文件生成任务。daemon 长时间静默时微信收到友好提示，面板审计显示 `decision=error`，不会再把本地 HTTP raw error 发给用户。
- `wx_bridge` 在 daemon 同步回复超时后会追加调用 `engine_interrupt`，清掉该工作区里挂住的 Claude 子进程，避免后续微信消息继续被同一轮卡住。
- `wx_bridge` 首轮会预分配稳定 Claude sessionId；同一个 wxid 的后续消息串行进入 daemon 并复用该 session，避免一条微信消息开一个新对话。
- `wx_bridge` 对 Claude 回复做微信出口清洗：优先提取 `<wechat-reply>` 正文，兜底移除“用户只是/计划流程/探索代码”等内部分析前缀。
- 微信入站会追加律师端回复约束，避免把 plan mode、开发者模式、工具权限或后台实现暴露给微信用户；用户明确询问当前目录、文件列表或文件路径时，可以直接给出必要路径信息。
- WeClaw 会在 agent 调用超过 2 秒仍未返回时，先向微信发送场景化处理中提示；快速回复不额外发送处理中提示，避免刷屏。
- 结构化文书（合同/起诉状）默认走「摘要 + 电脑端查看」，不在微信强发。
- 封号风险不可控：建议小号 + 出站限频；当前默认每个 wxid 最小回复间隔 1.5s、每分钟最多 20 条，后续按真机灰度再收紧。
