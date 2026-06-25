# wechat-rich-message-transport delta

## ADDED Requirements

### Requirement: WeChat media reaches the desktop agent

Patched WeClaw SHALL forward inbound WeChat media to the configured HTTP agent instead of only saving or skipping it.

#### Scenario: image message becomes OpenAI image content

- WHEN a WeChat user sends an image to the bot
- THEN WeClaw SHALL download the image to a local app media directory
- AND it SHALL call the HTTP agent with an `image_url` content part referencing that local file
- AND it SHALL include any user text as a text content part.

### Requirement: quoted WeChat messages become agent context

Patched WeClaw SHALL preserve quoted message context when a user replies to or quotes a prior message.

#### Scenario: user asks about a quoted text

- WHEN a WeChat user sends a message with quoted text
- THEN WeClaw SHALL include the quoted text in a structured text content part
- AND the user's instruction SHALL remain a separate current-user text part.

#### Scenario: user asks about quoted media

- WHEN a WeChat user sends a message with quoted media metadata
- THEN WeClaw SHALL include the quoted media references in the structured quote context
- AND downloadable quoted images SHALL be forwarded as `image_url` parts.

#### Scenario: quoted payload uses common camelCase fields

- WHEN a quoted payload uses `referMsg`, `fromUserId`, `textItem`, `itemList`, `imageItem`, or `fileItem`
- THEN WeClaw SHALL parse the quoted sender, text, image references, and file names
- AND quoted file names without a downloadable URL SHALL remain visible in the structured quote context.

#### Scenario: real quote parsing is observable without exposing content

- WHEN WeClaw parses quoted context from a real WeChat message
- THEN app verification SHALL report the quote as parsed
- AND logs SHALL NOT print the quoted message body.

### Requirement: patched WeClaw is the bundled sidecar

LawyerCopilot SHALL bundle the project-maintained patched WeClaw binary.

#### Scenario: sidecars are prepared

- WHEN `scripts/prepare-tauri-sidecars.mjs` runs
- THEN it SHALL build WeClaw from `sidecars/weclaw`
- AND the produced binary SHALL be copied to `src-tauri/binaries/weclaw-<target>`.
