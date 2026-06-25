# patch-weclaw-rich-message-transport Proposal

## Why

微信端要作为控制电脑端 agent 的主入口，必须把微信真实消息载荷交给 agent。当前官方 WeClaw v0.7.1 只把文本/语音转文字转发给 HTTP agent；图片会被保存或跳过，引用消息的原文/附件也不会形成 agent 上下文。这会让用户在微信里发图片、引用消息后，agent 只能猜“目录里有没有图片”，体验错误且不可控。

## Goals

- Goal：维护项目内 patched WeClaw sidecar，替代官方 release binary。
- Goal：微信图片、文件、视频等媒体先下载到 app 托管 media 目录，再作为 OpenAI-compatible `image_url` / text context 发给 `wx_bridge`。
- Goal：微信引用消息形成 `<wechat-quoted-message>` 上下文，包含引用文本和引用媒体引用。
- Goal：HTTP agent 支持 content parts 请求和 content parts 响应，和 `wx_bridge` 的 rich payload 协议对齐。
- Goal：充分自动化测试：Go unit tests 覆盖 rich payload，Node tests 覆盖 sidecar 构建选择，Rust tests 保持 `wx_bridge` rich payload contract。

## Boundaries

- Boundary：不新增中心服务器；媒体文件只保存在用户本机 app data 目录。
- Boundary：无法识别的 WeChat item 原始 JSON 可进入引用上下文，但不直接执行。
- Boundary：非 HTTP agent 继续收纯文本降级；rich media 首期只保证 `lawyer-copilot` HTTP agent。

## What Changes

- `sidecars/weclaw` vendored from fastclaw-ai/weclaw v0.7.1 with local patches.
- `agent.HTTPAgent` gains rich content support while preserving string content for old endpoints.
- `messaging.Handler` builds a rich inbound payload from text, images, files, voice text, and quoted/unknown item context.
- `scripts/prepare-tauri-sidecars.mjs` builds patched WeClaw from `sidecars/weclaw` instead of downloading official release binary.
- Docs and OpenSpec record media/quote semantics and verification commands.
