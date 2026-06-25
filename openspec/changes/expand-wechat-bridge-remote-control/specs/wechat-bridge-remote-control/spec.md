# wechat-bridge-remote-control delta

## ADDED Requirements

### Requirement: WeChat remote control uses three permission tiers

The bridge SHALL classify each non-command WeChat task into a permission tier before calling the desktop daemon.

#### Scenario: read-only tasks run automatically

- WHEN a WeChat user asks for current directory, file listing, reading, searching, explanation, or image analysis
- THEN the bridge SHALL call the daemon with `accessMode=read-only`
- AND it SHALL NOT require confirmation.

#### Scenario: normal side effects run immediately with default access

- WHEN a WeChat user asks to create, modify, move files, run a normal shell command, or open a desktop app
- THEN the bridge SHALL call the daemon immediately with `accessMode=default`
- AND it SHALL NOT ask for a second WeChat confirmation.

#### Scenario: high-risk side effects run immediately with full access

- WHEN a WeChat user asks to delete, overwrite broadly, install dependencies, push/sync git, upload data, access workspace-external paths, or use unrestricted computer control
- THEN the bridge SHALL call the daemon immediately with `accessMode=full-access`
- AND it SHALL NOT ask for a second WeChat confirmation.

### Requirement: WeChat session commands are deterministic

The bridge SHALL handle supported control commands without asking the model to infer them.

#### Scenario: new session resets only the current WeChat binding

- WHEN a WeChat user sends `新开会话` or `/new`
- THEN the bridge SHALL clear only that `wxid` last session binding
- AND the next normal message SHALL start a new Claude session.

#### Scenario: compact command compacts current Claude session

- GIVEN a current session exists for `wxid`
- WHEN the user sends `会话压缩` or `/compact`
- THEN the bridge SHALL call daemon `thread_compact` with `threadId=claude:<sessionId>`
- AND it SHALL reply with the compaction result or a friendly failure message.

#### Scenario: compact without session is actionable

- GIVEN no current session exists for `wxid`
- WHEN the user sends `会话压缩` or `/compact`
- THEN the bridge SHALL reply that there is no active conversation to compact.

### Requirement: Media payloads stay compatible with patched WeClaw

The bridge SHALL preserve inbound image refs and SHALL return outbound image/file refs in OpenAI-compatible message content for patched WeClaw.

#### Scenario: inbound multimodal request reaches daemon

- WHEN WeClaw or a patched transport sends user content with text and image refs
- THEN the bridge SHALL pass text and image refs to daemon `engine_send_message_sync`.

#### Scenario: outbound image refs are serializable

- WHEN the pipeline returns text plus image refs
- THEN the HTTP completion response SHALL include assistant content parts that carry both text and image refs.

#### Scenario: outbound file refs are serializable

- WHEN the pipeline returns text plus file refs
- THEN the HTTP completion response SHALL include assistant content parts that carry both text and file refs
- AND patched WeClaw SHALL relay local or remote file refs as WeChat attachments.

## Purpose

Defines WeChat as a controlled remote desktop conversation surface: deterministic session commands, permission tiering, direct execution, and media-ready request/response contracts.
