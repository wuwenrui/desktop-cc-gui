## Why

Realtime conversation output can flicker, briefly blank, or visually overlap while the assistant is streaming long content. The observed shape is not an upstream or OCR issue: the message canvas shell remains alive while the live content region repaints incorrectly. Windows WebView2 shows the failure more clearly; macOS can exhibit a shorter version that recovers almost immediately.

The likely fault line is the live message canvas render pipeline:

- the assistant tail row keeps growing while streaming;
- `@tanstack/react-virtual` depends on row measurement, scroll offset, and browser layout/paint timing staying aligned;
- WebView2 GPU/compositor pressure can temporarily show stale or overlapping layers when measurements lag behind live row growth;
- existing renderer diagnostics can detect blank-screen symptoms, but the message timeline path does not yet leave enough bounded evidence or self-heal from transient virtualizer measurement collapse.

The product needs a conservative hardening pass that protects live streaming visibility without regressing long-output performance.

## What Changed

This change hardens the live message canvas render path by:

- keeping the active live tail row visible and layout-stable while streaming text grows;
- avoiding full timeline derivation or history replay as a render recovery mechanism;
- adding a bounded virtualizer remeasure guard for suspicious live-canvas states;
- recording bounded renderer diagnostics when the timeline has rows but the virtualized visible set collapses or the live tail is at risk of visual instability;
- adding focused regression coverage for streaming text growth and transient virtualizer collapse.

## Non-Goals

- Do not disable message timeline virtualization globally.
- Do not change backend streaming, runtime command payloads, provider adapters, or history restore contracts.
- Do not migrate message Markdown to the file-preview fast renderer.
- Do not add a new dependency.
- Do not rely on user-provided OCR, screenshots, or external diagnostics to recover the UI.

## Impact

### Affected frontend areas

- `src/features/messages/components/MessagesTimeline.tsx`
- `src/features/messages/components/messagesTimelineVirtualization.ts`
- focused tests under `src/features/messages/components/**`
- existing renderer diagnostics surface in `src/services/rendererDiagnostics.ts` through reuse only

### API / dependency impact

- No Tauri command signature change.
- No backend storage or runtime event schema change.
- No new package dependency.

### Product impact

- Live assistant output should remain readable during long streaming turns.
- Windows WebView2 should recover from transient virtualizer/paint instability without requiring a user restart.
- Diagnostics should distinguish client render instability from upstream provider delay and backend forwarding stalls.

## Acceptance Criteria

- During realtime assistant streaming, the active live tail row remains visible as text grows.
- Transient empty virtualizer visible items while timeline rows exist triggers a bounded remeasure, not a full timeline rebuild.
- Any new diagnostics are bounded and privacy-safe; they do not include message text.
- Existing stable-snapshot/live-row override contract remains intact.
- Long-output virtualization remains enabled for non-live/stable history rows.
- Focused tests cover live text growth and suspicious virtualizer collapse recovery.
