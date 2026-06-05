## Why

Live conversation rendering needs to keep the latest ordinary user question visible as the anchor while assistant/reasoning content streams underneath it. The main spec and implementation already define this presentation behavior, but the Trellis task remains open and needs an OpenSpec closure artifact with validation evidence.

## What Changes

- Capture the existing live user-question pinning implementation as a completed OpenSpec change.
- Keep the behavior display-only: no message data mutation, no runtime payload change, and no new storage field.
- Verify the focused live-window and message-rendering tests that cover sticky handoff, trimming, history fallback, and pseudo-user exclusion.
- Archive the change after strict OpenSpec validation.

## Non-Goals

- Add a new sticky UI separate from the shared history sticky header.
- Change copy semantics for user messages.
- Change runtime, history loader, or Tauri command payloads.
- Expand conversation windowing beyond the existing bounded working set.
