# 微信 ClawBot 接入桌面端（wx_bridge）交接文档

**用途**：本文件供后续对话/agent 启动时快速建立上下文，并供另一个 AI 检查与续做。
**创建时间**：2026-06-22
**创建自**：research → planning(ultracode workflow) → implementation
**当前阶段**：桥核心、G0 daemon 侧加固、产品内控制面、托管 patched WeClaw sidecar、微信文字/图片/文件/引用 rich payload、三层权限直接执行、出站图片/文件、本机运行态 smoke、真实出站文件 smoke、当前运行周期真微信图片/引用严格复验、全量测试门禁、Tauri app 打包均已完成；待提交收口。
**接手方做什么**：先核查当前 worktree 与 §9.2 最新约束，再提交收口；不要退回历史只读 MVP。

---

## 1. 关联文件清单

| 类型 | 路径 | 说明 |
|------|------|------|
| 桥代码所在 worktree | `/Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot-wechat-bridge` | git worktree，分支 `feat/wechat-bridge`，基于 lawyer-copilot |
| 桥主程序 | `src-tauri/src/bin/wx_bridge.rs` | main + 9 个 `#[path]` 子模块声明 |
| 桥模块 | `src-tauri/src/bin/wx_bridge/{types,daemon_link,policy,dedup,redactor,session_map,audit,pipeline,server}.rs` | 全部含 `#[cfg(test)]` 单测 |
| 实现说明 | `docs/wechat-bridge.md` | 架构/运行指南/测试清单/G0待办/边界 |
| 守护模板 | `scripts/wx_bridge.plist` | launchd LaunchAgent |
| 总计划(终版) | `/Users/wuwenrui/Desktop/code/wwr/icu/docs/2026-06-22-wechat-clawbot-desktop-integration-final.md` | go-with-fixes 裁决 + 风险登记表（icu/docs，非本 worktree） |
| daemon 源(被调方) | `src-tauri/src/bin/cc_gui_daemon.rs` + `cc_gui_daemon/` | 桥连接的 JSON-RPC 服务端 |

**Git 状态**：
- 当前 branch：`feat/wechat-bridge`
- 最新 commit：`8585885d docs(handoff): add wechat-clawbot bridge context handoff for next conversation`（微信桥相关代码/文档仍**未 commit**）
- 未提交内容覆盖：`wx_bridge` Rust bin、托管 WeClaw sidecar、app 控制面、OpenSpec changes、smoke/check scripts、微信连接文档等；以 `git status --short` 为准。
- 注意：worktree 根有一个 `dist/`（从主仓拷贝的前端构建产物，仅为满足 tauri-build；已被 gitignore，不要提交）

---

## 2. 原始需求（用户原话）

### 2.1 第一次需求陈述（调研）

> "帮我充分调研微信的 clawbot 如何和我们的桌面端软件打通，目的是不同的律师在使用的时候可以使用自己微信上的 clawbot 来控制我们的桌面端软件来进行交互和完成工作，帮我调研如何能够做到，，还有调研一下这个项目：https://github.com/iOfficeAI/AionUi，充分比对这个项目和我们桌面端软件的优缺点，充分对比"

### 2.2 体验与能力追问

> "AionUi 打通微信是用的什么，用户在微信 通过什么进行交互？我们的clawbot 接通的话，体验怎么样？能发图片吗？"

### 2.3 转向落地

> "我们应该怎么接入？"

### 2.4 进入实现（ultracode，明确预期）

> "ultracode 先出计划，然后检查计划，分析可行性和效果，我的预期效果要达到完美形态，对话流畅，服务稳定，计划没问题后，开始全面实现，实现后，充分测试，必须要充分测试，完全没问题后再跟我汇报"

### 2.5 实现范围确认

> "就是把功能都实现完毕，等我绑定我微信号来进行实际的测试"

---

## 3. 关键决策与理由

### 3.1 微信侧用什么

| 选项 | 选择 | 理由 |
|------|------|------|
| 官方腾讯 ClawBot 插件 | ❌ | 协议黑盒、只认 OpenClaw |
| Fork/运行 WeClaw（Go,MIT） | ✅ | 已 vendored 到 `sidecars/weclaw` 并 patch：文字/语音、图片、文件、引用消息进入 HTTP rich payload；assistant `image_url/file_url` 可回传微信 |
| nightsailer/wechat-clawbot（Python，多用户网关） | 备选 | 自带多用户网关，可作参考 |

**最终决定**：运行项目托管 patched WeClaw 处理微信协议、媒体、引用和 STT，桥用 OpenAI 兼容 HTTP rich payload 与之对接。

### 3.2 桥怎么连 daemon

| 选项 | 选择 | 理由 |
|------|------|------|
| 复用 lib 的 `remote_backend` | ❌ | 它是 `pub(crate)` 且耦合 Tauri `AppHandle`，独立 bin 用不了 |
| 桥自带 `daemon_link` 直连 JSON-RPC :4732 | ✅ | 与 cc_gui_daemon 同 crate 同模式（`#[path]`），协议已逐条取证 |
| 给 daemon 加 OpenAI 兼容 HTTP 端点 | ❌ | 改动 daemon，非必要 |

**最终决定**：桥自实现 daemon_link（行分隔 JSON-RPC 客户端）；桥对 WeClaw 暴露 OpenAI 兼容入站。

### 3.3 MVP 功能范围（历史决策，已被后续需求扩展）

> 2026-06-24 更新：用户后续明确要求“微信端当做入口控制 agent，可以读写、截图、发图、发文件、操作当前工作区”，并再次明确“不要有确认逻辑”，因此本节的 `read-only` MVP 仅作为历史背景保留；当前产品目标以 `expand-wechat-bridge-remote-control` 的三层权限直接执行 spec 为准。

| 选项 | 选择 | 理由 |
|------|------|------|
| 仅 Claude 问答/起草，read-only 不写盘 | 历史 MVP | 已被三层权限模型替换 |
| 含写文件/git | 支持 | 普通写入直接 `default`，高风险/git/安装/删除直接 `full-access` |
| 含 Codex | 暂不作为主路径 | 当前微信桥仍走 `engine_send_message_sync`，Codex sync 能力需另行核查 |

**当前决定**：Claude sync + 三层权限直接执行；读走 `read-only`，普通副作用走 `default`，高风险走 `full-access`。

### 3.4 其他工程决策
- 每条消息**新建独立 daemon 连接**（防 900s sync 阻塞串扰）。
- **默认降敏开**（隐私铁律），`--allow-full-reply` 显式 opt-out。
- worktree 隔离开发，**未 commit**（按用户 git 规范走 develop，待确认）。

---

## 4. 用户偏好与红线

### 4.1 全局规则（~/.claude/CLAUDE.md）
- 引用任何方法/字段/类名必带 `文件:行号`，未查证先查证；调用链逐层标注。
- 写 SQL/代码前禁止从相邻代码推断，必须 Read/Grep 查证。
- 禁止擅自降级业务语义（约束/校验/类型/安全）——命中红线先停下报告。
- 输出短密直、结论先行、表格优先；不写客套与总结套话；不用 emoji。
- 测试门禁：功能/bug/重构需单元+集成双覆盖且通过，覆盖率≥80%，否则不算完成。
- 正式文档写入当前项目 `docs/`。

### 4.2 项目规则（lawyer-copilot CLAUDE.md / AGENTS.md）
- 用户是律师不是开发者：界面只讲能做什么，不暴露文件树/终端/md。
- 禁止玩具功能：先打通真实业务数据。
- 该仓 Trellis + OpenSpec 双轨；行为变更先建 OpenSpec change；commit 用中文主体英文 type；强制 npm；启动前 doctor:strict。
- git：从 develop 切分支、PR 到 develop、不直推 main。

### 4.3 本次对话明确偏好
- 要"完美形态、对话流畅、服务稳定"，"充分测试，必须要充分测试，完全没问题后再汇报"。
- "把功能都实现完毕，等我绑定我微信号来进行实际的测试"。

### 4.4 严格输出规则
- 凡 agent 环境测不了的（微信真机/封号）必须如实标注，禁止粉饰成"已验证"。

---

## 5. 验收标准

### 5.1 业务功能验收
| 功能 | 验收方式 |
|------|---------|
| 微信发文字→桌面端 Claude 回复 | 真机：绑号后微信发消息收到回复（【需真机】） |
| 发图片/文件/引用→agent 处理 | patched WeClaw 保存媒体并转成 OpenAI content parts；引用消息进入 `<wechat-quoted-message>` 上下文 |
| 续聊上下文 | 同一 wxid 连续两问串行复用 session；`新开会话` 可清当前 wxid session |
| 电脑操作 | 只读自动；写文件/普通命令/截图/发本地文件直接 `default`；删除/git/安装/上传/工作区外路径直接 `full-access` |

### 5.2 技术验收
| 项 | 标准 | 当前 |
|----|------|------|
| 单元+集成测试 | 全通过，关键模块≥90% | `cargo test --bin wx_bridge` 80/80；`npm run test` 704 个测试文件；`go test ./...` 通过 |
| 桥可独立构建 | `cargo build --bin wx_bridge` 成功 | ✅ |
| 协议契约一致 | daemon_link 与 cc_gui_daemon 实测协议一致 | ✅ mock+真 daemon 验证 |
| G0 鉴权 | 桥拒连无 token，GUI 自启 daemon 生成并持久化 token | 已完成 |

### 5.3 安全验收（对抗评审硬门禁）
- 默认拒白名单覆盖 daemon 全部 ~162 方法（policy.rs）。
- `full-access` 只能由 bridge 分类出的高风险动作触发；普通动作不能直接提升。
- 出站默认降敏 + 密钥剥离。
- 审计不含正文/密钥。

### 5.4 边界（必须保留的诚实标注）
- 微信扫码/真机端到端/封号 = 【需真机微信手测·不可自动 E2E】。
- 真实 Claude 回复需 daemon 指向已配置工作区+引擎的真实数据目录。

---

## 6. 验证方法

### 6.1 桥测试（已验证 81/81）
```bash
cd /Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot-wechat-bridge/src-tauri
export CARGO_TARGET_DIR=/Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot/src-tauri/target
cargo test --bin wx_bridge        # 期望 81 passed
cargo build --bin wx_bridge --bin cc_gui_daemon
```

### 6.2 本地冒烟（已实测：healthz=ok，chat 走通并优雅兜底）
```bash
D=$CARGO_TARGET_DIR/debug/cc_gui_daemon; B=$CARGO_TARGET_DIR/debug/wx_bridge
"$D" --listen 127.0.0.1:4732 --token smoke --data-dir /tmp/wxb_d &     # daemon 必须带 token
"$B" --token smoke --daemon-host 127.0.0.1:4732 --listen 127.0.0.1:18012 --default-workspace default --data-dir /tmp/wxb_b &
curl -s http://127.0.0.1:18012/healthz
curl -s -X POST http://127.0.0.1:18012/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"claude","user":"wx-1","messages":[{"role":"user","content":"你好"}]}'
```
> 空 data-dir 时 chat 返回友好错误「电脑端暂时没有响应」（管道通、daemon 那步因无工作区/引擎而报错、桥优雅兜底）。要真 Claude 回复需把 `--data-dir` 指向真实桌面数据目录 + 真实 `--default-workspace`。

真实 Claude 短回复 smoke 已固化为：
```bash
node scripts/smoke-wechat-bridge-real-claude.mjs --workspace-id cad1df73-fc81-4fb7-8e58-df10fb913a3a
# 期望：real-claude-workspace: icu；real-claude-content: OK
```

### 6.3 端到端手动验证清单（绑号后）
- [ ] WeClaw 装好，HTTP(OpenAI)agent base_url 指 `http://127.0.0.1:18012/v1`
- [ ] `weclaw login` 扫码绑微信
- [ ] 微信发文字→收到回复
- [x] WeClaw v0.7.1 源码确认：HTTP agent 不自动带 `user`/消息 id；桥已回退 `local-wechat`，并用完整请求体指纹去重
- [x] 发文字→回复；图片→视觉分析；引用图片/文字→可结合引用回答（2026-06-24 真微信复验曾通过）
- [x] 发本地文件到微信：WeClaw API 真实出站文件 smoke 成功
- [x] 当前运行周期重启后图片/引用严格门禁：`node scripts/check-wechat-bridge-app-state.mjs --require-real-activity --require-real-media --require-real-quote` 已通过
- [ ] 语音、断网恢复、24h 稳定性、微信风控仍需灰度观察

---

## 7. 关键技术事实（已验证，带文件:行号）

| 事实 | 来源 |
|------|------|
| daemon 是 cc_gui_daemon bin（dispatch 主文件 2234 行，模块树合计大）；GUI 通过 `cargo build --bin cc_gui_daemon` 构建并自启 | `web_service/daemon_bootstrap.rs:486`、`cc_gui_daemon.rs:441-442` |
| 启动参数 `--listen/--token/--insecure-no-auth/--data-dir` | `daemon_bootstrap.rs:43-58`、`cc_gui_daemon.rs:455-493` |
| 协议=行分隔 JSON；请求 `{id,method,params}`；成功 `{id,result}`；错误 `{id,error:{message}}`（error 恒为对象） | `remote_backend.rs:160-163`、`cc_gui_daemon.rs:2116,507-517` |
| auth：`authenticated = config.token.is_none()`（**insecure 模式下初始即 true，首帧 auth 会被当普通方法报错→桥必须连"带 token"的 daemon**）；成功 `{ok:true}`，失败 `invalid token`/`unauthorized` | `cc_gui_daemon.rs:2107,2135-2155`；`parse_auth_token:547-556` |
| `engine_send_message_sync` 必填 `workspaceId,text`；可选 `engine,accessMode,images,continueSession,sessionId,...` | `cc_gui_daemon.rs:1542-1582` |
| sync 返回 `{engine,sessionId,text}`；Codex daemon 模式**不支持 sync**；超时 900s 文案 "Claude response timed out" | `daemon_state.rs:1613-1617,1537-1539,1595` |
| 异步事件帧 `{method:"app-server-event",params}`；增量 `item/agentMessage/delta`、`item/reasoning/textDelta` | `cc_gui_daemon.rs:529-544`、`engine/events.rs:424,432` |
| 事件字段大小写不对称：AppServerEvent `workspace_id`(snake,无rename) vs TerminalOutput `workspaceId`(camel) | `backend/events.rs:4-8,10-17` |
| 事件总线 broadcast 容量 2048，Lagged 静默丢（可能漏 completed） | `cc_gui_daemon.rs:2200,2070-2073` |
| GUI 自身也是该 daemon 客户端 | `web_service/mod.rs:20` |
| `remote_backend` 为 `pub(crate)` 且耦合 Tauri，桥不可复用→自实现 daemon_link | `remote_backend.rs:20,55,69,98` |
| 依赖已有 axum 0.7 + rusqlite 0.32（无需新增依赖；无 rand，token 用 uuid） | `src-tauri/Cargo.toml:42,50` |
| bin 子模块用 `#[path="wx_bridge/x.rs"] mod x;`（同 cc_gui_daemon 模式） | `cc_gui_daemon.rs:28` |
| tauri-build 需 `../dist/**`（worktree 须有 dist 才能编译任何 bin） | 构建实测 |

---

## 8. 已发现已修复的问题

| 轮次 | 发现 | 类别 | 摘要 |
|------|------|------|------|
| 计划对抗评审(4 reviewer，go-with-fixes) | 5 处事实错误 | 计划准确性 | ①`respond_to_server_request` 是 Codex 专属，Claude 审批是 kill+resume 无远程 RPC→MVP 高危默认拒；②daemon 行数误记；③Codex sync 不支持；④token 默认 None 全库无生成逻辑；⑤降敏默认应"开"非"关"。均已在终版计划修正 |
| 实现期 | 桥模块路径解析错误 | 编译 | bin 子模块须 `#[path]`，已修，编译通过 |
| 实现期 | tauri-build 缺 dist 阻塞编译 | 构建 | worktree 拷入 dist 占位（gitignore） |
| 实现期 | insecure daemon auth 行为 | 协议 | 实测 `authenticated=config.token.is_none()`；桥设计为只连带 token 的 daemon（=安全），冒烟须 daemon 带 token |
| 冒烟 | 端到端连通 | 验证 | healthz=ok；chat 走通；空 data-dir 下优雅返回友好错误 |
| 接手续做 | Finder/open 启动无窗口 | 体验 | `fix_path_env::fix()` 在无终端启动时可能卡住，已加 1.5s 超时；主窗口创建后强制 show/focus，target `LawyerCopilot.app` 已有 CGWindow |

---

## 9. 新对话开场指令

### 9.1 简短版（推荐）
```
接手交接文档：docs/handoffs/2026-06-22-wechat-clawbot-bridge-context.md
```

### 9.2 完整版（降级兜底）
```
启用 handoff-receive skill。
接手交接文档：/Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot-wechat-bridge/docs/handoffs/2026-06-22-wechat-clawbot-bridge-context.md

任务范围：
1. 先核查已实现的 wx_bridge（src-tauri/src/bin/wx_bridge/）是否符合总计划与后续三层权限直接执行需求，跑 `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml` 确认 80/80，复核 policy 默认拒、daemon_link 协议契约、降敏默认开、出站 image/file payload。
2. 续做（按序）：
   a. 当前运行周期真微信图片/引用严格验收已完成：`node scripts/check-wechat-bridge-app-state.mjs --require-real-activity --require-real-media --require-real-quote`。
   b. 继续灰度：语音、断网恢复、长任务、微信风控、出站限频参数。
   c. 提交：按 lawyer-copilot git 规范从 develop 切/PR，不直推 main（当前未 commit）。

约束：
- 引用代码必带 文件:行号，未查证先查证（用户红线）。
- 禁止擅自降级安全/业务语义；当前微信控制入口维持“三层权限直接执行”，不得退回只读假实现或二次确认体验。
- 凡微信真机/封号等 agent 测不了的，如实标注，禁止粉饰。
- 测试门禁：改动需单元+集成测试通过；构建用 CARGO_TARGET_DIR 复用主仓 target。

输出要求：结论先行、短密直、表格优先、不写套话、无 emoji。

交互期望：用户要"完全没问题后再汇报"，但微信真机那跳必须用户本人操作；遇到需用户拍板（数据目录/微信号/commit）时停下来问。
```

### 9.3 两种形式区别
| 形式 | 触发机制 | 适用场景 |
|------|---------|---------|
| 简短版 | skill 自动匹配"接手"+路径 | 同机器同用户、在本 worktree 打开新对话 |
| 完整版 | prompt 自带指令 | skill 未触发/跨设备/在主仓而非 worktree 打开 |

---

## 10. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-06-22 | 初始版本：桥核心实现完成，待真机/真 Claude 验证与续做 |
| 2026-06-23 | 接手后完成 G0 daemon token、产品内微信连接控制面、托管 WeClaw sidecar、进程级 smoke、真实 Claude 短回复 smoke、App 菜单直达/直启、app 内本机 smoke；待真机微信验收 |
| 2026-06-24 | 扩展为三层权限直接执行；支持微信读写电脑、当前目录/文件操作、图片/文件/引用入站、图片/文件出站、会话命令；`npm run test`、`cargo test --bin wx_bridge`、`go test ./...`、typecheck、lint、OpenSpec、运行态 smoke、当前运行周期真微信图片/引用严格复验、Tauri app 打包均通过；当前只差提交 |
