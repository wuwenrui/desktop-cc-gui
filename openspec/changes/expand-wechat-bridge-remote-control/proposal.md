# expand-wechat-bridge-remote-control Proposal

## Why

微信连接已经能让用户从手机给 LawyerCopilot 发消息，但当前行为仍像一个只读问答 bot：不能可靠执行电脑端任务，不能区分读/写/高危权限，也缺少会话命令和媒体出入站闭环。

目标体验是“手机上的远程控制入口”：律师在微信里问当前目录、看文件、分析图片、要求修改文件或执行命令时，桌面端按风险分层直接执行。

## Goals

- Goal：微信消息可驱动当前 LawyerCopilot 工作区的只读查询、图片分析、文件/命令任务和会话控制命令。
- Goal：建立三层权限：只读、普通电脑操作、高风险电脑操作；微信消息按用户指令直接执行，不再二次确认。
- Goal：支持 `新开会话`、`会话压缩`、`取消`、`帮助` 等微信命令。
- Goal：同一微信用户维持独立会话状态和审计记录。
- Goal：支持 OpenAI-compatible multimodal 入站图片，并通过项目托管 patched WeClaw 支持出站图片/文件。

## Non-Goals / Boundaries

- Boundary：不绕过 daemon token，不允许微信通道直接调用任意 daemon RPC。
- Boundary：不删除真实历史会话；`新开会话` 只重置该微信用户的 session binding。
- Boundary：项目托管 patched WeClaw 负责图片/文件/引用消息传输；官方 WeClaw v0.7.1 的媒体能力不足不能作为产品运行时依据。
- Boundary：本 change 不把所有 daemon RPC 暴露给微信；电脑操作仍通过 `engine_send_message_sync` 的模型工具链执行，并由 bridge 决定 access mode。

## What Changes

- 新增微信命令解析层：会话新开、会话压缩、帮助。
- 新增 remote-control policy：按用户文本和图片请求分类为 `read_only` / `default` / `full_access`。
- `wx_bridge` 根据分类结果选择 daemon `accessMode`：只读为 `read-only`，普通电脑操作为 `default`，高风险电脑操作为 `full-access`。
- `会话压缩` 复用 daemon `thread_compact`，当前没有 session 时给出可操作提示。
- `server` 响应可保留 text + image/file payload，作为 patched WeClaw 的出站媒体协议。

## Capabilities

### New Capabilities

- `wechat-bridge-remote-control`：微信远程控制当前桌面会话，支持权限分层、会话命令和媒体协议。

### Modified Capabilities

- `wechat-bridge-product-control`：原连接面板能力从“只读问答闭环”扩展为可控远程操作入口。
