# patch-weclaw-rich-message-transport Design

## Data Flow

```text
WeChat message
  -> patched WeClaw handler
  -> download media to app media dir
  -> HTTPAgent.ChatRich(content parts + headers)
  -> wx_bridge /v1/chat/completions
  -> cc_gui_daemon images/text
  -> response content parts
  -> WeClaw sends text and media back to WeChat
```

## Message Contract

HTTP request user content uses OpenAI-compatible parts:

- `{ "type": "text", "text": "..." }`
- `{ "type": "image_url", "image_url": { "url": "file:///absolute/path.jpg" } }`

Quoted messages are encoded into a text part:

```xml
<wechat-quoted-message>
from: ...
text: ...
media: file:///...
</wechat-quoted-message>
```

This keeps `wx_bridge` changes minimal because it already parses text + `image_url` parts.

## Local Media Storage

Patched WeClaw uses config `save_dir` when present. LawyerCopilot shall write a save dir under app data before starting WeClaw so media is deterministic. If no save dir exists, WeClaw falls back to `~/.weclaw/media`.

## Sidecar Build

`prepare-tauri-sidecars.mjs` builds:

```bash
go build -C sidecars/weclaw -o src-tauri/binaries/weclaw-<target> .
```

Official release download remains documented as the upstream source but no longer used for product builds.

## Testing

- Go tests in `sidecars/weclaw/agent` verify rich request/response content.
- Go tests in `sidecars/weclaw/messaging` verify image download result is forwarded to rich agent and quote context is included.
- Node tests verify sidecar prep chooses local build.
- Existing Rust `wx_bridge` tests verify OpenAI content parts reach daemon.
