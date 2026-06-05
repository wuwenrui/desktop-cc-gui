# Browser Dock Phase 3 Cross-Platform Degraded-Capability Matrix

Date: 2026-06-02
Change: `advance-browser-dock-trusted-observation-and-code-bridge`

| Platform | WebView runtime | Capture transport | Visual evidence | Annotation evidence | Action preview |
|---|---|---|---|---|---|
| macOS | WKWebView | `webview_dom` when active renderer matches; `metadata_fallback` on timeout/mismatch | Screenshot ref is metadata-only; OCR/model image payload requires explicit opt-in | Structured text evidence only; stale on URL/title/session/workspace/TTL mismatch | `navigate/reload/scroll` preview + confirmation path; `click/type/select/submit` blocked |
| Windows | WebView2 | Same contract as macOS; runtime availability may degrade before dock launch | Same metadata-only screenshot ref; WebView2 capture may report degraded capability | Same structured text evidence, no annotated image binary by default | Same preview/audit contract; mutating actions blocked |
| Linux | WebKitGTK | Same contract; AppImage/runtime variation may degrade DOM transport | Same metadata-only screenshot ref; visual binary not sent by default | Same structured text evidence; complex iframe/canvas/virtual-list gaps reported | Same preview/audit contract; mutating actions blocked |

Manual check focus:

1. Browser Dock opens and active session is renderer-bound before capture.
2. Stale preview appears after active tab/session/URL/title/workspace mismatch.
3. Capture payload includes observation state, diagnostics, omitted capabilities, and privacy/budget metadata.
4. Visual evidence separates DOM visual clues, screenshot refs, and OCR text.
5. Annotation payload is structured text only.
6. Safe action preview requires confirmation and records before/after audit metadata.
